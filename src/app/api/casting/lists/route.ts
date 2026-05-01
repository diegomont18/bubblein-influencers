import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import {
  assertCanEdit,
  assertCanRead,
  getAccessibleIds,
  getUserBasic,
  respondAccessError,
  ResourceAccessError,
  type Scope,
} from "@/lib/resource-access";

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

  if (id) {
    try {
      const access = await assertCanRead(user.id, "casting_list", id);

      const { data: list, error: listError } = await service
        .from("casting_lists")
        .select("*")
        .eq("id", id)
        .single();

      if (listError || !list) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }

      const { data: profiles } = await service
        .from("casting_list_profiles")
        .select("*")
        .eq("list_id", id)
        .order("rank_position", { ascending: true });

      console.log(
        `[casting] View list ${id}: ${(profiles ?? []).length} profiles (role=${access.role})`
      );

      const owner =
        access.role === "owner"
          ? null
          : await getUserBasic(access.ownerId);

      return NextResponse.json({
        list,
        profiles: profiles ?? [],
        accessRole: access.role,
        owner,
      });
    } catch (err) {
      if (err instanceof ResourceAccessError) {
        return respondAccessError(err);
      }
      throw err;
    }
  }

  const scope = (searchParams.get("scope") as Scope) ?? "all";
  const validScope: Scope = ["mine", "shared", "all"].includes(scope)
    ? scope
    : "all";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const from = (page - 1) * limit;

  const { ownIds, sharedIds } = await getAccessibleIds(
    user.id,
    "casting_list",
    validScope
  );
  const ids = [...ownIds, ...sharedIds.map((s) => s.id)];

  if (ids.length === 0) {
    return NextResponse.json({ data: [], total: 0, page });
  }

  const { data, count, error } = await service
    .from("casting_lists")
    .select("*, casting_list_profiles(count)", { count: "exact" })
    .in("id", ids)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  const enriched = (data ?? []).map((row: { id: string }) => {
    const shared = sharedById.get(row.id);
    if (shared) {
      return {
        ...row,
        accessRole: shared.role,
        owner: ownerInfoById.get(shared.ownerId) ?? null,
      };
    }
    return { ...row, accessRole: "owner" as const, owner: null };
  });

  return NextResponse.json({ data: enriched, total: count ?? 0, page });
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

  try {
    const access = await assertCanEdit(user.id, "casting_list", id);
    if (access.role !== "owner") {
      return NextResponse.json(
        { error: "Apenas o dono pode excluir o recurso" },
        { status: 403 }
      );
    }

    const service = createServiceClient();
    await service.from("casting_list_profiles").delete().eq("list_id", id);

    const { error: deleteError } = await service
      .from("casting_lists")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ResourceAccessError) {
      return respondAccessError(err);
    }
    throw err;
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name } = body;

  if (!id || !name) {
    return NextResponse.json({ error: "id and name are required" }, { status: 400 });
  }

  try {
    await assertCanEdit(user.id, "casting_list", id);

    const service = createServiceClient();
    const { error } = await service
      .from("casting_lists")
      .update({ name })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ResourceAccessError) {
      return respondAccessError(err);
    }
    throw err;
  }
}
