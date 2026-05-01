import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";
import {
  assertCanShare,
  respondAccessError,
  ResourceAccessError,
  type ResourceType,
  type ShareRole,
} from "@/lib/resource-access";

const VALID_ROLES: ShareRole[] = ["viewer", "editor"];

async function loadShareRow(id: string) {
  const service = createServiceClient();
  const { data } = await service
    .from("resource_shares")
    .select("id, resource_type, resource_id, owner_id, status")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shareId = params.id;
  let body: { role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.role || !VALID_ROLES.includes(body.role as ShareRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  try {
    const row = await loadShareRow(shareId);
    if (!row) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    await assertCanShare(
      actor.id,
      row.resource_type as ResourceType,
      row.resource_id as string
    );

    const service = createServiceClient();
    const { data: updated, error } = await service
      .from("resource_shares")
      .update({ role: body.role })
      .eq("id", shareId)
      .select("*")
      .single();

    if (error) {
      notifyError("resource-shares-patch", error, {
        userId: actor.id,
        shareId,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ share: updated });
  } catch (err) {
    if (err instanceof ResourceAccessError) {
      return respondAccessError(err);
    }
    console.error("[resource-shares-patch] Error:", err);
    notifyError("resource-shares-patch", err, { userId: actor.id, shareId });
    return NextResponse.json({ error: "Failed to update share" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shareId = params.id;

  try {
    const row = await loadShareRow(shareId);
    if (!row) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    await assertCanShare(
      actor.id,
      row.resource_type as ResourceType,
      row.resource_id as string
    );

    const service = createServiceClient();
    const { error } = await service
      .from("resource_shares")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        invite_token: null,
      })
      .eq("id", shareId);

    if (error) {
      notifyError("resource-shares-delete", error, {
        userId: actor.id,
        shareId,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ResourceAccessError) {
      return respondAccessError(err);
    }
    console.error("[resource-shares-delete] Error:", err);
    notifyError("resource-shares-delete", err, { userId: actor.id, shareId });
    return NextResponse.json({ error: "Failed to revoke share" }, { status: 500 });
  }
}
