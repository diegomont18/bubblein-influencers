import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { rankPostsForLeadGeneration } from "@/lib/ai";
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

    // Sort by relevance and take top posts
    const sortedPosts = [...posts].sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
    const postsToScan = sortedPosts.filter((p) => (p.relevance_score ?? 0) >= 20 && p.post_url);

    if (postsToScan.length === 0) return NextResponse.json({ error: "No relevant posts found" }, { status: 400 });

    // Fetch options
    const { data: options } = await service.from("lg_options").select("*").eq("profile_id", profileId).single();
    const jobTitles = options?.job_titles ?? [];
    const departments = options?.departments ?? [];
    const maxLeads = credits * 12;

    const scanParams = {
      userId: user.id,
      profileId,
      postsToScan: postsToScan.map((p) => ({ post_url: p.post_url, relevance_score: p.relevance_score })),
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
