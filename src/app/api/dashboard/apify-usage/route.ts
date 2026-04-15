import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { checkApifyUsage, readApifyUsageCached } from "@/lib/apify-usage";
import { notifyError } from "@/lib/error-notifier";

// GET  /api/dashboard/apify-usage            — read cached state
// POST /api/dashboard/apify-usage/refresh    — force refresh (handled by ?refresh=1)
export async function GET(request: Request) {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  try {
    const state = forceRefresh
      ? await checkApifyUsage()
      : await readApifyUsageCached();
    return NextResponse.json({ state });
  } catch (err) {
    notifyError("dashboard-apify-usage", err);
    return NextResponse.json({ error: "Failed to read Apify usage" }, { status: 500 });
  }
}
