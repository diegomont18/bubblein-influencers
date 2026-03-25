import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const service = createServiceClient();

  // Fetch all casting lists with profile counts
  const { data: lists, error } = await service
    .from("casting_lists")
    .select("id, name, query_theme, filters_applied, created_by, created_at, casting_list_profiles(count)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build user email map
  const { data: { users } } = await service.auth.admin.listUsers();
  const emailMap = new Map(users.map((u) => [u.id, u.email ?? "—"]));

  const searches = (lists ?? []).map((l) => ({
    id: l.id,
    keywords: l.query_theme ?? "",
    userEmail: emailMap.get(l.created_by) ?? "—",
    createdAt: l.created_at,
    profilesFetched: l.casting_list_profiles?.[0]?.count ?? 0,
    resultsRequested: (l.filters_applied as Record<string, unknown>)?.resultsCount ?? "—",
  }));

  return NextResponse.json({ searches });
}
