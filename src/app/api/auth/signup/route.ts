import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Create user via admin API to skip email verification
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
      .insert({ user_id: user.id, role: "user", credits: 3 });
  }

  return NextResponse.json({
    user: { id: user?.id, email },
  });
}
