import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { credits } = body;

  if (credits === undefined || credits === null) {
    return NextResponse.json({ error: "credits is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const newCredits = Number(credits);

  // Fetch current values to compute delta for credits_total
  const { data: current } = await service
    .from("user_roles")
    .select("credits, credits_total")
    .eq("user_id", id)
    .single();

  const oldCredits = current?.credits ?? 0;
  const oldTotal = current?.credits_total ?? 0;

  // If new credits > old credits, admin is injecting credits — increase total
  const delta = newCredits - oldCredits;
  const newTotal = delta > 0 ? oldTotal + delta : oldTotal;

  const { error } = await service
    .from("user_roles")
    .update({ credits: newCredits, credits_total: newTotal })
    .eq("user_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, credits: newCredits, credits_total: newTotal });
}
