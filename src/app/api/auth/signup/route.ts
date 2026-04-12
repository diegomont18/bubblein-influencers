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
    const normalizedEmail = email.toLowerCase().trim();

    // Check for pre-registered extra credits
    const { data: pending } = await service
      .from("pending_credits")
      .select("id, extra_credits")
      .eq("email", normalizedEmail)
      .eq("claimed", false);

    const totalExtra = (pending ?? []).reduce((sum: number, p: { extra_credits: number }) => sum + p.extra_credits, 0);
    const initialCredits = 5 + totalExtra;

    await service
      .from("user_roles")
      .insert({ user_id: user.id, role: "user", credits: initialCredits, credits_total: initialCredits });

    // Mark pending credits as claimed
    if (pending && pending.length > 0) {
      await service
        .from("pending_credits")
        .update({ claimed: true, claimed_at: new Date().toISOString() })
        .in("id", pending.map((p: { id: string }) => p.id));
    }
  }

  return NextResponse.json({
    user: { id: user?.id, email },
  });
}
