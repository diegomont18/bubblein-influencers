import type { Handler } from "@netlify/functions";
import { collectDailyReport, saveDailyReport, sendDailyReportEmail } from "../../src/lib/daily-report";
import { notifyError } from "../../src/lib/error-notifier";

const handler: Handler = async () => {
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

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, reportId, summary: data.summary }),
    };
  } catch (err) {
    console.error("[daily-report] Error:", err);
    notifyError("daily-report", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (err as Error).message }),
    };
  }
};

export { handler };
