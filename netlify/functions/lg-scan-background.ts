import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { fetchPostEngagers } from "../../src/lib/apify";
import { batchScoreIcpMatch } from "../../src/lib/ai";
import { logApiCost, API_COSTS } from "../../src/lib/api-costs";
import { notifyError } from "../../src/lib/error-notifier";

interface ScanParams {
  userId: string;
  profileId: string;
  postsToScan: Array<{ post_url: string | null; relevance_score: number | null }>;
  jobTitles: string[];
  departments: string[];
  maxLeads: number;
}

interface EngagerInfo {
  id: string;
  name: string;
  position: string;
  linkedinUrl: string;
  pictureUrl: string;
  interactions: Map<string, "reaction" | "comment">;
}

function extractSlugOrId(linkedinUrl: string): string {
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
  return match ? match[1].toLowerCase().replace(/\/$/, "") : "";
}

const handler: Handler = async (event: HandlerEvent) => {
  if (!event.body) return { statusCode: 400, body: "Missing body" };

  const params: ScanParams = JSON.parse(event.body);
  const { userId, profileId, postsToScan, jobTitles, departments, maxLeads } = params;

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    const totalPossibleInteractions = postsToScan.length * 2;
    const engagerMap = new Map<string, EngagerInfo>();

    for (const post of postsToScan) {
      if (!post.post_url) continue;
      console.log(`[lg-scan] Processing post: ${post.post_url}`);
      const { reactions, comments } = await fetchPostEngagers(post.post_url);
      logApiCost({ userId, source: "leads", searchId: profileId, provider: "apify", operation: "fetchPostEngagers", estimatedCost: API_COSTS.apify.fetchPostEngagers, metadata: { postUrl: post.post_url } });

      for (const r of reactions) {
        const actor = (r.actor && typeof r.actor === "object" ? r.actor : null) as Record<string, unknown> | null;
        if (!actor) continue;
        const actorId = String(actor.id ?? "");
        const actorName = String(actor.name ?? "");
        if (!actorName || actorName.length < 2) continue;
        const existing = engagerMap.get(actorId);
        if (existing) {
          existing.interactions.set(post.post_url!, "reaction");
        } else {
          const interactions = new Map<string, "reaction" | "comment">();
          interactions.set(post.post_url!, "reaction");
          engagerMap.set(actorId, { id: actorId, name: actorName, position: String(actor.position ?? ""), linkedinUrl: String(actor.linkedinUrl ?? ""), pictureUrl: String(actor.pictureUrl ?? ""), interactions });
        }
      }

      for (const c of comments) {
        const actor = (c.actor && typeof c.actor === "object" ? c.actor : null) as Record<string, unknown> | null;
        if (!actor || actor.author === true) continue;
        const actorId = String(actor.id ?? "");
        const actorName = String(actor.name ?? "");
        if (!actorName || actorName.length < 2) continue;
        const existing = engagerMap.get(actorId);
        if (existing) {
          existing.interactions.set(post.post_url!, "comment");
        } else {
          const interactions = new Map<string, "reaction" | "comment">();
          interactions.set(post.post_url!, "comment");
          engagerMap.set(actorId, { id: actorId, name: actorName, position: String(actor.position ?? ""), linkedinUrl: String(actor.linkedinUrl ?? ""), pictureUrl: String(actor.pictureUrl ?? ""), interactions });
        }
      }
    }

    console.log(`[lg-scan] Total engagers: ${engagerMap.size}`);

    // Deduplicate against existing results
    const { data: existingResults } = await service.from("lg_results").select("profile_slug").eq("profile_id", profileId);
    const existingSlugs = new Set((existingResults ?? []).map((r: { profile_slug: string }) => r.profile_slug));

    const allEngagers = Array.from(engagerMap.values())
      .filter((e) => {
        const slug = extractSlugOrId(e.linkedinUrl) || e.id;
        return !existingSlugs.has(slug);
      })
      .slice(0, maxLeads);

    console.log(`[lg-scan] Scoring ${allEngagers.length} new engagers...`);

    let leadCount = 0;
    const BATCH_SIZE = 10;

    for (let batchStart = 0; batchStart < allEngagers.length; batchStart += BATCH_SIZE) {
      if (leadCount >= maxLeads) break;
      const batch = allEngagers.slice(batchStart, batchStart + BATCH_SIZE);
      const batchLeads = batch.map((eng, i) => ({ index: batchStart + i, name: eng.name, headline: eng.position }));
      const aiScores = await batchScoreIcpMatch(batchLeads, jobTitles, departments);
      logApiCost({ userId, source: "leads", searchId: profileId, provider: "openrouter", operation: "batchScoreIcpMatch", estimatedCost: API_COSTS.openrouter.batchScoreIcpMatch, metadata: { batchSize: batch.length } });

      for (let i = 0; i < batch.length; i++) {
        if (leadCount >= maxLeads) break;
        const engager = batch[i];
        const globalIdx = batchStart + i;
        const slug = extractSlugOrId(engager.linkedinUrl) || engager.id;
        const aiResult = aiScores.get(globalIdx);
        const sourcePostUrls = Array.from(engager.interactions.keys());
        let totalInteractions = 0;
        for (const p of postsToScan) {
          if (p.post_url && engager.interactions.has(p.post_url)) totalInteractions++;
        }
        const engagementType = engager.interactions.size > 1 ? "both" :
          Array.from(engager.interactions.values())[0] === "comment" ? "comment" : "reaction";

        try {
          await service.from("lg_results").insert({
            profile_id: profileId, profile_slug: slug, name: engager.name, headline: engager.position,
            job_title: aiResult?.jobTitle ?? engager.position, company: aiResult?.company ?? "",
            linkedin_url: engager.linkedinUrl || `https://linkedin.com/in/${slug}`,
            profile_photo: engager.pictureUrl, icp_score: aiResult?.score ?? 0,
            role_level: aiResult?.roleLevel ?? "observador", engagement_type: engagementType,
            source_post_urls: sourcePostUrls, interaction_count: totalInteractions,
            total_possible_interactions: totalPossibleInteractions,
            notes: { matched_titles: aiResult?.matchedTitles ?? [], matched_departments: aiResult?.matchedDepartments ?? [] },
          });
          leadCount++;
        } catch (err) { console.error(`[lg-scan] Error saving ${engager.name}:`, err); }
      }
    }

    // Deduct credits
    const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", userId).single();
    if (userRole && userRole.credits !== -1 && leadCount > 0) {
      const creditsToDeduct = Math.ceil(leadCount / 12);
      const newCredits = Math.max(0, userRole.credits - creditsToDeduct);
      await service.from("user_roles").update({ credits: newCredits }).eq("user_id", userId);
      console.log(`[lg-scan] Credits: ${creditsToDeduct} deducted (${leadCount} leads), ${userRole.credits} -> ${newCredits}`);
      logApiCost({ userId, source: "leads", searchId: profileId, provider: "apify", operation: "credits_deducted", estimatedCost: 0, creditsUsed: creditsToDeduct, metadata: { leadsFound: leadCount } });
    }

    console.log(`[lg-scan] Complete: ${leadCount} leads from ${postsToScan.length} posts`);
  } catch (e) {
    console.error("[lg-scan] Background scan error:", e);
    notifyError("lg-scan-background", e, { userId, profileId, postsCount: postsToScan.length });
  }

  return { statusCode: 202, body: "OK" };
};

export { handler };
