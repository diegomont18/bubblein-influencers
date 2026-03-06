import { createServerClient, createServiceClient } from "@/lib/supabase/server";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(fields: string[]): string {
  return fields.map((f) => escapeCsvField(f)).join(",");
}

export async function GET(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic");
  const company = searchParams.get("company");
  const role = searchParams.get("role");
  const followersMin = searchParams.get("followers_min");
  const followersMax = searchParams.get("followers_max");
  const status = searchParams.get("status");
  const tag = searchParams.get("tag");

  const service = createServiceClient();
  let query = service
    .from("profiles")
    .select(
      "name, url, headline, company_current, role_current, current_job, location, followers_count, connections_count, topics, tags, posting_frequency_score, enrichment_status, last_enriched_at"
    );

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

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("[Export CSV] Supabase error:", error.message, { code: error.code, details: error.details, hint: error.hint });
    return new Response("Export failed", { status: 500 });
  }

  console.log("[Export CSV] Success", { rowCount: data?.length ?? 0, filters: { topic, company, role, followersMin, followersMax, status, tag } });

  const headers = [
    "Name",
    "LinkedIn URL",
    "Headline",
    "Company",
    "Role",
    "Current Job",
    "Location",
    "Followers",
    "Connections",
    "Topics",
    "Tags",
    "Posting Frequency",
    "Enrichment Status",
    "Last Enriched At",
  ];

  const rows = (data ?? []).map((row) =>
    toCsvRow([
      row.name ?? "",
      row.url ?? "",
      row.headline ?? "",
      row.company_current ?? "",
      row.role_current ?? "",
      row.current_job ?? "",
      row.location ?? "",
      row.followers_count != null ? String(row.followers_count) : "",
      row.connections_count != null ? String(row.connections_count) : "",
      (row.topics ?? []).join("; "),
      (row.tags ?? []).join("; "),
      row.posting_frequency_score != null ? String(row.posting_frequency_score) : "",
      row.enrichment_status ?? "",
      row.last_enriched_at ?? "",
    ])
  );

  const csv = [toCsvRow(headers), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="profiles-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
