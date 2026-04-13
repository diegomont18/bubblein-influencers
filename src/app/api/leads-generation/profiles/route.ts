import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("lg_profiles")
    .select("id, linkedin_url, name, headline, profile_photo, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Try to fetch leads counts (lg_results may not exist yet)
  const leadsCountMap = new Map<string, number>();
  try {
    const profileIds = (data ?? []).map((p) => p.id);
    if (profileIds.length > 0) {
      const { data: results } = await service
        .from("lg_results")
        .select("profile_id")
        .in("profile_id", profileIds);

      if (results) {
        for (const r of results) {
          leadsCountMap.set(r.profile_id, (leadsCountMap.get(r.profile_id) ?? 0) + 1);
        }
      }
    }
  } catch {
    // lg_results table may not exist yet — ignore
  }

  const profiles = (data ?? []).map((p) => ({
    id: p.id,
    linkedin_url: p.linkedin_url,
    name: p.name,
    headline: p.headline,
    profile_photo: p.profile_photo,
    created_at: p.created_at,
    leads_count: leadsCountMap.get(p.id) ?? 0,
  }));

  return NextResponse.json({ profiles });
}
