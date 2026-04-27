import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId } = await request.json();
  if (!reportId) return NextResponse.json({ error: "reportId required" }, { status: 400 });

  const service = createServiceClient();

  // Fetch report and verify ownership
  const { data: report } = await service
    .from("sol_reports")
    .select("id, status, profile_id")
    .eq("id", reportId)
    .single();

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: profile } = await service
    .from("lg_profiles")
    .select("id")
    .eq("id", report.profile_id)
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (report.status !== "processing") {
    return NextResponse.json({ error: "Can only cancel processing reports" }, { status: 400 });
  }

  await service.from("sol_reports").update({ status: "cancelled" }).eq("id", reportId);

  return NextResponse.json({ success: true });
}
