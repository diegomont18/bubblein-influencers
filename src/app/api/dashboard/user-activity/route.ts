import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function getService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getService();
  const { data: role } = await service
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (role?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Fetch in parallel: casting lists, leads scans, lg_profiles, api_costs summary
  const [castingRes, leadsRes, lgProfilesRes, costsRes] = await Promise.all([
    service
      .from("casting_lists")
      .select("id, name, query_theme, created_at")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .from("leads_scans")
      .select("id, post_urls, icp_job_titles, icp_departments, icp_company_size, total_engagers, matched_leads, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .from("lg_profiles")
      .select("id, linkedin_url, name, headline, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .from("api_costs")
      .select("provider, operation, estimated_cost, source, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Aggregate costs
  const costsByProvider: Record<string, number> = {};
  for (const c of (costsRes.data ?? []) as Array<{ provider: string; estimated_cost: number }>) {
    costsByProvider[c.provider] = (costsByProvider[c.provider] ?? 0) + Number(c.estimated_cost);
  }

  return NextResponse.json({
    castingSearches: castingRes.data ?? [],
    leadsScans: leadsRes.data ?? [],
    lgProfiles: lgProfilesRes.data ?? [],
    recentCosts: (costsRes.data ?? []).slice(0, 10),
    costsByProvider,
    totalCost: Object.values(costsByProvider).reduce((s, v) => s + v, 0),
  });
}
