import type { Handler } from "@netlify/functions";
import { checkApifyUsage } from "../../src/lib/apify-usage";
import { notifyError } from "../../src/lib/error-notifier";

// Scheduled function: refreshes the Apify billing-cycle usage snapshot and
// fires threshold alerts (70 / 85 / 95%). Runs every 15 minutes — see
// netlify.toml. Also callable directly via HTTP for manual "refresh now"
// from the admin panel.
const handler: Handler = async () => {
  try {
    const state = await checkApifyUsage();
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        pct: state.pct,
        usd: state.monthly_usage_usd,
        max: state.max_monthly_usage_usd,
        checked_at: state.checked_at,
      }),
    };
  } catch (err) {
    console.error("[apify-usage-check] Error:", err);
    notifyError("apify-usage-check", err);
    return { statusCode: 500, body: "error" };
  }
};

export { handler };
