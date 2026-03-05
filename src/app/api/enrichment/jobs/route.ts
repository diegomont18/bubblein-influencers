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
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const status = searchParams.get("status");

  const service = createServiceClient();
  let query = service
    .from("enrichment_jobs")
    .select("*, profiles(url, name)", { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }

  const from = (page - 1) * limit;
  query = query
    .order("queued_at", { ascending: false })
    .range(from, from + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count ?? 0, page });
}
