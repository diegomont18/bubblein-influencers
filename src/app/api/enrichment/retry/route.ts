import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Get all failed jobs
  const { data: failedJobs } = await service
    .from("enrichment_jobs")
    .select("id, profile_id")
    .eq("status", "failed");

  if (!failedJobs || failedJobs.length === 0) {
    return NextResponse.json({ reset: 0 });
  }

  // Reset jobs to queued
  await service
    .from("enrichment_jobs")
    .update({
      status: "queued",
      attempt_count: 0,
      last_error: null,
      started_at: null,
      completed_at: null,
    })
    .in(
      "id",
      failedJobs.map((j) => j.id)
    );

  // Reset profiles to pending
  await service
    .from("profiles")
    .update({ enrichment_status: "pending" })
    .in(
      "id",
      failedJobs.map((j) => j.profile_id)
    );

  return NextResponse.json({ reset: failedJobs.length });
}
