import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { searchId: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchId } = params;
  const service = createServiceClient();

  // Fetch the casting list (verify ownership)
  const { data: list, error: listError } = await service
    .from("casting_lists")
    .select("id, status, error_message, filters_applied, created_by")
    .eq("id", searchId)
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  if (list.created_by !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Fetch profiles found so far
  const { data: profiles } = await service
    .from("casting_list_profiles")
    .select("*")
    .eq("list_id", searchId)
    .order("rank_position", { ascending: true });

  const parsedProfiles = (profiles ?? []).map((p: Record<string, unknown>) => {
    try {
      const notes = typeof p.notes === "string" ? JSON.parse(p.notes as string) : p.notes;
      return { ...notes, slug: p.profile_id, focus: p.focus ?? notes?.focus };
    } catch {
      return { slug: p.profile_id, ...p };
    }
  });

  const filters = (list.filters_applied ?? {}) as Record<string, unknown>;
  const requested = Number(filters.resultsCount ?? 0);

  return NextResponse.json({
    status: list.status,
    errorMessage: list.error_message,
    profiles: parsedProfiles,
    found: parsedProfiles.length,
    requested,
  });
}
