import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { rankPostsForLeadGeneration } from "@/lib/ai";
import { fetchProfilePosts } from "@/lib/apify";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { notifyError } from "@/lib/error-notifier";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { profileId, credits = 3 } = body;
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  const service = createServiceClient();

  try {
    // Verify ownership
    const { data: profile } = await service.from("lg_profiles").select("*").eq("id", profileId).eq("user_id", user.id).single();
    if (!profile) { notifyError("lg-scan", new Error("Profile not found"), { profileId, userId: user.id }); return NextResponse.json({ error: "Profile not found" }, { status: 404 }); }

    // Check credits
    const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", user.id).single();
    if (!userRole || (userRole.credits !== -1 && userRole.credits < credits)) {
      return NextResponse.json({ error: "Créditos insuficientes" }, { status: 403 });
    }

    // Fetch existing posts
    const { data: existingPosts } = await service.from("lg_posts").select("*").eq("profile_id", profileId);

    // Check if we already have leads (meaning this is a repeat scan)
    const { count: existingLeadsCount } = await service.from("lg_results").select("id", { count: "exact", head: true }).eq("profile_id", profileId);
    const isRepeatScan = (existingLeadsCount ?? 0) > 0;

    // For repeat scans, ALWAYS fetch more posts from LinkedIn to go deeper
    let postsToScan: typeof existingPosts = [];

    if (isRepeatScan) {
      console.log(`[lg-scan] Repeat scan — fetching more posts from LinkedIn`);
      const existingCount = (existingPosts ?? []).length;
      const fetchCount = existingCount + 10;

      const rawPosts = await fetchProfilePosts(profile.linkedin_url, fetchCount);
      logApiCost({ userId: user.id, source: "leads", searchId: profileId, provider: "apify", operation: "fetchProfilePosts", estimatedCost: API_COSTS.apify.fetchProfilePosts, metadata: { existingCount, fetchCount, fetched: rawPosts.length } });
      console.log(`[lg-scan] Fetched ${rawPosts.length} posts (had ${existingCount} stored)`);

      // Build dedup set from existing posts using URN IDs
      const existingUrnIds = new Set<string>();
      for (const p of existingPosts ?? []) {
        const match = (p.post_url ?? "").match(/(\d{10,})/);
        if (match) existingUrnIds.add(match[1]);
      }

      // Find NEW posts not already stored
      const newPosts = rawPosts.map((p) => {
        const shareUrn = String(p.shareUrn ?? p.entityId ?? "");
        const postUrl = shareUrn.includes("urn:li:") ? `https://www.linkedin.com/feed/update/${shareUrn}` : "";
        const urnId = shareUrn.match(/(\d+)$/)?.[1] ?? "";
        return { profile_id: profileId, post_url: postUrl, text_content: String(p.content ?? p.text ?? p.postText ?? ""), reactions: 0, comments: 0, posted_at: String(p.postedAt ?? p.publishedAt ?? ""), raw_data: p, urnId };
      }).filter((p) => p.post_url && p.urnId && !existingUrnIds.has(p.urnId));

      console.log(`[lg-scan] Found ${newPosts.length} new posts not yet stored`);

      if (newPosts.length > 0) {
        const toInsert = newPosts.map(({ urnId: _, ...rest }) => rest);
        await service.from("lg_posts").insert(toInsert);

        // Rank new posts
        const postsForRanking = newPosts.map((p, i) => ({ id: `new-${i}`, text: p.text_content }));
        const scores = await rankPostsForLeadGeneration(postsForRanking);
        logApiCost({ userId: user.id, source: "leads", searchId: profileId, provider: "openrouter", operation: "rankPostsForLeadGeneration", estimatedCost: API_COSTS.openrouter.classifyTopics });

        // Re-fetch all posts to get inserted IDs
        const { data: allPosts } = await service.from("lg_posts").select("*").eq("profile_id", profileId);
        for (const p of (allPosts ?? []).filter((p) => p.relevance_score == null)) {
          await service.from("lg_posts").update({ relevance_score: scores.get(p.id) ?? 50 }).eq("id", p.id);
        }

        // Use ONLY new (unscanned) posts
        postsToScan = (allPosts ?? []).filter((p) => p.post_url && p.scanned !== true).sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
      }

      // If no new posts found, scan all posts (dedup in bg function handles duplicates)
      if (!postsToScan || postsToScan.length === 0) {
        const { data: allPosts } = await service.from("lg_posts").select("*").eq("profile_id", profileId);
        postsToScan = (allPosts ?? []).filter((p) => p.post_url).sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
        console.log(`[lg-scan] No new posts, rescanning all ${postsToScan?.length ?? 0} posts`);
      }
    } else {
      // First scan: use existing posts, rank if needed
      const posts = existingPosts ?? [];
      if (posts.length === 0) return NextResponse.json({ error: "No posts found" }, { status: 400 });

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
      postsToScan = posts.filter((p) => (p.relevance_score ?? 0) >= 20 && p.post_url).sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
    }

    if (!postsToScan || postsToScan.length === 0) {
      notifyError("lg-scan no posts", new Error("No posts available"), { profileId, userId: user.id, isRepeatScan });
      return NextResponse.json({ error: "Não há posts para analisar neste perfil" }, { status: 400 });
    }

    console.log(`[lg-scan] Will scan ${postsToScan.length} posts`);

    // Fetch options
    const { data: options } = await service.from("lg_options").select("*").eq("profile_id", profileId).single();
    const jobTitles = options?.job_titles ?? [];
    const departments = options?.departments ?? [];
    const maxLeads = credits * 12;

    const scanParams = {
      userId: user.id,
      profileId,
      postsToScan: postsToScan.map((p) => ({ id: p.id, post_url: p.post_url, relevance_score: p.relevance_score })),
      jobTitles,
      departments,
      maxLeads,
    };

    // Mark profile as scanning
    await service.from("lg_profiles").update({ scan_status: "scanning" }).eq("id", profileId);

    // Trigger Netlify background function (production) or inline (local dev)
    const siteUrl = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3021}`;
    const bgUrl = `${siteUrl}/.netlify/functions/lg-scan-background`;

    try {
      const bgRes = await fetch(bgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanParams),
      });

      if (!bgRes.ok) {
        console.log(`[lg-scan] Background function unavailable (${bgRes.status}), running via inline API...`);
        // Fallback: call inline API route (same pattern as casting search)
        fetch(`${siteUrl}/api/leads-generation/scan-inline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scanParams),
          signal: AbortSignal.timeout(600_000),
        }).catch(() => { /* fire-and-forget */ });
      } else {
        console.log(`[lg-scan] Background function triggered for profile ${profileId}`);
      }
    } catch (err) {
      console.error("[lg-scan] Failed to trigger background:", err);
      notifyError("lg-scan trigger", err, { profileId, userId: user.id });
    }

    return NextResponse.json({ status: "started", postsToScan: postsToScan.length });
  } catch (err) {
    console.error("[lg-scan] Error:", err);
    notifyError("lg-scan", err, { profileId, userId: user.id });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
