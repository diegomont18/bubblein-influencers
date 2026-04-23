import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const provider = searchParams.get("provider");
  const source = searchParams.get("source");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const from = (page - 1) * limit;

  const service = createServiceClient();

  // Build filtered query
  let query = service
    .from("api_costs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (provider) query = query.eq("provider", provider);
  if (source) query = query.eq("source", source);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59Z");

  query = query.range(from, from + limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch user emails
  const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id).filter(Boolean)));
  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: { users } } = await service.auth.admin.listUsers();
    userMap = new Map((users ?? []).map((u) => [u.id, u.email ?? "unknown"]));
  }

  // Enrich with email
  const costs = (data ?? []).map((r) => ({
    ...r,
    user_email: r.user_id ? userMap.get(r.user_id) ?? "unknown" : "system",
  }));

  // Totals query (unfiltered for summary, but respect date filters)
  let totalsQuery = service.from("api_costs").select("user_id, provider, source, operation, estimated_cost, credits_used, created_at");
  if (dateFrom) totalsQuery = totalsQuery.gte("created_at", dateFrom);
  if (dateTo) totalsQuery = totalsQuery.lte("created_at", dateTo + "T23:59:59Z");

  const { data: allCosts } = await totalsQuery;

  const totals = {
    total: 0,
    byProvider: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
  };

  for (const r of allCosts ?? []) {
    const cost = Number(r.estimated_cost);
    totals.total += cost;
    totals.byProvider[r.provider] = (totals.byProvider[r.provider] ?? 0) + cost;
    totals.bySource[r.source] = (totals.bySource[r.source] ?? 0) + cost;
  }

  // Fetch all user emails for grouped view
  const { data: { users: allUsers } } = await service.auth.admin.listUsers();
  const allUserMap = new Map((allUsers ?? []).map((u) => [u.id, u.email ?? "unknown"]));

  // Grouped by user + operation (for summary tab)
  const groupedMap = new Map<string, { provider: string; source: string; operation: string; user_id: string; user_email: string; total_cost: number; total_credits: number; call_count: number; last_used: string }>();
  for (const r of allCosts ?? []) {
    const uid = r.user_id ?? "system";
    const key = `${uid}::${r.provider}::${r.source}::${r.operation}`;
    const existing = groupedMap.get(key);
    const cost = Number(r.estimated_cost);
    const credits = Number(r.credits_used ?? 0);
    if (existing) {
      existing.total_cost += cost;
      existing.total_credits += credits;
      existing.call_count++;
      if (r.created_at > existing.last_used) existing.last_used = r.created_at;
    } else {
      groupedMap.set(key, {
        provider: r.provider, source: r.source, operation: r.operation,
        user_id: uid, user_email: uid === "system" ? "system" : allUserMap.get(uid) ?? "unknown",
        total_cost: cost, total_credits: credits, call_count: 1, last_used: r.created_at,
      });
    }
  }
  const grouped = Array.from(groupedMap.values()).sort((a, b) => new Date(b.last_used).getTime() - new Date(a.last_used).getTime());

  return NextResponse.json({ costs, total: count ?? 0, page, totals, grouped });
}
