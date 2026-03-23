import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const service = createServiceClient();
  const {
    data: { users },
    error,
  } = await service.auth.admin.listUsers();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch roles for all users
  const { data: roles } = await service.from("user_roles").select("*");
  const roleMap = new Map(roles?.map((r) => [r.user_id, { role: r.role, credits: r.credits, credits_total: r.credits_total }]) ?? []);

  const result = users.map((u) => {
    const info = roleMap.get(u.id);
    return {
      id: u.id,
      email: u.email,
      role: info?.role ?? "user",
      credits: info?.credits ?? 3,
      credits_total: info?.credits_total ?? 3,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    };
  });

  return NextResponse.json({ users: result });
}

export async function POST(request: Request) {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, role } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (role && !["admin", "user"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const service = createServiceClient();
  const {
    data: { user },
    error,
  } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (user) {
    const userRole = role ?? "user";
    const userCredits = userRole === "admin" ? -1 : 3;
    await service
      .from("user_roles")
      .insert({ user_id: user.id, role: userRole, credits: userCredits });
  }

  return NextResponse.json({ user: { id: user?.id, email, role: role ?? "user" } });
}

export async function DELETE(request: Request) {
  const { isAdmin, userId } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  if (user_id === userId) {
    return NextResponse.json(
      { error: "Cannot delete yourself" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
