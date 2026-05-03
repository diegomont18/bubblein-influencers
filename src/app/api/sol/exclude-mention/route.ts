import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";

/**
 * POST /api/sol/exclude-mention
 * Removes a SOV mention by post_url from raw_data.sov.mentions and recalculates totals.
 * Body: { reportId, postUrl: string }
 */
export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId, postUrl } = await request.json() as {
    reportId: string;
    postUrl: string;
  };

  if (!reportId || !postUrl) {
    return NextResponse.json({ error: "reportId and postUrl required" }, { status: 400 });
  }

  const service = createServiceClient();

  try {
    const { data: report } = await service
      .from("sol_reports")
      .select("id, raw_data")
      .eq("id", reportId)
      .single();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const rawData = (report.raw_data ?? {}) as Record<string, unknown>;
    const sov = (rawData.sov ?? {}) as {
      totals_by_company?: Record<string, { positivo: number; neutro: number; negativo: number; brand_owner: string }>;
      mentions?: Array<{ post_url: string; company_name: string; sentiment: string; [k: string]: unknown }>;
    };

    // Remove the mention
    const mentions = (sov.mentions ?? []).filter((m) => m.post_url !== postUrl);

    // Recalculate totals_by_company from remaining mentions
    const totals: Record<string, { positivo: number; neutro: number; negativo: number; brand_owner: string }> = {};
    for (const m of mentions) {
      if (!totals[m.company_name]) {
        const existing = sov.totals_by_company?.[m.company_name];
        totals[m.company_name] = { positivo: 0, neutro: 0, negativo: 0, brand_owner: existing?.brand_owner ?? "competitor" };
      }
      const s = m.sentiment as "positivo" | "neutro" | "negativo";
      if (s in totals[m.company_name]) {
        totals[m.company_name][s]++;
      }
    }

    // Preserve companies that had all mentions removed (0 totals)
    if (sov.totals_by_company) {
      for (const [name, t] of Object.entries(sov.totals_by_company)) {
        if (!totals[name]) {
          totals[name] = { positivo: 0, neutro: 0, negativo: 0, brand_owner: t.brand_owner };
        }
      }
    }

    await service.from("sol_reports").update({
      raw_data: { ...rawData, sov: { ...sov, mentions, totals_by_company: totals } },
    }).eq("id", reportId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sol-exclude-mention] Error:", err);
    notifyError("sol-exclude-mention", err, { reportId, postUrl });
    return NextResponse.json({ error: "Failed to exclude mention" }, { status: 500 });
  }
}
