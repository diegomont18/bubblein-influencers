import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
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
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Set profile back to pending
  await service
    .from("profiles")
    .update({ enrichment_status: "pending" })
    .eq("id", params.id);

  // Create new enrichment job
  const { data: job, error } = await service
    .from("enrichment_jobs")
    .insert({ profile_id: params.id, status: "queued" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job });
}
