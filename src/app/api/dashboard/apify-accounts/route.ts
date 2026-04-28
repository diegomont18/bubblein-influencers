import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdmin } from "@/lib/auth/check-admin";
import { notifyError } from "@/lib/error-notifier";

function getService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { data, error } = await getService()
      .from("apify_accounts")
      .select("id, label, env_key, enabled, created_at")
      .order("id");

    if (error) throw error;
    return NextResponse.json({ accounts: data ?? [] });
  } catch (err) {
    notifyError("dashboard-apify-accounts-get", err);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const body = await request.json();
    const { id, enabled } = body as { id: number; enabled: boolean };

    if (typeof id !== "number" || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { error } = await getService()
      .from("apify_accounts")
      .update({ enabled })
      .eq("id", id);

    if (error) throw error;

    // Invalidate the in-memory token cache
    const { invalidateApifyAccountsCache } = await import("@/lib/apify");
    invalidateApifyAccountsCache();

    return NextResponse.json({ ok: true });
  } catch (err) {
    notifyError("dashboard-apify-accounts-patch", err);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}
