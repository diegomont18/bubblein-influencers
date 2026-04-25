import { NextResponse } from "next/server";
import { collectDailyReport, saveDailyReport, sendDailyReportEmail } from "@/lib/daily-report";
import { notifyError } from "@/lib/error-notifier";

export async function POST(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

    console.log(`[daily-report] Collecting report for ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

    const data = await collectDailyReport(periodStart, periodEnd);
    console.log(`[daily-report] Summary: ${data.summary.newUsersCount} new users, ${data.summary.totalActions} actions, $${data.summary.totalCostUsd.toFixed(4)}`);

    const reportId = await saveDailyReport(periodStart, periodEnd, data);
    console.log(`[daily-report] Saved report ${reportId}`);

    await sendDailyReportEmail(periodStart, periodEnd, data, reportId);
    console.log(`[daily-report] Email sent`);

    return NextResponse.json({ ok: true, reportId, summary: data.summary });
  } catch (err) {
    console.error("[daily-report] Error:", err);
    notifyError("daily-report", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
