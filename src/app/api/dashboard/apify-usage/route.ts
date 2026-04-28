import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { checkApifyUsage, readApifyUsageCached, readAllApifyUsageCached } from "@/lib/apify-usage";
import { notifyError } from "@/lib/error-notifier";

export async function GET(request: Request) {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  try {
    if (forceRefresh) {
      await checkApifyUsage();
    }
    const states = await readAllApifyUsageCached();
    // Backwards compatibility: `state` is the first account
    const state = states[0] ?? await readApifyUsageCached();
    return NextResponse.json({ state, states });
  } catch (err) {
    notifyError("dashboard-apify-usage", err);
    return NextResponse.json({ error: "Failed to read Apify usage" }, { status: 500 });
  }
}
