import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import {
  getAccessibleIds,
  getUserBasic,
  type Scope,
} from "@/lib/resource-access";

export async function GET(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scope = (searchParams.get("scope") as Scope) ?? "all";
  const validScope: Scope = ["mine", "shared", "all"].includes(scope)
    ? scope
    : "all";

  const service = createServiceClient();

  const { ownIds, sharedIds } = await getAccessibleIds(
    user.id,
    "leads_scan",
    validScope
  );
  const ids = [...ownIds, ...sharedIds.map((s) => s.id)];

  if (ids.length === 0) {
    return NextResponse.json({ scans: [] });
  }

  const { data: scans, error } = await service
    .from("leads_scans")
    .select(
      "id, post_urls, icp_job_titles, icp_departments, icp_company_size, total_engagers, matched_leads, status, created_at, icp_profile_id, url_profile_id, icp_profiles(name), url_profiles(name)"
    )
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sharedById = new Map(sharedIds.map((s) => [s.id, s]));
  const ownerIds = Array.from(
    new Set(sharedIds.map((s) => s.ownerId).filter(Boolean))
  );
  const ownerInfoById = new Map<
    string,
    { id: string; email: string; name: string | null }
  >();
  for (const ownerId of ownerIds) {
    const info = await getUserBasic(ownerId);
    if (info) ownerInfoById.set(ownerId, info);
  }

  const scansWithLeads = await Promise.all(
    (scans ?? []).map(async (scan: Record<string, unknown>) => {
      const { data: results } = await service
        .from("leads_results")
        .select("*")
        .eq("scan_id", scan.id as string)
        .order("created_at", { ascending: true });

      const leads = (results ?? []).map((r: Record<string, unknown>) => {
        try {
          const notes =
            typeof r.notes === "string"
              ? JSON.parse(r.notes as string)
              : r.notes;
          return { ...notes, slug: r.profile_slug };
        } catch {
          return { slug: r.profile_slug, ...r };
        }
      });

      const shared = sharedById.get(scan.id as string);
      const access = shared
        ? {
            accessRole: shared.role,
            owner: ownerInfoById.get(shared.ownerId) ?? null,
          }
        : { accessRole: "owner" as const, owner: null };

      return { ...scan, leads, ...access };
    })
  );

  return NextResponse.json({ scans: scansWithLeads });
}
