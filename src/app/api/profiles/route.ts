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
  const name = searchParams.get("name");
  const topic = searchParams.get("topic");
  const company = searchParams.get("company");
  const role = searchParams.get("role");
  const followersMin = searchParams.get("followers_min");
  const followersMax = searchParams.get("followers_max");
  const status = searchParams.get("status");
  const tag = searchParams.get("tag");
  const sortByParam = searchParams.get("sort_by");
  const sortDirParam = searchParams.get("sort_dir");

  const SORTABLE_COLUMNS = new Set([
    "name", "headline", "company_current", "current_job",
    "followers_count", "posting_frequency_score", "avg_likes_per_post", "avg_comments_per_post",
    "enrichment_status", "created_at", "last_enriched_at",
  ]);
  const sortBy = sortByParam && SORTABLE_COLUMNS.has(sortByParam) ? sortByParam : "created_at";
  const sortDir = sortDirParam === "asc" ? "asc" : "desc";

  const service = createServiceClient();
  let query = service.from("profiles").select("*", { count: "exact" });

  if (name) {
    query = query.or(`name.ilike.%${name}%,url.ilike.%${name}%`);
  }
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
  if (tag === "__none__") {
    query = query.eq("tags", "{}");
  } else if (tag) {
    query = query.contains("tags", [tag]);
  }

  const from = (page - 1) * limit;
  query = query
    .order(sortBy, { ascending: sortDir === "asc" })
    .range(from, from + limit - 1);

  const { data, count, error } = await query;

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

  const { profile_ids } = await request.json();

  if (!Array.isArray(profile_ids) || profile_ids.length === 0) {
    return NextResponse.json(
      { error: "profile_ids must be a non-empty array" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Delete related records first, then profiles
  await service
    .from("profile_experiences")
    .delete()
    .in("profile_id", profile_ids);

  await service
    .from("enrichment_jobs")
    .delete()
    .in("profile_id", profile_ids);

  const { error, count } = await service
    .from("profiles")
    .delete({ count: "exact" })
    .in("id", profile_ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: count ?? 0 });
}
