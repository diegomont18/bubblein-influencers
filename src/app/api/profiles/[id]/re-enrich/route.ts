import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  console.log(`[re-enrich] Starting re-enrich for profile ${params.id}`);

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.log(`[re-enrich] Unauthorized request for profile ${params.id}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Verify profile exists
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .eq("id", params.id)
    .single();

  if (!profile) {
    console.log(`[re-enrich] Profile ${params.id} not found`);
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Create new enrichment job (don't change enrichment_status — the process route handles that)
  const { data: job, error } = await service
    .from("enrichment_jobs")
    .insert({ profile_id: params.id, status: "queued" })
    .select()
    .single();

  if (error) {
    console.log(`[re-enrich] Error creating job for profile ${params.id}: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[re-enrich] Job ${job.id} created for profile ${params.id}`);
  return NextResponse.json({ job });
}
