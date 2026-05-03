import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";

/**
 * POST /api/sol/vote
 * Persists a like/dislike vote on a recommendation or suggested post.
 * Body: { reportId, section: "recommendations"|"suggested_posts", itemId: number, vote: "like"|"dislike"|null }
 * vote: null removes the user's vote.
 */
export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId, section, itemId, vote } = await request.json() as {
    reportId: string;
    section: "recommendations" | "suggested_posts";
    itemId: number;
    vote: "like" | "dislike" | null;
  };

  if (!reportId || !section || itemId == null) {
    return NextResponse.json({ error: "reportId, section, and itemId required" }, { status: 400 });
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
    const votes = (rawData.votes ?? {}) as Record<string, Record<string, Array<{ email: string; vote: string; at: string }>>>;
    const sectionVotes = votes[section] ?? {};
    const itemKey = String(itemId);
    let itemVotes = sectionVotes[itemKey] ?? [];

    // Remove existing vote from this user
    itemVotes = itemVotes.filter((v) => v.email !== user.email);

    // Add new vote if not null
    if (vote) {
      itemVotes.push({ email: user.email!, vote, at: new Date().toISOString() });
    }

    sectionVotes[itemKey] = itemVotes;
    votes[section] = sectionVotes;

    await service.from("sol_reports").update({
      raw_data: { ...rawData, votes },
    }).eq("id", reportId);

    return NextResponse.json({ ok: true, votes });
  } catch (err) {
    console.error("[sol-vote] Error:", err);
    notifyError("sol-vote", err, { reportId, section, itemId });
    return NextResponse.json({ error: "Failed to save vote" }, { status: 500 });
  }
}
