import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("pending_credits")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pendingCredits: data ?? [] });
}

export async function POST(request: Request) {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { email, extraCredits } = body;

  if (!email || !extraCredits || extraCredits <= 0) {
    return NextResponse.json({ error: "Email and positive extra credits are required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("pending_credits")
    .insert({ email: email.toLowerCase().trim(), extra_credits: extraCredits })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pendingCredit: data });
}

export async function DELETE(request: Request) {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("pending_credits")
    .delete()
    .eq("id", id)
    .eq("claimed", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
