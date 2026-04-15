import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  const service = createServiceClient();

  // Verify ownership
  const { data: profile } = await service.from("lg_profiles").select("*").eq("id", profileId).eq("user_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch results
  const { data: results } = await service
    .from("lg_results")
    .select("*")
    .eq("profile_id", profileId)
    .order("icp_score", { ascending: false });

  // Fetch posts for reference
  const { data: posts } = await service
    .from("lg_posts")
    .select("id, post_url, text_content, relevance_score")
    .eq("profile_id", profileId)
    .order("relevance_score", { ascending: false });

  // Total tracked posts determines the denominator of `interaction_count`
  // shown in the UI: each post can yield at most 2 interactions (reaction + comment),
  // so `totalPossibleInteractions = totalTrackedPosts * 2`. Computed dynamically so
  // old leads automatically reflect newly tracked posts.
  const totalTrackedPosts = (posts ?? []).length;

  return NextResponse.json({
    results: results ?? [],
    posts: posts ?? [],
    profile,
    scanStatus: profile?.scan_status ?? "idle",
    totalTrackedPosts,
  });
}
