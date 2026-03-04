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
  const topic = searchParams.get("topic");
  const company = searchParams.get("company");
  const role = searchParams.get("role");
  const followersMin = searchParams.get("followers_min");
  const followersMax = searchParams.get("followers_max");
  const status = searchParams.get("status");

  const service = createServiceClient();
  let query = service.from("profiles").select("*", { count: "exact" });

  if (topic) {
    query = query.contains("topics", [topic]);
  }
  if (company) {
    query = query.ilike("company_current", `%${company}%`);
  }
  if (role) {
    query = query.ilike("role_current", `%${role}%`);
  }
  if (followersMin) {
    query = query.gte("followers_count", parseInt(followersMin, 10));
  }
  if (followersMax) {
    query = query.lte("followers_count", parseInt(followersMax, 10));
  }
  if (status) {
    query = query.eq("enrichment_status", status);
  }

  const from = (page - 1) * limit;
  query = query
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count ?? 0, page });
}
