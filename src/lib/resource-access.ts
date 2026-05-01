import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export type ResourceType = "casting_list" | "leads_scan" | "lg_profile";
export type ShareRole = "viewer" | "editor";
export type AccessRole = "owner" | ShareRole;
export type Scope = "mine" | "shared" | "all";

interface ResourceTableMapEntry {
  table: string;
  ownerCol: string;
  nameCol: string | null;
}

export const RESOURCE_TABLE_MAP: Record<ResourceType, ResourceTableMapEntry> = {
  casting_list: { table: "casting_lists", ownerCol: "created_by", nameCol: "name" },
  leads_scan: { table: "leads_scans", ownerCol: "user_id", nameCol: null },
  lg_profile: { table: "lg_profiles", ownerCol: "user_id", nameCol: "name" },
};

export class ResourceAccessError extends Error {
  httpStatus: number;
  code: string;

  constructor(httpStatus: number, code: string, message?: string) {
    super(message ?? code);
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

export function respondAccessError(err: unknown): NextResponse {
  if (err instanceof ResourceAccessError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.httpStatus }
    );
  }
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

async function fetchOwnerId(
  type: ResourceType,
  resourceId: string
): Promise<string | null> {
  const map = RESOURCE_TABLE_MAP[type];
  const service = createServiceClient();
  const { data } = await service
    .from(map.table)
    .select(map.ownerCol)
    .eq("id", resourceId)
    .maybeSingle();

  if (!data) return null;
  const ownerId = (data as unknown as Record<string, unknown>)[map.ownerCol];
  return typeof ownerId === "string" ? ownerId : null;
}

export async function getAccessibleIds(
  userId: string,
  type: ResourceType,
  scope: Scope = "all"
): Promise<{
  ownIds: string[];
  sharedIds: { id: string; ownerId: string; role: ShareRole }[];
}> {
  const map = RESOURCE_TABLE_MAP[type];
  const service = createServiceClient();

  let ownIds: string[] = [];
  if (scope === "mine" || scope === "all") {
    const { data } = await service
      .from(map.table)
      .select("id")
      .eq(map.ownerCol, userId);
    ownIds = (data ?? []).map((r: { id: string }) => r.id);
  }

  let sharedIds: { id: string; ownerId: string; role: ShareRole }[] = [];
  if (scope === "shared" || scope === "all") {
    const { data } = await service
      .from("resource_shares")
      .select("resource_id, owner_id, role")
      .eq("resource_type", type)
      .eq("invited_user_id", userId)
      .eq("status", "accepted");
    sharedIds = (data ?? []).map(
      (r: { resource_id: string; owner_id: string; role: ShareRole }) => ({
        id: r.resource_id,
        ownerId: r.owner_id,
        role: r.role,
      })
    );
  }

  return { ownIds, sharedIds };
}

export async function getAccessRole(
  userId: string,
  type: ResourceType,
  resourceId: string
): Promise<{ role: AccessRole; ownerId: string } | null> {
  const ownerId = await fetchOwnerId(type, resourceId);
  if (!ownerId) return null;

  if (ownerId === userId) {
    return { role: "owner", ownerId };
  }

  const service = createServiceClient();
  const { data } = await service
    .from("resource_shares")
    .select("role")
    .eq("resource_type", type)
    .eq("resource_id", resourceId)
    .eq("invited_user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  if (!data) return null;
  return { role: data.role as ShareRole, ownerId };
}

export async function assertCanRead(
  userId: string,
  type: ResourceType,
  resourceId: string
): Promise<{ role: AccessRole; ownerId: string }> {
  const access = await getAccessRole(userId, type, resourceId);
  if (!access) {
    throw new ResourceAccessError(404, "not_found", "Resource not found");
  }
  return access;
}

export async function assertCanEdit(
  userId: string,
  type: ResourceType,
  resourceId: string
): Promise<{ role: AccessRole; ownerId: string }> {
  const access = await assertCanRead(userId, type, resourceId);
  if (access.role === "viewer") {
    throw new ResourceAccessError(403, "forbidden", "Edit permission required");
  }
  return access;
}

export async function assertCanShare(
  userId: string,
  type: ResourceType,
  resourceId: string
): Promise<{ role: AccessRole; ownerId: string }> {
  return assertCanEdit(userId, type, resourceId);
}

export async function getEffectiveOwnerId(
  userId: string,
  type: ResourceType,
  resourceId: string
): Promise<string> {
  const access = await getAccessRole(userId, type, resourceId);
  if (!access) {
    throw new ResourceAccessError(404, "not_found", "Resource not found");
  }
  return access.ownerId;
}

export interface CollaboratorRow {
  id: string;
  email: string;
  userId: string | null;
  role: ShareRole;
  status: "pending" | "accepted";
  createdAt: string;
  acceptedAt: string | null;
  inviteExpiresAt: string | null;
  userName: string | null;
}

export async function listCollaborators(
  type: ResourceType,
  resourceId: string
): Promise<CollaboratorRow[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("resource_shares")
    .select(
      "id, invited_email, invited_user_id, role, status, created_at, accepted_at, invite_expires_at"
    )
    .eq("resource_type", type)
    .eq("resource_id", resourceId)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as Array<{
    id: string;
    invited_email: string;
    invited_user_id: string | null;
    role: ShareRole;
    status: "pending" | "accepted";
    created_at: string;
    accepted_at: string | null;
    invite_expires_at: string | null;
  }>;

  const userIds = rows
    .map((r) => r.invited_user_id)
    .filter((id): id is string => Boolean(id));

  const userNameById = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: users } = await service.auth.admin.listUsers();
    for (const u of users.users) {
      if (userIds.includes(u.id)) {
        const meta = u.user_metadata as Record<string, unknown> | undefined;
        const name =
          (meta?.full_name as string | undefined) ??
          (meta?.name as string | undefined) ??
          null;
        userNameById.set(u.id, name);
      }
    }
  }

  return rows.map((r) => ({
    id: r.id,
    email: r.invited_email,
    userId: r.invited_user_id,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at,
    inviteExpiresAt: r.invite_expires_at,
    userName: r.invited_user_id
      ? userNameById.get(r.invited_user_id) ?? null
      : null,
  }));
}

export async function getResourceName(
  type: ResourceType,
  resourceId: string
): Promise<string | null> {
  const map = RESOURCE_TABLE_MAP[type];
  const service = createServiceClient();

  if (map.nameCol) {
    const { data } = await service
      .from(map.table)
      .select(map.nameCol)
      .eq("id", resourceId)
      .maybeSingle();
    if (!data) return null;
    return ((data as unknown as Record<string, unknown>)[map.nameCol] as string) ?? null;
  }

  if (type === "leads_scan") {
    const { data } = await service
      .from("leads_scans")
      .select("post_urls, created_at")
      .eq("id", resourceId)
      .maybeSingle();
    if (!data) return null;
    const urls = (data.post_urls as string[] | null) ?? [];
    if (urls.length > 0) {
      try {
        const u = new URL(urls[0]);
        return `Scan ${u.pathname.slice(0, 32)}`;
      } catch {
        return `Scan ${urls[0].slice(0, 32)}`;
      }
    }
    return `Scan ${data.created_at}`;
  }

  return null;
}

export async function findUserByEmail(
  email: string
): Promise<{ id: string; email: string } | null> {
  const service = createServiceClient();
  const normalized = email.toLowerCase().trim();
  const { data } = await service.auth.admin.listUsers();
  const found = data.users.find(
    (u) => u.email?.toLowerCase() === normalized
  );
  if (!found || !found.email) return null;
  return { id: found.id, email: found.email };
}

export async function getUserBasic(
  userId: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  const meta = data.user.user_metadata as Record<string, unknown> | undefined;
  const name =
    (meta?.full_name as string | undefined) ??
    (meta?.name as string | undefined) ??
    null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    name,
  };
}
