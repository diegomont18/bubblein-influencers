import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

interface SearchBody {
  themes: string[];
  language: string;
  country: string;
  domain: string;
  minFollowers: number;
  maxFollowers: number;
  resultsCount: number;
  approvedSynonyms?: Record<string, string[]>;
  coverAllKeywords?: boolean;
  publico?: string[];
  searchMode?: "content" | "title" | "posts";
  minReactions?: number;
  datePosted?: "past-24h" | "past-week" | "past-month" | "past-year";
  existingListId?: string;
  campaignId?: string;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: SearchBody = await request.json();
  const {
    themes,
    language,
    country,
    domain,
    minFollowers,
    maxFollowers,
    resultsCount,
    approvedSynonyms,
    coverAllKeywords = true,
    publico = [],
    searchMode = "content",
    minReactions = 10,
    datePosted,
    existingListId,
    campaignId,
  } = body;

  const isTitleMode = searchMode === "title";
  const isPostsMode = searchMode === "posts";

  if (!themes || themes.length === 0) {
    return NextResponse.json(
      { error: "At least one theme is required" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Check credits
  const { data: userRole } = await service
    .from("user_roles")
    .select("credits")
    .eq("user_id", user.id)
    .single();

  if (userRole && userRole.credits !== -1 && userRole.credits <= 0) {
    return NextResponse.json(
      { error: "Sem creditos. Compre mais para continuar buscando." },
      { status: 403 }
    );
  }

  // Campaign dedup: load existing slugs
  const excludeSlugs: string[] = [];
  if (campaignId) {
    const { data: campaignLists } = await service
      .from("casting_lists")
      .select("id")
      .eq("campaign_id", campaignId);
    if (campaignLists && campaignLists.length > 0) {
      const listIds = campaignLists.map((l: { id: string }) => l.id);
      const { data: existingProfiles } = await service
        .from("casting_list_profiles")
        .select("profile_id")
        .in("list_id", listIds);
      if (existingProfiles) {
        existingProfiles.forEach((p: { profile_id: string }) => excludeSlugs.push(p.profile_id));
      }
      console.log(`[casting] Campaign dedup: ${excludeSlugs.length} existing creators in campaign ${campaignId}`);
    }
  }

  // Create or reuse casting list
  let listId: string;

  if (isPostsMode && existingListId) {
    const { data: existingList } = await service
      .from("casting_lists")
      .select("id")
      .eq("id", existingListId)
      .single();
    if (existingList) {
      listId = existingList.id;
      await service.from("casting_lists").update({ status: "processing" }).eq("id", listId);
      console.log(`[casting] Reusing existing list ${existingListId} for continuation`);
    } else {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
  } else {
    const listName = isPostsMode
      ? `Posts: ${themes.slice(0, 3).join(", ")}${themes.length > 3 ? "..." : ""}`
      : isTitleMode
        ? `Title: ${themes.slice(0, 3).join(", ")}${themes.length > 3 ? "..." : ""}`
        : `Busca ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

    const { data: newList, error: listError } = await service
      .from("casting_lists")
      .insert({
        name: listName,
        query_theme: themes.join("\n"),
        filters_applied: { minFollowers, maxFollowers, language, country, domain, publico, searchMode, ...(isPostsMode ? { minReactions, datePosted } : {}) },
        created_by: user.id,
        campaign_id: campaignId ?? null,
        status: "processing",
      })
      .select()
      .single();

    if (listError || !newList) {
      console.error("[casting] Failed to create list:", listError);
      return NextResponse.json(
        { error: "Failed to save casting list" },
        { status: 500 }
      );
    }
    listId = newList.id;
  }

  // Trigger background function (fire-and-forget)
  const siteUrl = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  const bgUrl = `${siteUrl}/.netlify/functions/casting-search-background`;

  console.log(`[casting] Triggering background function at ${bgUrl} for list ${listId}`);

  fetch(bgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      themes,
      language,
      country,
      domain,
      minFollowers,
      maxFollowers,
      resultsCount,
      approvedSynonyms,
      coverAllKeywords,
      publico,
      searchMode,
      minReactions,
      datePosted,
      existingListId,
      campaignId,
      listId,
      userId: user.id,
      excludeSlugs,
    }),
  }).catch(err => {
    console.error("[casting] Failed to trigger background function:", err);
  });

  return NextResponse.json({ searchId: listId });
}
