import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchPostEngagers } from "@/lib/apify";
import { batchScoreIcpMatch, rankPostsForLeadGeneration } from "@/lib/ai";
import { logApiCost, API_COSTS } from "@/lib/api-costs";

function extractSlugOrId(linkedinUrl: string): string {
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
  return match ? match[1].toLowerCase().replace(/\/$/, "") : "";
}

interface EngagerInfo {
  id: string;
  name: string;
  position: string;
  linkedinUrl: string;
  pictureUrl: string;
  interactions: Map<string, "reaction" | "comment">;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { profileId, credits = 3 } = body;

  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  const service = createServiceClient();

  // Verify ownership
  const { data: profile } = await service.from("lg_profiles").select("*").eq("id", profileId).eq("user_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Check credits
  const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", user.id).single();
  if (!userRole || (userRole.credits !== -1 && userRole.credits < credits)) {
    return NextResponse.json({ error: "Créditos insuficientes" }, { status: 403 });
  }

  // Fetch posts
  const { data: posts } = await service.from("lg_posts").select("*").eq("profile_id", profileId);
  if (!posts || posts.length === 0) return NextResponse.json({ error: "No posts found" }, { status: 400 });

  // Rank posts by relevance if not already ranked
  const unrankedPosts = posts.filter((p) => p.relevance_score == null);
  if (unrankedPosts.length > 0) {
    const postsForRanking = unrankedPosts.map((p) => ({ id: p.id, text: p.text_content ?? "" }));
    const scores = await rankPostsForLeadGeneration(postsForRanking);
    logApiCost({ userId: user.id, source: "leads", searchId: profileId, provider: "openrouter", operation: "rankPostsForLeadGeneration", estimatedCost: API_COSTS.openrouter.classifyTopics, metadata: { postsRanked: postsForRanking.length } });

    for (const p of unrankedPosts) {
      const score = scores.get(p.id) ?? 50;
      await service.from("lg_posts").update({ relevance_score: score }).eq("id", p.id);
      p.relevance_score = score;
    }
  }

  // Sort by relevance and take top posts
  const sortedPosts = [...posts].sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
  const postsToScan = sortedPosts.filter((p) => (p.relevance_score ?? 0) >= 20 && p.post_url);

  if (postsToScan.length === 0) return NextResponse.json({ error: "No relevant posts found" }, { status: 400 });

  // Fetch options
  const { data: options } = await service.from("lg_options").select("*").eq("profile_id", profileId).single();
  const jobTitles = options?.job_titles ?? [];
  const departments = options?.departments ?? [];

  const maxLeads = credits * 15;
  const totalPossibleInteractions = postsToScan.length * 2;

  // Fetch engagers from all posts, tracking per-person across posts
  const engagerMap = new Map<string, EngagerInfo>();

  for (const post of postsToScan) {
    const { reactions, comments } = await fetchPostEngagers(post.post_url!);
    logApiCost({ userId: user.id, source: "leads", searchId: profileId, provider: "apify", operation: "fetchPostEngagers", estimatedCost: API_COSTS.apify.fetchPostEngagers, metadata: { postUrl: post.post_url } });

    // Process reactions
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
        engagerMap.set(actorId, {
          id: actorId, name: actorName,
          position: String(actor.position ?? ""),
          linkedinUrl: String(actor.linkedinUrl ?? ""),
          pictureUrl: String(actor.pictureUrl ?? ""),
          interactions,
        });
      }
    }

    // Process comments
    for (const c of comments) {
      const actor = (c.actor && typeof c.actor === "object" ? c.actor : null) as Record<string, unknown> | null;
      if (!actor || actor.author === true) continue;
      const actorId = String(actor.id ?? "");
      const actorName = String(actor.name ?? "");
      if (!actorName || actorName.length < 2) continue;

      const existing = engagerMap.get(actorId);
      if (existing) {
        const postUrl = post.post_url!;
        const currentType = existing.interactions.get(postUrl);
        existing.interactions.set(postUrl, currentType === "reaction" ? "comment" : "comment");
      } else {
        const interactions = new Map<string, "reaction" | "comment">();
        interactions.set(post.post_url!, "comment");
        engagerMap.set(actorId, {
          id: actorId, name: actorName,
          position: String(actor.position ?? ""),
          linkedinUrl: String(actor.linkedinUrl ?? ""),
          pictureUrl: String(actor.pictureUrl ?? ""),
          interactions,
        });
      }
    }
  }

  // Get existing slugs to skip duplicates
  const { data: existingResults } = await service.from("lg_results").select("profile_slug").eq("profile_id", profileId);
  const existingSlugs = new Set((existingResults ?? []).map((r) => r.profile_slug));

  // Convert to array, skip existing, limit to maxLeads
  const allEngagers = Array.from(engagerMap.values())
    .filter((e) => {
      const slug = extractSlugOrId(e.linkedinUrl) || e.id;
      return !existingSlugs.has(slug);
    })
    .slice(0, maxLeads);

  // Batch score ICP
  let leadCount = 0;
  const BATCH_SIZE = 10;
  const savedLeads: Array<Record<string, unknown>> = [];

  for (let batchStart = 0; batchStart < allEngagers.length; batchStart += BATCH_SIZE) {
    if (leadCount >= maxLeads) break;

    const batch = allEngagers.slice(batchStart, batchStart + BATCH_SIZE);
    const batchLeads = batch.map((eng, i) => ({
      index: batchStart + i,
      name: eng.name,
      headline: eng.position,
    }));

    const aiScores = await batchScoreIcpMatch(batchLeads, jobTitles, departments);
    logApiCost({ userId: user.id, source: "leads", searchId: profileId, provider: "openrouter", operation: "batchScoreIcpMatch", estimatedCost: API_COSTS.openrouter.batchScoreIcpMatch, metadata: { batchSize: batch.length } });

    for (let i = 0; i < batch.length; i++) {
      if (leadCount >= maxLeads) break;
      const engager = batch[i];
      const globalIdx = batchStart + i;
      const slug = extractSlugOrId(engager.linkedinUrl) || engager.id;
      const aiResult = aiScores.get(globalIdx);

      const sourcePostUrls = Array.from(engager.interactions.keys());
      let totalInteractions = 0;
      for (const post of postsToScan) {
        const url = post.post_url!;
        if (engager.interactions.has(url)) totalInteractions++;
      }

      const engagementType = engager.interactions.size > 1 ? "both" :
        Array.from(engager.interactions.values())[0] === "comment" ? "comment" : "reaction";

      const lead = {
        profile_id: profileId,
        profile_slug: slug,
        name: engager.name,
        headline: engager.position,
        job_title: aiResult?.jobTitle ?? engager.position,
        company: aiResult?.company ?? "",
        linkedin_url: engager.linkedinUrl || `https://linkedin.com/in/${slug}`,
        profile_photo: engager.pictureUrl,
        icp_score: aiResult?.score ?? 0,
        role_level: aiResult?.roleLevel ?? "observador",
        engagement_type: engagementType,
        source_post_urls: sourcePostUrls,
        interaction_count: totalInteractions,
        total_possible_interactions: totalPossibleInteractions,
        notes: {
          matched_titles: aiResult?.matchedTitles ?? [],
          matched_departments: aiResult?.matchedDepartments ?? [],
        },
      };

      try {
        await service.from("lg_results").insert(lead);
        savedLeads.push(lead);
        leadCount++;
      } catch (err) {
        console.error(`[lg-scan] Error saving ${engager.name}:`, err);
      }
    }
  }

  // Deduct credits
  if (userRole.credits !== -1 && leadCount > 0) {
    const creditsToDeduct = Math.ceil(leadCount / 15);
    const { data: cur } = await service.from("user_roles").select("credits").eq("user_id", user.id).single();
    if (cur) {
      const newCredits = Math.max(0, cur.credits - creditsToDeduct);
      await service.from("user_roles").update({ credits: newCredits }).eq("user_id", user.id);
      console.log(`[lg-scan] Credits: ${creditsToDeduct} deducted (${leadCount} leads), ${cur.credits} -> ${newCredits}`);
      logApiCost({ userId: user.id, source: "leads", searchId: profileId, provider: "apify", operation: "credits_deducted", estimatedCost: 0, creditsUsed: creditsToDeduct, metadata: { leadsFound: leadCount } });
    }
  }

  console.log(`[lg-scan] Complete: ${leadCount} leads from ${postsToScan.length} posts`);

  return NextResponse.json({ leadsFound: leadCount, postsScanned: postsToScan.length });
}
