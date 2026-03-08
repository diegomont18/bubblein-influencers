import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listId = request.nextUrl.searchParams.get("listId");
  const profileId = request.nextUrl.searchParams.get("profileId");

  if (!listId || !profileId) {
    return NextResponse.json(
      { error: "Missing listId or profileId parameter" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Verify ownership of the casting list
  const { data: list, error: listError } = await service
    .from("casting_lists")
    .select("id")
    .eq("id", listId)
    .eq("created_by", user.id)
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const { error: deleteError } = await service
    .from("casting_list_profiles")
    .delete()
    .eq("list_id", listId)
    .eq("profile_id", profileId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
