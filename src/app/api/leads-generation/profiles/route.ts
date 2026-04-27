import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("lg_profiles")
    .select("id, linkedin_url, name, headline, profile_photo, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch latest sol_report per profile
  const reportMap = new Map<string, { status: string; period_start: string; period_end: string }>();
  try {
    const profileIds = (data ?? []).map((p) => p.id);
    if (profileIds.length > 0) {
      const { data: reports } = await service
        .from("sol_reports")
        .select("profile_id, status, period_start, period_end")
        .in("profile_id", profileIds)
        .order("period_start", { ascending: false });

      if (reports) {
        for (const r of reports) {
          // Keep only the most recent per profile
          if (!reportMap.has(r.profile_id)) {
            reportMap.set(r.profile_id, { status: r.status, period_start: r.period_start, period_end: r.period_end });
          }
        }
      }
    }
  } catch {
    // sol_reports table may not exist yet — ignore
  }

  const profiles = (data ?? []).map((p) => ({
    id: p.id,
    linkedin_url: p.linkedin_url,
    name: p.name,
    headline: p.headline,
    profile_photo: p.profile_photo,
    created_at: p.created_at,
    latest_report: reportMap.get(p.id) ?? null,
  }));

  return NextResponse.json({ profiles });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });

  const service = createServiceClient();

  try {
    const { data: profile, error: fetchError } = await service
      .from("lg_profiles")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { error: deleteError } = await service
      .from("lg_profiles")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      notifyError("leads-generation-profiles-delete", deleteError, { userId: user.id, profileId: id });
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[leads-generation-profiles-delete] Error:", err);
    notifyError("leads-generation-profiles-delete", err, { userId: user.id, profileId: id });
    return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 });
  }
}
