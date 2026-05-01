import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";
import { provisionTrialUser } from "@/lib/auth/provision";
import {
  findUserByEmail,
  type ResourceType,
} from "@/lib/resource-access";

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

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const service = createServiceClient();
    const { data: share } = await service
      .from("resource_shares")
      .select(
        "id, resource_type, resource_id, owner_id, invited_email, role, status, invite_expires_at"
      )
      .eq("invite_token", token)
      .maybeSingle();

    if (!share || share.status !== "pending") {
      return NextResponse.json(
        { error: "invalid", code: "invalid" },
        { status: 410 }
      );
    }

    if (
      share.invite_expires_at &&
      new Date(share.invite_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "expired", code: "expired" },
        { status: 410 }
      );
    }

    const inviteEmail = (share.invited_email as string).toLowerCase();
    const supabase = createServerClient();
    const {
      data: { user: loggedInUser },
    } = await supabase.auth.getUser();

    const redirectUrl = redirectPathFor(
      share.resource_type as ResourceType,
      share.resource_id as string
    );

    if (loggedInUser) {
      const loggedInEmail = (loggedInUser.email ?? "").toLowerCase();
      if (loggedInEmail !== inviteEmail) {
        return NextResponse.json(
          {
            error: "wrong_account",
            code: "wrong_account",
            inviteEmail,
            currentEmail: loggedInEmail,
          },
          { status: 409 }
        );
      }

      await service
        .from("resource_shares")
        .update({
          status: "accepted",
          invited_user_id: loggedInUser.id,
          accepted_at: new Date().toISOString(),
          invite_token: null,
        })
        .eq("id", share.id);

      return NextResponse.json({ redirectUrl });
    }

    const existingUser = await findUserByEmail(inviteEmail);
    if (existingUser) {
      return NextResponse.json(
        {
          error: "login_required",
          code: "login_required",
          inviteEmail,
          redirectUrl,
        },
        { status: 409 }
      );
    }

    const password = body.password;
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Senha deve ter ao menos 6 caracteres", code: "invalid_password" },
        { status: 400 }
      );
    }

    const { data: created, error: createError } =
      await service.auth.admin.createUser({
        email: inviteEmail,
        password,
        email_confirm: true,
      });

    if (createError || !created.user) {
      const msg = createError?.message ?? "Failed to create user";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await provisionTrialUser(created.user.id, inviteEmail);

    await service
      .from("resource_shares")
      .update({
        status: "accepted",
        invited_user_id: created.user.id,
        accepted_at: new Date().toISOString(),
        invite_token: null,
      })
      .eq("id", share.id);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: inviteEmail,
      password,
    });

    if (signInError) {
      return NextResponse.json({
        redirectUrl: `/login?email=${encodeURIComponent(inviteEmail)}`,
      });
    }

    return NextResponse.json({ redirectUrl });
  } catch (err) {
    console.error("[invite-accept] Error:", err);
    notifyError("invite-accept", err, { token });
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}
