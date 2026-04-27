import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { profileId } = await request.json();
    if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

    const service = createServiceClient();

    // Verify ownership
    const { data: profile } = await service
      .from("lg_profiles")
      .select("id, linkedin_url")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .single();
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Calculate period: previous complete month
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month

    const periodStartStr = periodStart.toISOString().split("T")[0];
    const periodEndStr = periodEnd.toISOString().split("T")[0];

    // Check if report already exists for this period
    const { data: existing } = await service
      .from("sol_reports")
      .select("id, status")
      .eq("profile_id", profileId)
      .eq("period_start", periodStartStr)
      .eq("period_end", periodEndStr)
      .not("status", "in", '("cancelled","failed")')
      .single();

    if (existing) {
      return NextResponse.json({ reportId: existing.id, status: existing.status });
    }

    // Set confirmed_at on lg_options
    await service
      .from("lg_options")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("profile_id", profileId);

    // Create sol_reports entry
    const { data: report, error: reportError } = await service
      .from("sol_reports")
      .insert({
        profile_id: profileId,
        period_start: periodStartStr,
        period_end: periodEndStr,
        status: "processing",
      })
      .select("id")
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: reportError?.message ?? "Failed to create report" }, { status: 500 });
    }

    // Fire-and-forget background collection
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const bgUrl = `${siteUrl}/api/sol/collect-bg`;

    console.log(`[sol-generate] Triggering background collection at ${bgUrl} for report ${report.id}`);
    fetch(bgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: report.id, profileId }),
      signal: AbortSignal.timeout(600_000),
    }).catch(() => { /* fire-and-forget */ });

    return NextResponse.json({ reportId: report.id, status: "processing" });
  } catch (err) {
    console.error("[sol-generate] Error:", err);
    notifyError("sol-generate", err, { userId: user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
