import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";
import {
  findUserByEmail,
  getResourceName,
  getUserBasic,
  type ResourceType,
} from "@/lib/resource-access";

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    const { data } = await service
      .from("resource_shares")
      .select(
        "id, resource_type, resource_id, owner_id, invited_email, role, status, invite_expires_at"
      )
      .eq("invite_token", token)
      .maybeSingle();

    if (!data || data.status !== "pending") {
      return NextResponse.json({ error: "invalid", code: "invalid" }, { status: 410 });
    }

    if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
      return NextResponse.json({ error: "expired", code: "expired" }, { status: 410 });
    }

    const owner = await getUserBasic(data.owner_id as string);
    const resourceName = await getResourceName(
      data.resource_type as ResourceType,
      data.resource_id as string
    );
    const existingUser = await findUserByEmail(data.invited_email as string);

    return NextResponse.json({
      email: data.invited_email,
      role: data.role,
      resourceType: data.resource_type,
      resourceId: data.resource_id,
      resourceName: resourceName ?? "(sem nome)",
      ownerName: owner?.name ?? owner?.email ?? "BubbleIn",
      ownerEmail: owner?.email ?? "",
      hasAccount: !!existingUser,
    });
  } catch (err) {
    console.error("[invite-info] Error:", err);
    notifyError("invite-info", err, { token });
    return NextResponse.json({ error: "Failed to load invite" }, { status: 500 });
  }
}
