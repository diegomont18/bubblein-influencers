import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { reportId: string } }
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId } = params;
  const service = createServiceClient();

  const { data: report } = await service
    .from("sol_reports")
    .select("id, status, period_start, period_end, created_at, profile_id")
    .eq("id", reportId)
    .single();

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify ownership
  const { data: profile } = await service
    .from("lg_profiles")
    .select("id")
    .eq("id", report.profile_id)
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Count posts collected so far
  const { count } = await service
    .from("sol_posts")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId);

  return NextResponse.json({
    status: report.status,
    period_start: report.period_start,
    period_end: report.period_end,
    created_at: report.created_at,
    posts_collected: count ?? 0,
  });
}
