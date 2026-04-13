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
  const { data: profile } = await service.from("lg_profiles").select("id").eq("id", profileId).eq("user_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find ALL casting_lists that belong to this profile (via filters_applied.lgProfileId)
  const { data: castingLists } = await service
    .from("casting_lists")
    .select("id, status")
    .eq("created_by", user.id)
    .filter("filters_applied->>lgProfileId", "eq", profileId);

  if (!castingLists || castingLists.length === 0) {
    return NextResponse.json({ profiles: [], listIds: [], hasProcessing: false });
  }

  const listIds = castingLists.map((l) => l.id);
  const hasProcessing = castingLists.some((l) => l.status === "processing");

  // Fetch ALL profiles from ALL lists, deduplicate by slug
  const { data: allProfiles } = await service
    .from("casting_list_profiles")
    .select("*")
    .in("list_id", listIds)
    .order("rank_position", { ascending: true });

  const seen = new Set<string>();
  const profiles = (allProfiles ?? []).map((p) => {
    try {
      const notes = typeof p.notes === "string" ? JSON.parse(p.notes) : p.notes;
      return { ...notes, slug: p.profile_id, focus: p.focus ?? notes?.focus };
    } catch {
      return { slug: p.profile_id, ...p };
    }
  }).filter((p) => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });

  return NextResponse.json({ profiles, listIds, hasProcessing });
}
