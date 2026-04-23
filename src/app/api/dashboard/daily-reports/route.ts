import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function getService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getService();
  const { data: role } = await service
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (role?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const type = req.nextUrl.searchParams.get("type") || "";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 30, 90);

  let query = service
    .from("daily_reports")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq("report_type", type);
  }

  const { data: reports, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reports: reports ?? [] });
}
