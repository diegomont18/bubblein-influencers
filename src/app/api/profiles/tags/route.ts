import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(_request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select("tags")
    .not("tags", "eq", "{}");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allTags = new Set<string>();
  for (const row of data ?? []) {
    for (const tag of row.tags ?? []) {
      allTags.add(tag);
    }
  }

  return NextResponse.json({ tags: Array.from(allTags).sort() });
}

export async function PATCH(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { profile_ids, action, tags } = body as {
    profile_ids: string[];
    action: "add" | "remove";
    tags: string[];
  };

  if (!Array.isArray(profile_ids) || !Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json(
      { error: "profile_ids and tags must be non-empty arrays" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  if (action === "add") {
    // Fetch current tags, merge, deduplicate
    const { data: profiles, error: fetchError } = await service
      .from("profiles")
      .select("id, tags")
      .in("id", profile_ids);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    for (const profile of profiles ?? []) {
      const existing = profile.tags ?? [];
      const merged = Array.from(new Set([...existing, ...tags]));
      await service
        .from("profiles")
        .update({ tags: merged })
        .eq("id", profile.id);
    }
  } else if (action === "remove") {
    const { data: profiles, error: fetchError } = await service
      .from("profiles")
      .select("id, tags")
      .in("id", profile_ids);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const removeSet = new Set(tags);
    for (const profile of profiles ?? []) {
      const filtered = (profile.tags ?? []).filter((t: string) => !removeSet.has(t));
      await service
        .from("profiles")
        .update({ tags: filtered })
        .eq("id", profile.id);
    }
  } else {
    return NextResponse.json(
      { error: 'action must be "add" or "remove"' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
