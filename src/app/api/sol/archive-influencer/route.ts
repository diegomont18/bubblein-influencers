import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";

/**
 * POST /api/sol/archive-influencer
 * Toggles archive state for an influencer in a report's raw_data.
 * Body: { reportId: string, influencerKey: string, archive: boolean }
 */
export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId, influencerKey, archive } = await request.json() as {
    reportId: string;
    influencerKey: string;
    archive: boolean;
  };

  if (!reportId || !influencerKey) {
    return NextResponse.json({ error: "reportId and influencerKey required" }, { status: 400 });
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
    const currentArchived = (rawData.archived_influencers ?? []) as string[];

    let newArchived: string[];
    if (archive) {
      newArchived = currentArchived.includes(influencerKey)
        ? currentArchived
        : [...currentArchived, influencerKey];
    } else {
      newArchived = currentArchived.filter((k) => k !== influencerKey);
    }

    await service.from("sol_reports").update({
      raw_data: { ...rawData, archived_influencers: newArchived },
    }).eq("id", reportId);

    return NextResponse.json({ ok: true, archived_influencers: newArchived });
  } catch (err) {
    console.error("[sol-archive-influencer] Error:", err);
    notifyError("sol-archive-influencer", err, { reportId, influencerKey });
    return NextResponse.json({ error: "Failed to archive influencer" }, { status: 500 });
  }
}
