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
    .select("*")
    .eq("id", reportId)
    .single();

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify ownership
  const { data: profile } = await service
    .from("lg_profiles")
    .select("id, name, linkedin_url")
    .eq("id", report.profile_id)
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch options for context (company info, competitors)
  const { data: options } = await service
    .from("lg_options")
    .select("competitors, employee_profiles, ai_response, market_context")
    .eq("profile_id", report.profile_id)
    .single();

  // Fetch all posts for this report
  const { data: posts } = await service
    .from("sol_posts")
    .select("*")
    .eq("report_id", reportId)
    .order("posted_at", { ascending: false });

  return NextResponse.json({
    report,
    profile,
    options,
    posts: posts ?? [],
  });
}
