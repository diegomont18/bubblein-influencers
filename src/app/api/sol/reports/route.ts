import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import {
  assertCanRead,
  respondAccessError,
  ResourceAccessError,
} from "@/lib/resource-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  try {
    await assertCanRead(user.id, "lg_profile", profileId);

    const service = createServiceClient();
    const { data: reports } = await service
      .from("sol_reports")
      .select("id, status, period_start, period_end, created_at")
      .eq("profile_id", profileId)
      .order("period_start", { ascending: false });

    return NextResponse.json({ reports: reports ?? [] });
  } catch (err) {
    if (err instanceof ResourceAccessError) {
      return respondAccessError(err);
    }
    throw err;
  }
}
