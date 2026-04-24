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

  const { data: options } = await service.from("lg_options").select("*").eq("profile_id", profileId).single();
  const { data: profileData } = await service.from("lg_profiles").select("*").eq("id", profileId).single();

  // Count influencers from ALL casting_lists for this profile
  let influencerCount = 0;
  try {
    const { data: castingLists } = await service
      .from("casting_lists")
      .select("id")
      .eq("created_by", user.id)
      .filter("filters_applied->>lgProfileId", "eq", profileId);

    if (castingLists && castingLists.length > 0) {
      const listIds = castingLists.map((l) => l.id);
      const { count } = await service
        .from("casting_list_profiles")
        .select("id", { count: "exact", head: true })
        .in("list_id", listIds);
      influencerCount = count ?? 0;
    }
  } catch { /* ignore */ }

  return NextResponse.json({ options, profile: profileData, influencerCount });
}

export async function PATCH(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { profileId, market_context, job_titles, departments, company_sizes,
    competitors, employee_profiles, icp_description,
    proprietary_brands, company_posts_per_month } = body;
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  const service = createServiceClient();

  // Verify ownership
  const { data: profile } = await service.from("lg_profiles").select("id").eq("id", profileId).eq("user_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (market_context !== undefined) update.market_context = market_context;
  if (job_titles !== undefined) update.job_titles = job_titles;
  if (departments !== undefined) update.departments = departments;
  if (company_sizes !== undefined) update.company_sizes = company_sizes;
  // Share of LinkedIn fields
  if (competitors !== undefined) update.competitors = competitors;
  if (employee_profiles !== undefined) update.employee_profiles = employee_profiles;
  if (icp_description !== undefined) update.icp_description = icp_description;
  if (proprietary_brands !== undefined) update.proprietary_brands = proprietary_brands;
  if (company_posts_per_month !== undefined) update.company_posts_per_month = company_posts_per_month;

  const { error } = await service.from("lg_options").update(update).eq("profile_id", profileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
