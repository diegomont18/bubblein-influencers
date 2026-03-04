import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: profiles } = await service
    .from("profiles")
    .select("enrichment_status");

  const { data: jobs } = await service
    .from("enrichment_jobs")
    .select("status");

  const profileStats = { pending: 0, processing: 0, done: 0, failed: 0 };
  for (const p of profiles ?? []) {
    const s = p.enrichment_status as keyof typeof profileStats;
    if (s in profileStats) profileStats[s]++;
  }

  const jobStats = { queued: 0, processing: 0, done: 0, failed: 0 };
  for (const j of jobs ?? []) {
    const s = j.status as keyof typeof jobStats;
    if (s in jobStats) jobStats[s]++;
  }

  return NextResponse.json({ profiles: profileStats, jobs: jobStats });
}
