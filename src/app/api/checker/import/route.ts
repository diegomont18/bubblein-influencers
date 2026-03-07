import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const rows: { name: string; headline: string; url: string }[] = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "rows must be a non-empty array" },
      { status: 400 }
    );
  }

  const entries = rows.map((r) => ({
    name: r.name?.trim() || "Unknown",
    headline: r.headline?.trim() || "",
    original_url: r.url?.trim() || "",
    status: "pending",
  }));

  const service = createServiceClient();
  const { error, count } = await service
    .from("checker_entries")
    .insert(entries, { count: "exact" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: count ?? entries.length });
}
