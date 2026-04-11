import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchPostEngagers } from "@/lib/apify";
import { batchScoreIcpMatch } from "@/lib/ai";

interface ScanBody {
  postUrls: string[];
  icpJobTitles: string[];
  icpDepartments: string[];
  icpCompanySizes: string[];
  icpCompanySize?: string;
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
      const { reactions, comments } = await fetchPostEngagers(postUrl);
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

        console.log(`[leads] Lead: ${engager.name} | cargo="${jobTitle}" | empresa="${company}" | ICP=${score} | type=${engager.type}`);

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

    // Deduct credits: 1 credit per 10 leads found
    if (userRole && userRole.credits !== -1 && leadCount > 0) {
      const creditsToDeduct = Math.ceil(leadCount / 10);
      const { data: cur } = await service.from("user_roles").select("credits").eq("user_id", userId).single();
      if (cur) {
        const newCredits = Math.max(0, cur.credits - creditsToDeduct);
        await service.from("user_roles").update({ credits: newCredits }).eq("user_id", userId);
        console.log(`[leads] Credits deducted: ${creditsToDeduct} (${leadCount} leads / 10), ${cur.credits} -> ${newCredits}`);
      }
    }

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

  const body: ScanBody = await request.json();
  const { postUrls, icpJobTitles, icpDepartments, icpCompanySizes = [], icpCompanySize } = body;
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
