import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { isAdmin, userId } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = params;

  if (id === userId) {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { role } = body;

  if (!role || !["admin", "user"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("user_roles")
    .upsert({ user_id: id, role }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, role });
}
