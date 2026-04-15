import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { fetchPostEngagers } from "../../src/lib/apify";
import { batchScoreIcpMatch } from "../../src/lib/ai";
import { logApiCost, API_COSTS } from "../../src/lib/api-costs";
import { notifyError } from "../../src/lib/error-notifier";

interface ScanParams {
  scanId: string;
  userId: string;
  postUrls: string[];
  icpJobTitles: string[];
  icpDepartments: string[];
  companySizes: string[];
}

function extractSlugOrId(linkedinUrl: string): string {
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
  return match ? match[1].toLowerCase().replace(/\/$/, "") : "";
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const params: ScanParams = JSON.parse(event.body || "{}");
  const { scanId, userId, postUrls, icpJobTitles, icpDepartments, companySizes } = params;

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const seenIds = new Set<string>();
    interface EngagerInfo {
      id: string; name: string; position: string; linkedinUrl: string;
      pictureUrl: string; type: "reaction" | "comment" | "both"; postUrl: string;
    }
    const allEngagers: EngagerInfo[] = [];
    let leadCount = 0;
    let totalEngagers = 0;

    const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", userId).single();

    for (const postUrl of postUrls) {
      console.log(`[leads] Processing post: ${postUrl}`);
      const { reactions, comments } = await fetchPostEngagers(
        postUrl,
        undefined, undefined,
        { userId, source: "leads", searchId: scanId }
      );
      console.log(`[leads] Apify returned ${reactions.length} reactions, ${comments.length} comments`);

      interface EngagerInfo {
        id: string; name: string; position: string; linkedinUrl: string;
        pictureUrl: string; type: "reaction" | "comment" | "both"; postUrl: string;
      }
      const engagers: EngagerInfo[] = [];

      for (const r of reactions) {
        const actor = (r.actor && typeof r.actor === "object" ? r.actor : null) as Record<string, unknown> | null;
        if (!actor) continue;
        const actorId = String(actor.id ?? "");
        const actorName = String(actor.name ?? "");
        if (!actorName || actorName.length < 2) continue;
        if (seenIds.has(actorId)) continue;
        seenIds.add(actorId);
        engagers.push({
          id: actorId, name: actorName, position: String(actor.position ?? ""),
          linkedinUrl: String(actor.linkedinUrl ?? ""), pictureUrl: String(actor.pictureUrl ?? ""),
          type: "reaction", postUrl,
        });
      }

      for (const c of comments) {
        const actor = (c.actor && typeof c.actor === "object" ? c.actor : null) as Record<string, unknown> | null;
        if (!actor || actor.author === true) continue;
        const actorId = String(actor.id ?? "");
        const actorName = String(actor.name ?? "");
        if (!actorName || actorName.length < 2) continue;
        if (seenIds.has(actorId)) {
          const existing = engagers.find((e) => e.id === actorId);
          if (existing) existing.type = "both";
          continue;
        }
        seenIds.add(actorId);
        engagers.push({
          id: actorId, name: actorName, position: String(actor.position ?? ""),
          linkedinUrl: String(actor.linkedinUrl ?? ""), pictureUrl: String(actor.pictureUrl ?? ""),
          type: "comment", postUrl,
        });
      }

      totalEngagers += engagers.length;
      console.log(`[leads] ${engagers.length} valid engagers from ${postUrl}`);
      allEngagers.push(...engagers);
    }

    console.log(`[leads] Total: ${allEngagers.length} engagers. Starting AI ICP scoring...`);

    // Calculate max leads budget: 10 leads per credit
    const maxLeads = (userRole && userRole.credits !== -1) ? userRole.credits * 10 : Infinity;

    const BATCH_SIZE = 10;
    for (let batchStart = 0; batchStart < allEngagers.length; batchStart += BATCH_SIZE) {
      if (leadCount >= maxLeads) { console.log("[leads] Lead budget exhausted"); break; }

      const batch = allEngagers.slice(batchStart, batchStart + BATCH_SIZE);
      const batchLeads = batch.map((eng, i) => ({ index: batchStart + i, name: eng.name, headline: eng.position }));
      console.log(`[leads] AI batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(allEngagers.length / BATCH_SIZE)}`);

      const aiScores = await batchScoreIcpMatch(batchLeads, icpJobTitles, icpDepartments);

      for (let i = 0; i < batch.length; i++) {
        if (leadCount >= maxLeads) break;

        const engager = batch[i];
        const globalIdx = batchStart + i;
        const slug = extractSlugOrId(engager.linkedinUrl);
        const headline = engager.position;
        const aiResult = aiScores.get(globalIdx);
        const score = aiResult?.score ?? 0;
        const jobTitle = aiResult?.jobTitle ?? (headline.includes("|") ? headline.split("|")[0].trim() : headline);
        const company = aiResult?.company ?? "";
        const roleLevel = aiResult?.roleLevel ?? "observador";

        console.log(`[leads] Lead: ${engager.name} | cargo="${jobTitle}" | empresa="${company}" | ICP=${score} | role=${roleLevel}`);

        const lead = {
          slug: slug || engager.id, name: engager.name, headline, job_title: jobTitle, company,
          location: "", followers: 0,
          linkedin_url: engager.linkedinUrl || `https://linkedin.com/in/${slug || engager.id}`,
          profile_photo: engager.pictureUrl, icp_score: score,
          matched_titles: aiResult?.matchedTitles ?? [], matched_departments: aiResult?.matchedDepartments ?? [],
          company_size_match: false, engagement_type: engager.type, source_post_url: engager.postUrl,
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
    console.error("[leads] Background scan error:", e);
    notifyError("leads-scan-background", e, { scanId, userId });
    await service.from("leads_scans").update({ status: "error", error_message: String(e) }).eq("id", scanId);
  }

  return { statusCode: 202, body: "OK" };
};

export { handler };
