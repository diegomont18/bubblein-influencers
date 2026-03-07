import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 10000);
  const sortBy = searchParams.get("sort_by") ?? "created_at";
  const sortDir = searchParams.get("sort_dir") === "asc" ? "asc" : "desc";

  const SORTABLE = new Set(["name", "headline", "original_url", "status", "created_at"]);
  const column = SORTABLE.has(sortBy) ? sortBy : "created_at";

  const service = createServiceClient();
  const from = (page - 1) * limit;

  const { data, count, error } = await service
    .from("checker_entries")
    .select("*", { count: "exact" })
    .order(column, { ascending: sortDir === "asc" })
    .range(from, from + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count ?? 0, page });
}

export async function DELETE(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const ids: string[] | undefined = body.ids;

  const service = createServiceClient();

  if (ids && Array.isArray(ids) && ids.length > 0) {
    const { error, count } = await service
      .from("checker_entries")
      .delete({ count: "exact" })
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ deleted: count ?? 0 });
  }

  // Delete all
  const { error, count } = await service
    .from("checker_entries")
    .delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: count ?? 0 });
}
