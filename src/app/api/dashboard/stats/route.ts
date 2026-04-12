import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const service = createServiceClient();

  // Profile enrichment counts
  const { data: profiles } = await service.from("profiles").select("enrichment_status");
  const profileStats = { pending: 0, processing: 0, done: 0, failed: 0, total: 0 };
  for (const p of profiles ?? []) {
    profileStats.total++;
    const s = p.enrichment_status as keyof typeof profileStats;
    if (s in profileStats && s !== "total") profileStats[s]++;
  }

  // Casting searches count + total results
  const { count: castingCount } = await service
    .from("casting_lists")
    .select("id", { count: "exact", head: true });

  const { data: castingProfiles } = await service
    .from("casting_list_profiles")
    .select("id", { count: "exact", head: true });

  // Leads scans count + total leads
  const { count: leadsScansCount } = await service
    .from("leads_scans")
    .select("id", { count: "exact", head: true });

  const { count: leadsResultsCount } = await service
    .from("leads_results")
    .select("id", { count: "exact", head: true });

  // Users count
  const { data: { users } } = await service.auth.admin.listUsers();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const newUsersLast7Days = (users ?? []).filter((u) => u.created_at && u.created_at >= sevenDaysAgo).length;

  // API costs: today, this week, this month
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: todayCosts } = await service
    .from("api_costs")
    .select("estimated_cost")
    .gte("created_at", todayStart);

  const { data: weekCosts } = await service
    .from("api_costs")
    .select("estimated_cost")
    .gte("created_at", weekStart);

  const { data: monthCosts } = await service
    .from("api_costs")
    .select("estimated_cost")
    .gte("created_at", monthStart);

  const sumCosts = (rows: { estimated_cost: number }[] | null) =>
    (rows ?? []).reduce((sum, r) => sum + Number(r.estimated_cost), 0);

  // Daily costs for last 30 days
  const { data: dailyCostsRaw } = await service
    .from("api_costs")
    .select("estimated_cost, created_at")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true });

  const dailyCosts: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dailyCosts[d.toISOString().slice(0, 10)] = 0;
  }
  for (const row of dailyCostsRaw ?? []) {
    const day = row.created_at.slice(0, 10);
    if (day in dailyCosts) dailyCosts[day] += Number(row.estimated_cost);
  }

  return NextResponse.json({
    profiles: profileStats,
    castingSearches: castingCount ?? 0,
    castingResults: castingProfiles?.length ?? 0,
    leadsScans: leadsScansCount ?? 0,
    leadsResults: leadsResultsCount ?? 0,
    totalUsers: users?.length ?? 0,
    newUsersLast7Days,
    costs: {
      today: sumCosts(todayCosts),
      week: sumCosts(weekCosts),
      month: sumCosts(monthCosts),
    },
    dailyCosts: Object.entries(dailyCosts).map(([date, cost]) => ({ date, cost })),
  });
}
