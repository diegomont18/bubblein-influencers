import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { rankPostsForLeadGeneration } from "@/lib/ai";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { notifyError } from "@/lib/error-notifier";
import { isApifyBlocked } from "@/lib/apify-usage";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (await isApifyBlocked()) {
    return NextResponse.json(
      { error: "Limite mensal de créditos Apify atingido. Contate o admin." },
      { status: 503 }
    );
  }

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

    // Use existing posts for scanning
    const posts = existingPosts ?? [];
    if (posts.length === 0) return NextResponse.json({ error: "No posts found" }, { status: 400 });

    // Rank posts if needed
    const unrankedPosts = posts.filter((p) => p.relevance_score == null);
    if (unrankedPosts.length > 0) {
      const postsForRanking = unrankedPosts.map((p) => ({ id: p.id, text: p.text_content ?? "" }));
      const scores = await rankPostsForLeadGeneration(postsForRanking);
      logApiCost({ userId: user.id, source: "leads", searchId: profileId, provider: "openrouter", operation: "rankPostsForLeadGeneration", estimatedCost: API_COSTS.openrouter.classifyTopics });
      for (const p of unrankedPosts) {
        const score = scores.get(p.id) ?? 50;
        await service.from("lg_posts").update({ relevance_score: score }).eq("id", p.id);
        p.relevance_score = score;
      }
    }

    // All relevant posts (bg function handles engager deduplication)
    const postsToScan = posts.filter((p) => p.post_url).sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));

    if (postsToScan.length === 0) {
      return NextResponse.json({ error: "Não há posts para analisar" }, { status: 400 });
    }

    // Build existing URN IDs for bg function to know which posts are already stored
    const existingUrnIds = posts.map((p) => {
      const match = (p.post_url ?? "").match(/(\d{10,})/);
      return match ? match[1] : "";
    }).filter(Boolean);

    console.log(`[lg-scan] isRepeatScan=${isRepeatScan}, posts=${postsToScan.length}, existingLeads=${existingLeadsCount}`);

    // Fetch options
    const { data: options } = await service.from("lg_options").select("*").eq("profile_id", profileId).single();
    const jobTitles = options?.job_titles ?? [];
    const departments = options?.departments ?? [];
    const maxLeads = credits * 12;

    const scanParams = {
      userId: user.id,
      profileId,
      postsToScan: postsToScan.map((p) => ({ id: p.id, post_url: p.post_url, relevance_score: p.relevance_score })),
      fetchMorePosts: isRepeatScan,
      linkedinUrl: profile.linkedin_url,
      existingPostUrns: existingUrnIds,
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

    return NextResponse.json({ status: "started", postsToScan: postsToScan.length, isRepeatScan, fetchMorePosts: isRepeatScan });
  } catch (err) {
    console.error("[lg-scan] Error:", err);
    notifyError("lg-scan", err, { profileId, userId: user.id });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
