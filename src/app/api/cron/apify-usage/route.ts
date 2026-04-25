import { NextResponse } from "next/server";
import { checkApifyUsage } from "@/lib/apify-usage";
import { notifyError } from "@/lib/error-notifier";

export async function POST(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const state = await checkApifyUsage();
    return NextResponse.json({
      ok: true,
      pct: state.pct,
      usd: state.monthly_usage_usd,
      max: state.max_monthly_usage_usd,
      checked_at: state.checked_at,
    });
  } catch (err) {
    console.error("[apify-usage-check] Error:", err);
    notifyError("apify-usage-check", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
