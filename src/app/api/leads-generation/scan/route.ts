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

    // Sort by relevance and filter to unscanned posts only
    const sortedPosts = [...posts].sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
    let postsToScan = sortedPosts.filter((p) => (p.relevance_score ?? 0) >= 20 && p.post_url && !p.scanned);

    // If all posts already scanned, fetch more from LinkedIn
    if (postsToScan.length === 0) {
      const { data: lgProfile } = await service.from("lg_profiles").select("linkedin_url").eq("id", profileId).single();
      if (lgProfile?.linkedin_url) {
        // Fetch more posts than we already have to get older ones
        const existingCount = posts.length;
        const fetchCount = Math.max(existingCount + 10, 30);
        console.log(`[lg-scan] All ${existingCount} posts scanned, fetching ${fetchCount} from ${lgProfile.linkedin_url}...`);
        const rawPosts = await fetchProfilePosts(lgProfile.linkedin_url, fetchCount);
        logApiCost({ userId: user.id, source: "leads", searchId: profileId, provider: "apify", operation: "fetchProfilePosts", estimatedCost: API_COSTS.apify.fetchProfilePosts, metadata: { postsFound: rawPosts.length } });

        const existingUrls = new Set(posts.map((p) => p.post_url).filter(Boolean));
        const newPosts = rawPosts.map((p) => {
          const url = String(p.postUrl ?? p.permalink ?? p.shareUrl ?? "");
          const shareUrn = String(p.shareUrn ?? p.entityId ?? "");
          const postUrl = url.includes("linkedin.com") ? url : shareUrn.includes("urn:li:") ? `https://www.linkedin.com/feed/update/${shareUrn}` : "";
          return {
            profile_id: profileId,
            post_url: postUrl,
            text_content: String(p.content ?? p.text ?? p.postText ?? ""),
            reactions: 0,
            comments: 0,
            posted_at: String(p.postedAt ?? p.publishedAt ?? ""),
            raw_data: p,
          };
        }).filter((p) => p.post_url && !existingUrls.has(p.post_url));

        if (newPosts.length > 0) {
          await service.from("lg_posts").insert(newPosts);
          // Rank the new posts
          const postsForRanking = newPosts.map((p, i) => ({ id: `new-${i}`, text: p.text_content }));
          const scores = await rankPostsForLeadGeneration(postsForRanking);
          // Re-fetch all posts to get the IDs
          const { data: allPosts } = await service.from("lg_posts").select("*").eq("profile_id", profileId);
          const unranked = (allPosts ?? []).filter((p) => p.relevance_score == null);
          for (const p of unranked) {
            const score = scores.get(p.id) ?? 50;
            await service.from("lg_posts").update({ relevance_score: score }).eq("id", p.id);
          }
          const freshSorted = (allPosts ?? []).sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
          postsToScan = freshSorted.filter((p) => (p.relevance_score ?? 0) >= 20 && p.post_url && !p.scanned);
        }
      }
    }

    // If still no unscanned posts, keep trying with even more posts from LinkedIn
    if (postsToScan.length === 0) {
      // Re-fetch all posts and try again (new posts may have been inserted above)
      const { data: refreshedPosts } = await service.from("lg_posts").select("*").eq("profile_id", profileId);
      const refreshedSorted = (refreshedPosts ?? []).sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
      postsToScan = refreshedSorted.filter((p) => (p.relevance_score ?? 0) >= 20 && p.post_url && p.scanned !== true);
    }

    if (postsToScan.length === 0) return NextResponse.json({ error: "Não há mais posts novos para analisar neste perfil. Todos os posts disponíveis já foram escaneados." }, { status: 400 });

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
