import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const from = (page - 1) * limit;

  const service = createServiceClient();

  // Fetch casting searches
  const { data: castingLists } = await service
    .from("casting_lists")
    .select("id, name, query_theme, created_by, created_at, casting_list_profiles(count)")
    .order("created_at", { ascending: false });

  // Fetch leads scans
  const { data: leadsScans } = await service
    .from("leads_scans")
    .select("id, user_id, post_urls, matched_leads, total_engagers, created_at, status")
    .order("created_at", { ascending: false });

  // Fetch user emails
  const { data: { users } } = await service.auth.admin.listUsers();
  const userMap = new Map((users ?? []).map((u) => [u.id, u.email ?? "unknown"]));

  // Fetch aggregated costs per search_id
  const { data: costsRaw } = await service
    .from("api_costs")
    .select("search_id, estimated_cost");

  const costMap = new Map<string, number>();
  for (const row of costsRaw ?? []) {
    if (!row.search_id) continue;
    costMap.set(row.search_id, (costMap.get(row.search_id) ?? 0) + Number(row.estimated_cost));
  }

  // Combine into unified list
  type SearchEntry = {
    id: string;
    type: "casting" | "leads";
    userEmail: string;
    summary: string;
    resultsCount: number;
    estimatedCost: number;
    createdAt: string;
    status?: string;
  };

  const allSearches: SearchEntry[] = [];

  for (const cl of castingLists ?? []) {
    const profileCount = cl.casting_list_profiles?.[0]?.count ?? 0;
    allSearches.push({
      id: cl.id,
      type: "casting",
      userEmail: userMap.get(cl.created_by ?? "") ?? "unknown",
      summary: cl.query_theme?.split("\n").slice(0, 3).join(", ") ?? cl.name,
      resultsCount: profileCount,
      estimatedCost: costMap.get(cl.id) ?? 0,
      createdAt: cl.created_at,
    });
  }

  for (const ls of leadsScans ?? []) {
    allSearches.push({
      id: ls.id,
      type: "leads",
      userEmail: userMap.get(ls.user_id ?? "") ?? "unknown",
      summary: `${(ls.post_urls ?? []).length} post(s)`,
      resultsCount: ls.matched_leads ?? 0,
      estimatedCost: costMap.get(ls.id) ?? 0,
      createdAt: ls.created_at,
      status: ls.status,
    });
  }

  // Sort by date desc
  allSearches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = allSearches.length;
  const paginated = allSearches.slice(from, from + limit);

  return NextResponse.json({ searches: paginated, total, page });
}
