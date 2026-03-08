import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const service = createServiceClient();

  // Fetch single list with profiles
  if (id) {
    const { data: list, error: listError } = await service
      .from("casting_lists")
      .select("*")
      .eq("id", id)
      .eq("created_by", user.id)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const { data: profiles } = await service
      .from("casting_list_profiles")
      .select("*")
      .eq("list_id", id)
      .order("rank_position", { ascending: true });

    console.log(`[casting] View list ${id}: ${(profiles ?? []).length} profiles`);
    return NextResponse.json({ list, profiles: profiles ?? [] });
  }

  // Fetch all lists for user
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const from = (page - 1) * limit;

  const { data, count, error } = await service
    .from("casting_lists")
    .select("*, casting_list_profiles(count)", { count: "exact" })
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify ownership
  const { data: list, error: listError } = await service
    .from("casting_lists")
    .select("id")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  // Delete child rows first
  await service.from("casting_list_profiles").delete().eq("list_id", id);

  // Delete the list
  const { error: deleteError } = await service
    .from("casting_lists")
    .delete()
    .eq("id", id)
    .eq("created_by", user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
