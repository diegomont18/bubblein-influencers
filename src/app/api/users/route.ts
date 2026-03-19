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
  const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) ?? []);

  const result = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: roleMap.get(u.id) ?? "user",
    created_at: u.created_at,
  }));

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
    await service
      .from("user_roles")
      .insert({ user_id: user.id, role: role ?? "user" });
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
