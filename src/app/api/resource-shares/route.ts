import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";
import { sendShareInviteEmail } from "@/lib/emails/share-invite";
import {
  assertCanShare,
  findUserByEmail,
  getResourceName,
  getUserBasic,
  listCollaborators,
  respondAccessError,
  ResourceAccessError,
  type ResourceType,
  type ShareRole,
} from "@/lib/resource-access";

const VALID_TYPES: ResourceType[] = ["casting_list", "leads_scan", "lg_profile"];
const VALID_ROLES: ShareRole[] = ["viewer", "editor"];
const INVITE_TTL_DAYS = 14;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateInviteToken(): string {
  return `${crypto.randomUUID()}-${crypto.randomBytes(16).toString("hex")}`;
}

function makeAcceptUrl(token: string, origin: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;
  return `${baseUrl}/accept-invite/${token}`;
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { resourceType?: string; resourceId?: string; email?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { resourceType, resourceId, email: rawEmail, role: rawRole } = body;

  if (!resourceType || !VALID_TYPES.includes(resourceType as ResourceType)) {
    return NextResponse.json({ error: "Invalid resourceType" }, { status: 400 });
  }
  if (!resourceId || typeof resourceId !== "string") {
    return NextResponse.json({ error: "Missing resourceId" }, { status: 400 });
  }
  if (!rawEmail || typeof rawEmail !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const email = rawEmail.toLowerCase().trim();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const role: ShareRole = VALID_ROLES.includes(rawRole as ShareRole)
    ? (rawRole as ShareRole)
    : "viewer";

  try {
    const { ownerId } = await assertCanShare(
      actor.id,
      resourceType as ResourceType,
      resourceId
    );

    const ownerInfo = await getUserBasic(ownerId);
    if (ownerInfo && ownerInfo.email.toLowerCase() === email) {
      return NextResponse.json(
        { error: "Esse email já é o dono do recurso" },
        { status: 400 }
      );
    }

    const service = createServiceClient();

    const { data: existingActive } = await service
      .from("resource_shares")
      .select("id, status, invite_token, invite_expires_at")
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId)
      .ilike("invited_email", email)
      .in("status", ["pending", "accepted"])
      .maybeSingle();

    if (existingActive) {
      const isExpired =
        existingActive.status === "pending" &&
        existingActive.invite_expires_at &&
        new Date(existingActive.invite_expires_at) < new Date();

      const updates: Record<string, unknown> = { role };
      if (isExpired) {
        updates.invite_token = generateInviteToken();
        updates.invite_expires_at = new Date(
          Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();
      }

      const { data: updated, error: updateError } = await service
        .from("resource_shares")
        .update(updates)
        .eq("id", existingActive.id)
        .select("*")
        .single();

      if (updateError) {
        notifyError("resource-shares-update", updateError, {
          userId: actor.id,
          resourceType,
          resourceId,
        });
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      let emailSent = false;
      if (updated.status === "pending" && updated.invite_token) {
        const origin = request.nextUrl.origin;
        const resourceName = (await getResourceName(
          resourceType as ResourceType,
          resourceId
        )) ?? "(sem nome)";
        const result = await sendShareInviteEmail({
          toEmail: email,
          isExistingUser: false,
          ownerName: ownerInfo?.name ?? ownerInfo?.email ?? "BubbleIn",
          ownerEmail: ownerInfo?.email ?? "",
          resourceName,
          resourceType: resourceType as ResourceType,
          role,
          acceptUrl: makeAcceptUrl(updated.invite_token, origin),
        });
        emailSent = result.ok;
      }

      return NextResponse.json({ share: updated, mode: "updated", emailSent });
    }

    const existingUser = await findUserByEmail(email);
    const now = new Date().toISOString();

    let row: Record<string, unknown>;
    if (existingUser) {
      row = {
        resource_type: resourceType,
        resource_id: resourceId,
        owner_id: ownerId,
        invited_by: actor.id,
        invited_email: email,
        invited_user_id: existingUser.id,
        role,
        status: "accepted",
        accepted_at: now,
      };
    } else {
      row = {
        resource_type: resourceType,
        resource_id: resourceId,
        owner_id: ownerId,
        invited_by: actor.id,
        invited_email: email,
        role,
        status: "pending",
        invite_token: generateInviteToken(),
        invite_expires_at: new Date(
          Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
        ).toISOString(),
      };
    }

    const { data: inserted, error: insertError } = await service
      .from("resource_shares")
      .insert(row)
      .select("*")
      .single();

    if (insertError) {
      notifyError("resource-shares-create", insertError, {
        userId: actor.id,
        resourceType,
        resourceId,
      });
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const origin = request.nextUrl.origin;
    const resourceName = (await getResourceName(
      resourceType as ResourceType,
      resourceId
    )) ?? "(sem nome)";

    let acceptUrl: string;
    if (existingUser) {
      acceptUrl = `${origin}${redirectPathFor(resourceType as ResourceType, resourceId)}`;
    } else {
      acceptUrl = makeAcceptUrl(inserted.invite_token as string, origin);
    }

    const emailResult = await sendShareInviteEmail({
      toEmail: email,
      isExistingUser: !!existingUser,
      ownerName: ownerInfo?.name ?? ownerInfo?.email ?? "BubbleIn",
      ownerEmail: ownerInfo?.email ?? "",
      resourceName,
      resourceType: resourceType as ResourceType,
      role,
      acceptUrl,
    });

    return NextResponse.json({
      share: inserted,
      mode: "created",
      emailSent: emailResult.ok,
    });
  } catch (err) {
    if (err instanceof ResourceAccessError) {
      return respondAccessError(err);
    }
    console.error("[resource-shares-create] Error:", err);
    notifyError("resource-shares-create", err, {
      userId: actor.id,
      resourceType,
      resourceId,
    });
    return NextResponse.json({ error: "Failed to create share" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resourceType = request.nextUrl.searchParams.get("resourceType");
  const resourceId = request.nextUrl.searchParams.get("resourceId");

  if (!resourceType || !VALID_TYPES.includes(resourceType as ResourceType)) {
    return NextResponse.json({ error: "Invalid resourceType" }, { status: 400 });
  }
  if (!resourceId) {
    return NextResponse.json({ error: "Missing resourceId" }, { status: 400 });
  }

  try {
    const { ownerId } = await assertCanShare(
      actor.id,
      resourceType as ResourceType,
      resourceId
    );
    const owner = await getUserBasic(ownerId);
    const collaborators = await listCollaborators(
      resourceType as ResourceType,
      resourceId
    );
    return NextResponse.json({
      owner: owner
        ? { id: owner.id, email: owner.email, name: owner.name }
        : null,
      collaborators,
    });
  } catch (err) {
    if (err instanceof ResourceAccessError) {
      return respondAccessError(err);
    }
    console.error("[resource-shares-list] Error:", err);
    notifyError("resource-shares-list", err, {
      userId: actor.id,
      resourceType,
      resourceId,
    });
    return NextResponse.json({ error: "Failed to list shares" }, { status: 500 });
  }
}

function redirectPathFor(type: ResourceType, id: string): string {
  switch (type) {
    case "casting_list":
      return `/casting?listId=${id}`;
    case "leads_scan":
      return `/casting/leads?scanId=${id}`;
    case "lg_profile":
      return `/casting/share-of-linkedin/${id}`;
  }
}
