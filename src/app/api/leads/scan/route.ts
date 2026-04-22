import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchPostEngagers, fetchLinkedInProfileApify } from "@/lib/apify";
import { batchScoreIcpMatch, extractCompaniesFromHeadlines } from "@/lib/ai";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { isApifyBlocked } from "@/lib/apify-usage";
import { resolveCompanySizes } from "@/lib/company-cache";

interface ScanBody {
  postUrls: string[];
  icpJobTitles: string[];
  icpDepartments: string[];
  icpCompanySizes: string[];
  icpCompanySize?: string;
  icpProfileId?: string;
  urlProfileId?: string;
}


interface EngagerInfo {
  id: string;
  name: string;
  position: string; // headline/job title from Apify
  linkedinUrl: string;
  pictureUrl: string;
  type: "reaction" | "comment" | "both";
  postUrl: string;
}

function extractSlugOrId(linkedinUrl: string): string {
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
  return match ? match[1].toLowerCase().replace(/\/$/, "") : "";
}

async function runScanInline(
  scanId: string,
  userId: string,
  postUrls: string[],
  icpJobTitles: string[],
  icpDepartments: string[],
) {
  const service = createServiceClient();
  try {
    const seenIds = new Set<string>();
    const allEngagers: EngagerInfo[] = [];
    let leadCount = 0;
    let totalEngagers = 0;
    let skippedNoName = 0;
    const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", userId).single();

    for (const postUrl of postUrls) {
      console.log(`[leads] Processing post: ${postUrl}`);
      const { reactions, comments } = await fetchPostEngagers(
        postUrl,
        undefined, undefined,
        { userId, source: "leads", searchId: scanId }
      );
      console.log(`[leads] Apify returned ${reactions.length} reactions, ${comments.length} comments for ${postUrl}`);

      const engagers: EngagerInfo[] = [];

      // Process reactions (likes)
      for (const r of reactions) {
        const actor = (r.actor && typeof r.actor === "object" ? r.actor : null) as Record<string, unknown> | null;
        if (!actor) continue;
        const actorId = String(actor.id ?? "");
        const actorName = String(actor.name ?? "");
        if (!actorName || actorName.length < 2) { skippedNoName++; continue; }
        if (seenIds.has(actorId)) continue;
        seenIds.add(actorId);
        engagers.push({
          id: actorId,
          name: actorName,
          position: String(actor.position ?? ""),
          linkedinUrl: String(actor.linkedinUrl ?? ""),
          pictureUrl: String(actor.pictureUrl ?? ""),
          type: "reaction",
          postUrl,
        });
      }

      // Process comments
      for (const c of comments) {
        const actor = (c.actor && typeof c.actor === "object" ? c.actor : null) as Record<string, unknown> | null;
        if (!actor) continue;
        // Skip if this is the post author
        if (actor.author === true) continue;
        const actorId = String(actor.id ?? "");
        const actorName = String(actor.name ?? "");
        if (!actorName || actorName.length < 2) { skippedNoName++; continue; }
        if (seenIds.has(actorId)) {
          // Upgrade to "both" if already seen as reaction
          const existing = engagers.find((e) => e.id === actorId);
          if (existing) existing.type = "both";
          continue;
        }
        seenIds.add(actorId);
        engagers.push({
          id: actorId,
          name: actorName,
          position: String(actor.position ?? ""),
          linkedinUrl: String(actor.linkedinUrl ?? ""),
          pictureUrl: String(actor.pictureUrl ?? ""),
          type: "comment",
          postUrl,
        });
      }

      totalEngagers += engagers.length;
      console.log(`[leads] ${engagers.length} valid engagers from ${postUrl} (${skippedNoName} skipped no name)`);
      allEngagers.push(...engagers);
    }

    console.log(`[leads] Total: ${allEngagers.length} engagers from ${postUrls.length} posts. Starting AI ICP scoring...`);

    // Calculate max leads budget: 10 leads per credit
    const maxLeads = (userRole && userRole.credits !== -1) ? userRole.credits * 10 : Infinity;

    // Batch AI ICP scoring (10 per batch)
    const BATCH_SIZE = 10;
    for (let batchStart = 0; batchStart < allEngagers.length; batchStart += BATCH_SIZE) {
      if (leadCount >= maxLeads) { console.log("[leads] Lead budget exhausted"); break; }

      const batch = allEngagers.slice(batchStart, batchStart + BATCH_SIZE);
      const batchLeads = batch.map((eng, i) => ({
        index: batchStart + i,
        name: eng.name,
        headline: eng.position,
      }));

      console.log(`[leads] AI scoring batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(allEngagers.length / BATCH_SIZE)} (${batch.length} leads)`);

      const aiScores = await batchScoreIcpMatch(batchLeads, icpJobTitles, icpDepartments);

      for (let i = 0; i < batch.length; i++) {
        if (leadCount >= maxLeads) break;

        const engager = batch[i];
        const globalIdx = batchStart + i;
        const slug = extractSlugOrId(engager.linkedinUrl);
        const headline = engager.position;

        const aiResult = aiScores.get(globalIdx);
        const score = aiResult?.score ?? 0;
        const matchedTitles = aiResult?.matchedTitles ?? [];
        const matchedDepartments = aiResult?.matchedDepartments ?? [];
        const company = aiResult?.company ?? "";
        const jobTitle = aiResult?.jobTitle ?? (headline.includes("|") ? headline.split("|")[0].trim() : headline);
        const roleLevel = aiResult?.roleLevel ?? "observador";

        console.log(`[leads] Lead: ${engager.name} | cargo="${jobTitle}" | empresa="${company}" | ICP=${score} | role=${roleLevel} | type=${engager.type}`);

        const lead = {
          slug: slug || engager.id,
          name: engager.name,
          headline,
          job_title: jobTitle,
          company,
          location: "",
          followers: 0,
          linkedin_url: engager.linkedinUrl || `https://linkedin.com/in/${slug || engager.id}`,
          profile_photo: engager.pictureUrl,
          icp_score: score,
          matched_titles: matchedTitles,
          matched_departments: matchedDepartments,
          company_size_match: false,
          engagement_type: engager.type,
          source_post_url: engager.postUrl,
          role_level: roleLevel,
        };

        try {
          await service.from("leads_results").insert({
            scan_id: scanId, profile_slug: slug || engager.id, notes: JSON.stringify(lead),
            icp_score: score, engagement_type: engager.type, source_post_url: engager.postUrl,
          });
          leadCount++;
        } catch (err) { console.error(`[leads] Error saving ${engager.name}:`, err); }
      }
    }

    // Enrich leads with empty company by fetching their LinkedIn profile
    try {
      const { data: emptyCompanyLeads } = await service
        .from("leads_results")
        .select("id, profile_slug, notes")
        .eq("scan_id", scanId);

      const toEnrich = ((emptyCompanyLeads ?? []) as Array<{ id: string; profile_slug: string; notes: unknown }>)
        .map((row) => {
          const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : (row.notes as Record<string, unknown>);
          return { id: row.id, slug: row.profile_slug, notes, company: String(notes?.company ?? ""), linkedinUrl: String(notes?.linkedin_url ?? "") };
        })
        .filter((r) => !r.company);

      if (toEnrich.length > 0) {
        console.log(`[leads] Company enrichment: ${toEnrich.length} leads need company from profile`);
        const MAX_ENRICH = 20;
        const needsAiExtraction: Array<{ id: string; index: number; name: string; text: string; leadRef: typeof toEnrich[number] }> = [];

        for (let i = 0; i < Math.min(toEnrich.length, MAX_ENRICH); i += 5) {
          const batch = toEnrich.slice(i, i + 5);
          await Promise.all(batch.map(async (lead) => {
            try {
              const target = lead.linkedinUrl && lead.linkedinUrl.startsWith("http")
                ? lead.linkedinUrl
                : lead.slug;
              const result = await fetchLinkedInProfileApify(target);
              if (result.status === 200 && result.data) {
                const d = result.data as Record<string, unknown>;

                // Try currentPosition.company first
                let company = String(d.company ?? "").trim();

                // Fallback 1: experience[0].company (current or most recent)
                if (!company) {
                  const exp = d.experience as Array<Record<string, unknown>> | undefined;
                  if (Array.isArray(exp) && exp.length > 0) {
                    const current = exp.find((e) => !e.end_date && (!e.ends_at || e.ends_at === "Present"));
                    const pick = current ?? exp[0];
                    company = String(pick?.company ?? pick?.company_name ?? "").trim();
                  }
                }

                // Save enriched headline for potential AI extraction
                const enrichedHeadline = String(d.headline ?? "");
                if (enrichedHeadline && !lead.notes.headline) lead.notes.headline = enrichedHeadline;

                if (company) {
                  lead.notes.company = company;
                  await service.from("leads_results").update({
                    notes: JSON.stringify(lead.notes),
                  }).eq("id", lead.id);
                  console.log(`[leads]   ✓ ${lead.notes.name ?? lead.slug} → company="${company}"`);
                } else if (enrichedHeadline && enrichedHeadline.length > 10) {
                  // Fallback 2: queue for AI extraction from enriched headline
                  needsAiExtraction.push({
                    id: lead.id,
                    index: needsAiExtraction.length,
                    name: String(lead.notes.name ?? ""),
                    text: enrichedHeadline,
                    leadRef: lead,
                  });
                  console.log(`[leads]   ? ${lead.notes.name ?? lead.slug} → queued for AI headline extraction`);
                } else {
                  console.log(`[leads]   ✗ ${lead.notes.name ?? lead.slug} → no company in profile`);
                }
              }
            } catch (err) {
              console.log(`[leads]   ✗ ${lead.slug} error: ${(err as Error).message}`);
            }
          }));
        }

        // Fallback 2: batch AI extraction from enriched headlines
        if (needsAiExtraction.length > 0) {
          console.log(`[leads] AI headline extraction for ${needsAiExtraction.length} leads`);
          const aiResults = await extractCompaniesFromHeadlines(
            needsAiExtraction.map((x) => ({ index: x.index, name: x.name, text: x.text }))
          );
          for (const [idx, company] of Array.from(aiResults.entries())) {
            const item = needsAiExtraction[idx];
            if (!item || !company) continue;
            item.leadRef.notes.company = company;
            await service.from("leads_results").update({
              notes: JSON.stringify(item.leadRef.notes),
            }).eq("id", item.id);
            console.log(`[leads]   ✓ ${item.name} → company="${company}" (AI)`);
          }
        }
      }
    } catch (err) {
      console.error("[leads] Company profile enrichment failed:", err);
    }

    // Enrich leads with company size from LinkedIn company pages
    try {
      const { data: savedLeads } = await service
        .from("leads_results")
        .select("id, notes")
        .eq("scan_id", scanId);

      const companyNames = (savedLeads ?? [])
        .map((l) => {
          const notes = typeof l.notes === "string" ? JSON.parse(l.notes) : l.notes;
          return (notes?.company ?? "") as string;
        })
        .filter(Boolean);

      if (companyNames.length > 0) {
        const companySizes = await resolveCompanySizes(companyNames, userId, scanId);

        // Update each lead's notes with company_size
        for (const row of (savedLeads ?? []) as Array<{ id: string; notes: unknown }>) {
          const notes = typeof row.notes === "string" ? JSON.parse(row.notes as string) : (row.notes as Record<string, unknown>);
          const company = (notes?.company ?? "") as string;
          if (!company) continue;
          const info = companySizes.get(company);
          if (!info) continue;
          const updatedNotes = { ...notes, company_size: info.employeeCountRange, company_industry: info.industry };
          await service.from("leads_results").update({ notes: JSON.stringify(updatedNotes) }).eq("id", row.id);
        }
        console.log(`[leads] Company size enrichment: ${companySizes.size}/${companyNames.length} companies resolved`);
      }
    } catch (err) {
      console.error("[leads] Company size enrichment failed:", err);
    }

    // Deduct credits: 1 credit per 10 leads found
    if (userRole && userRole.credits !== -1 && leadCount > 0) {
      const creditsToDeduct = Math.ceil(leadCount / 10);
      const { data: cur } = await service.from("user_roles").select("credits").eq("user_id", userId).single();
      if (cur) {
        const newCredits = Math.max(0, cur.credits - creditsToDeduct);
        await service.from("user_roles").update({ credits: newCredits }).eq("user_id", userId);
        console.log(`[leads] Credits deducted: ${creditsToDeduct} (${leadCount} leads / 10), ${cur.credits} -> ${newCredits}`);
        logApiCost({ userId, source: "leads", searchId: scanId, provider: "apify", operation: "credits_deducted", estimatedCost: 0, creditsUsed: creditsToDeduct, metadata: { leadsFound: leadCount } });
      }
    }

    // Log estimated API costs
    const aiBatches = Math.ceil(allEngagers.length / 10);
    logApiCost({
      userId,
      source: "leads",
      searchId: scanId,
      provider: "apify",
      operation: "fetchPostEngagers",
      estimatedCost: postUrls.length * API_COSTS.apify.fetchPostEngagers,
      metadata: { posts: postUrls.length, engagers: totalEngagers },
    });
    logApiCost({
      userId,
      source: "leads",
      searchId: scanId,
      provider: "openrouter",
      operation: "batchScoreIcpMatch",
      estimatedCost: aiBatches * API_COSTS.openrouter.batchScoreIcpMatch,
      metadata: { batches: aiBatches, leads: leadCount },
    });

    await service.from("leads_scans").update({ total_engagers: totalEngagers, matched_leads: leadCount, status: "complete" }).eq("id", scanId);
    console.log(`[leads] Scan complete. ${leadCount} leads from ${totalEngagers} engagers`);
  } catch (e) {
    console.error("[leads] Scan error:", e);
    await service.from("leads_scans").update({ status: "error", error_message: String(e) }).eq("id", scanId);
  }
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isApifyBlocked()) {
    return NextResponse.json(
      { error: "Limite mensal de créditos Apify atingido. Contate o admin." },
      { status: 503 }
    );
  }

  const body: ScanBody = await request.json();
  const { postUrls, icpJobTitles, icpDepartments, icpCompanySizes = [], icpCompanySize, icpProfileId, urlProfileId } = body;
  const companySizes = icpCompanySizes.length > 0 ? icpCompanySizes : (icpCompanySize ? [icpCompanySize] : []);

  if (!postUrls || postUrls.length === 0) {
    return NextResponse.json({ error: "At least one post URL is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Check credits and post limit (15 credits per post link)
  const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", user.id).single();
  if (!userRole || (userRole.credits !== -1 && userRole.credits <= 0)) {
    return NextResponse.json({ error: "Sem creditos disponiveis" }, { status: 403 });
  }

  if (userRole.credits !== -1) {
    const maxPosts = Math.floor(userRole.credits / 15);
    if (maxPosts === 0) {
      return NextResponse.json({ error: "Créditos insuficientes. São necessários pelo menos 15 créditos por link de post." }, { status: 403 });
    }
    if (postUrls.length > maxPosts) {
      return NextResponse.json({ error: `Você pode analisar no máximo ${maxPosts} post(s) com seus ${userRole.credits} créditos (15 créditos por link).` }, { status: 400 });
    }
  }

  // Create scan record with status "processing"
  const { data: scan, error: scanError } = await service
    .from("leads_scans")
    .insert({
      user_id: user.id,
      post_urls: postUrls,
      icp_job_titles: icpJobTitles,
      icp_departments: icpDepartments,
      icp_company_size: companySizes.join(","),
      status: "processing",
      icp_profile_id: icpProfileId || null,
      url_profile_id: urlProfileId || null,
    })
    .select()
    .single();

  if (scanError || !scan) {
    console.error("[leads] Failed to create scan:", scanError);
    return NextResponse.json({ error: "Failed to create scan" }, { status: 500 });
  }

  const scanParams = { scanId: scan.id, userId: user.id, postUrls, icpJobTitles, icpDepartments, companySizes };

  // Try Netlify Background Function first (production), fall back to inline (local dev)
  const siteUrl = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || "";

  if (siteUrl) {
    const bgUrl = `${siteUrl}/.netlify/functions/leads-scan-background`;
    console.log(`[leads] Triggering background scan at ${bgUrl} for scan ${scan.id}`);
    try {
      await fetch(bgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanParams),
      });
      console.log(`[leads] Background scan triggered for ${scan.id}`);
    } catch (err) {
      console.error("[leads] Failed to trigger background scan, falling back to inline:", err);
      runScanInline(scan.id, user.id, postUrls, icpJobTitles, icpDepartments);
    }
  } else {
    // Local dev: run inline (fire-and-forget)
    console.log(`[leads] Running scan inline (local dev) for ${scan.id}`);
    runScanInline(scan.id, user.id, postUrls, icpJobTitles, icpDepartments);
  }

  return NextResponse.json({ scanId: scan.id });
}
