import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyError } from "@/lib/error-notifier";

const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
  let recovered = 0;

  try {
    // Casting lists stuck in "processing"
    const { data: staleCasting } = await service
      .from("casting_lists")
      .select("id")
      .eq("status", "processing")
      .lt("created_at", cutoff);

    if (staleCasting && staleCasting.length > 0) {
      const ids = staleCasting.map((r: { id: string }) => r.id);
      await service
        .from("casting_lists")
        .update({ status: "error", error_message: "Recovered: job stuck for >15min" })
        .in("id", ids);
      recovered += ids.length;
      console.log(`[recover-stale] Casting lists recovered: ${ids.length}`);
    }

    // Leads scans stuck in "processing"
    const { data: staleLeads } = await service
      .from("leads_scans")
      .select("id")
      .eq("status", "processing")
      .lt("created_at", cutoff);

    if (staleLeads && staleLeads.length > 0) {
      const ids = staleLeads.map((r: { id: string }) => r.id);
      await service
        .from("leads_scans")
        .update({ status: "error", error_message: "Recovered: job stuck for >15min" })
        .in("id", ids);
      recovered += ids.length;
      console.log(`[recover-stale] Leads scans recovered: ${ids.length}`);
    }

    // LG profiles stuck in "scanning"
    const { data: staleLg } = await service
      .from("lg_profiles")
      .select("id")
      .eq("scan_status", "scanning")
      .lt("updated_at", cutoff);

    if (staleLg && staleLg.length > 0) {
      const ids = staleLg.map((r: { id: string }) => r.id);
      await service
        .from("lg_profiles")
        .update({ scan_status: "error" })
        .in("id", ids);
      recovered += ids.length;
      console.log(`[recover-stale] LG profiles recovered: ${ids.length}`);
    }

    if (recovered > 0) {
      notifyError("recover-stale-jobs (not an error)", new Error(`Recovered ${recovered} stale jobs`), { recovered });
    }

    console.log(`[recover-stale] Done. ${recovered} total recovered.`);
    return NextResponse.json({ ok: true, recovered });
  } catch (err) {
    console.error("[recover-stale] Error:", err);
    notifyError("recover-stale-jobs", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
