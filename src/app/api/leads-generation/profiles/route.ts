import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";
import {
  assertCanEdit,
  getAccessibleIds,
  getUserBasic,
  respondAccessError,
  ResourceAccessError,
  type Scope,
} from "@/lib/resource-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = (request.nextUrl.searchParams.get("scope") as Scope) ?? "all";
  const validScope: Scope = ["mine", "shared", "all"].includes(scope)
    ? scope
    : "all";

  const service = createServiceClient();

  const { ownIds, sharedIds } = await getAccessibleIds(
    user.id,
    "lg_profile",
    validScope
  );
  const ids = [...ownIds, ...sharedIds.map((s) => s.id)];

  if (ids.length === 0) {
    return NextResponse.json({ profiles: [] });
  }

  const { data, error } = await service
    .from("lg_profiles")
    .select("id, linkedin_url, name, headline, profile_photo, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reportMap = new Map<string, { status: string; period_start: string; period_end: string }>();
  try {
    const profileIds = (data ?? []).map((p) => p.id);
    if (profileIds.length > 0) {
      const { data: reports } = await service
        .from("sol_reports")
        .select("profile_id, status, period_start, period_end")
        .in("profile_id", profileIds)
        .order("period_start", { ascending: false });

      if (reports) {
        for (const r of reports) {
          if (!reportMap.has(r.profile_id)) {
            reportMap.set(r.profile_id, { status: r.status, period_start: r.period_start, period_end: r.period_end });
          }
        }
      }
    }
  } catch {
    // sol_reports table may not exist yet — ignore
  }

  const sharedById = new Map(sharedIds.map((s) => [s.id, s]));
  const ownerIds = Array.from(
    new Set(sharedIds.map((s) => s.ownerId).filter(Boolean))
  );
  const ownerInfoById = new Map<
    string,
    { id: string; email: string; name: string | null }
  >();
  for (const ownerId of ownerIds) {
    const info = await getUserBasic(ownerId);
    if (info) ownerInfoById.set(ownerId, info);
  }

  const profiles = (data ?? []).map((p) => {
    const shared = sharedById.get(p.id);
    return {
      id: p.id,
      linkedin_url: p.linkedin_url,
      name: p.name,
      headline: p.headline,
      profile_photo: p.profile_photo,
      created_at: p.created_at,
      latest_report: reportMap.get(p.id) ?? null,
      accessRole: shared ? shared.role : ("owner" as const),
      owner: shared ? ownerInfoById.get(shared.ownerId) ?? null : null,
    };
  });

  return NextResponse.json({ profiles });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });

  try {
    const access = await assertCanEdit(user.id, "lg_profile", id);
    if (access.role !== "owner") {
      return NextResponse.json(
        { error: "Apenas o dono pode excluir o recurso" },
        { status: 403 }
      );
    }

    const service = createServiceClient();
    const { error: deleteError } = await service
      .from("lg_profiles")
      .delete()
      .eq("id", id);

    if (deleteError) {
      notifyError("leads-generation-profiles-delete", deleteError, { userId: user.id, profileId: id });
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ResourceAccessError) {
      return respondAccessError(err);
    }
    console.error("[leads-generation-profiles-delete] Error:", err);
    notifyError("leads-generation-profiles-delete", err, { userId: user.id, profileId: id });
    return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 });
  }
}
