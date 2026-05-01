import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import {
  assertCanRead,
  respondAccessError,
  ResourceAccessError,
} from "@/lib/resource-access";

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

  try {
    const access = await assertCanRead(user.id, "lg_profile", report.profile_id);

    const { data: profile } = await service
      .from("lg_profiles")
      .select("id, name, linkedin_url")
      .eq("id", report.profile_id)
      .single();

    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: options } = await service
      .from("lg_options")
      .select("competitors, employee_profiles, ai_response, market_context, proprietary_brands")
      .eq("profile_id", report.profile_id)
      .single();

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
      accessRole: access.role,
    });
  } catch (err) {
    if (err instanceof ResourceAccessError) {
      return respondAccessError(err);
    }
    throw err;
  }
}
