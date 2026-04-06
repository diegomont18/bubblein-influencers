import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Look up share
  const { data: share, error: shareError } = await service
    .from("campaign_shares")
    .select("*, campaigns(name)")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (shareError || !share) {
    return NextResponse.json({ error: "Link não encontrado ou expirado" }, { status: 404 });
  }

  // Increment views
  await service
    .from("campaign_shares")
    .update({ views_count: (share.views_count ?? 0) + 1 })
    .eq("id", share.id);

  // Fetch casting lists for this user, optionally filtered by campaign
  let listsQuery = service
    .from("casting_lists")
    .select("id, name, campaign_id")
    .eq("created_by", share.user_id)
    .eq("status", "complete");

  if (share.campaign_id) {
    listsQuery = listsQuery.eq("campaign_id", share.campaign_id);
  }

  const { data: lists } = await listsQuery;

  if (!lists || lists.length === 0) {
    // Fetch campaigns for filter
    let campaignsQuery = service
      .from("campaigns")
      .select("id, name")
      .eq("user_id", share.user_id)
      .order("created_at", { ascending: true });

    if (share.campaign_id) {
      campaignsQuery = campaignsQuery.eq("id", share.campaign_id);
    }

    const { data: campaigns } = await campaignsQuery;

    return NextResponse.json({
      profiles: [],
      campaigns: campaigns ?? [],
      share: {
        label: share.label,
        campaignId: share.campaign_id,
        campaignName: share.campaigns?.name ?? null,
      },
    });
  }

  // Fetch all profiles for those lists
  const listIds = lists.map((l) => l.id);
  const { data: rawProfiles } = await service
    .from("casting_list_profiles")
    .select("profile_id, notes, list_id")
    .in("list_id", listIds)
    .order("rank_position", { ascending: true });

  // Build profile data with campaign_id from list
  const listCampaignMap: Record<string, string | null> = {};
  for (const l of lists) {
    listCampaignMap[l.id] = l.campaign_id;
  }

  const profiles = (rawProfiles ?? []).map((p) => {
    try {
      const notes = typeof p.notes === "string" ? JSON.parse(p.notes) : p.notes;
      return {
        slug: p.profile_id,
        name: notes?.name ?? "Unknown",
        headline: notes?.headline ?? "",
        job_title: notes?.job_title ?? "",
        company: notes?.company ?? "",
        location: notes?.location ?? "",
        followers: notes?.followers ?? 0,
        followers_range: notes?.followers_range ?? undefined,
        posts_per_month: notes?.posts_per_month ?? 0,
        avg_likes_per_post: notes?.avg_likes_per_post ?? null,
        avg_comments_per_post: notes?.avg_comments_per_post ?? null,
        median_likes_per_post: notes?.median_likes_per_post ?? null,
        median_comments_per_post: notes?.median_comments_per_post ?? null,
        creator_score: notes?.creator_score ?? null,
        topics: notes?.topics ?? [],
        final_score: notes?.final_score ?? undefined,
        linkedin_url: notes?.linkedin_url ?? `https://linkedin.com/in/${p.profile_id}`,
        focus: notes?.focus ?? null,
        source_keyword: notes?.source_keyword ?? undefined,
        profile_photo: notes?.profile_photo ?? "",
        found_at: notes?.found_at ?? undefined,
        campaign_id: listCampaignMap[p.list_id] ?? null,
      };
    } catch {
      return {
        slug: p.profile_id,
        name: "Unknown",
        headline: "",
        job_title: "",
        company: "",
        location: "",
        followers: 0,
        posts_per_month: 0,
        linkedin_url: `https://linkedin.com/in/${p.profile_id}`,
        campaign_id: listCampaignMap[p.list_id] ?? null,
      };
    }
  });

  // Deduplicate profiles by slug (keep first occurrence)
  const seen = new Set<string>();
  const uniqueProfiles = profiles.filter((p) => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });

  // Fetch campaigns for filter
  let campaignsQuery = service
    .from("campaigns")
    .select("id, name")
    .eq("user_id", share.user_id)
    .order("created_at", { ascending: true });

  if (share.campaign_id) {
    campaignsQuery = campaignsQuery.eq("id", share.campaign_id);
  }

  const { data: campaigns } = await campaignsQuery;

  return NextResponse.json({
    profiles: uniqueProfiles,
    campaigns: campaigns ?? [],
    share: {
      label: share.label,
      campaignId: share.campaign_id,
      campaignName: share.campaigns?.name ?? null,
    },
  });
}
