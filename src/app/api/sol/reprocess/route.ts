import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { notifyError } from "@/lib/error-notifier";

export const maxDuration = 30;

/**
 * POST /api/sol/reprocess
 * Re-runs the full SOL pipeline (Phases 1-6) for a report.
 * Admin-only. Deletes existing posts and re-triggers collect-bg.
 */
export async function POST(request: Request) {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { reportId } = (await request.json()) as { reportId: string };
  if (!reportId) {
    return NextResponse.json({ error: "reportId required" }, { status: 400 });
  }

  const service = createServiceClient();

  try {
    // Load report to get profile_id
    const { data: report } = await service
      .from("sol_reports")
      .select("id, profile_id, status")
      .eq("id", reportId)
      .single();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.status === "processing") {
      return NextResponse.json(
        { error: "Report is already processing" },
        { status: 409 },
      );
    }

    // Delete existing posts for this report
    await service.from("sol_posts").delete().eq("report_id", reportId);

    // Reset report state
    await service
      .from("sol_reports")
      .update({
        status: "processing",
        metrics: null,
        recommendations: null,
        raw_data: null,
        ai_incomplete: null,
      })
      .eq("id", reportId);

    // Fire-and-forget background collection (same pattern as generate/route.ts)
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      `http://localhost:${process.env.PORT || 3000}`;
    const bgUrl = `${siteUrl}/api/sol/collect-bg`;

    console.log(
      `[sol-reprocess] Triggering full reprocess at ${bgUrl} for report ${reportId}`,
    );
    fetch(bgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId,
        profileId: report.profile_id,
      }),
      signal: AbortSignal.timeout(600_000),
    }).catch(() => {
      /* fire-and-forget */
    });

    return NextResponse.json({ ok: true, status: "processing" });
  } catch (err) {
    console.error("[sol-reprocess] Error:", err);
    notifyError("sol-reprocess", err, { reportId });
    return NextResponse.json(
      { error: "Failed to reprocess report" },
      { status: 500 },
    );
  }
}
