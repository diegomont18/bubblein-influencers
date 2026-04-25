import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { logApiCost } from "@/lib/api-costs";
import { notifyError } from "@/lib/error-notifier";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { profileId, credits = 3 } = body;
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  const service = createServiceClient();

  // Verify ownership
  const { data: profile } = await service.from("lg_profiles").select("*").eq("id", profileId).eq("user_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Check credits
  const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", user.id).single();
  if (!userRole || (userRole.credits !== -1 && userRole.credits < credits)) {
    return NextResponse.json({ error: "Créditos insuficientes" }, { status: 403 });
  }

  // Get options (market_context = themes for influencer search)
  const { data: options } = await service.from("lg_options").select("*").eq("profile_id", profileId).single();
  if (!options?.market_context) {
    return NextResponse.json({ error: "Temas de atuação não definidos" }, { status: 400 });
  }

  const themes = options.market_context.split(",").map((t: string) => t.trim()).filter(Boolean);
  if (themes.length === 0) return NextResponse.json({ error: "Nenhum tema encontrado" }, { status: 400 });

  const resultsCount = credits * 3;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const cookies = request.headers.get("cookie") ?? "";

  try {
    const searchRes = await fetch(`${siteUrl}/api/casting/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookies,
      },
      body: JSON.stringify({
        themes,
        language: "lang_pt",
        country: "br",
        domain: "google.com.br",
        minFollowers: 2500,
        maxFollowers: 100000,
        resultsCount,
        coverAllKeywords: true,
        publico: [],
        searchMode: "content",
      }),
    });

    if (!searchRes.ok) {
      const errData = await searchRes.json().catch(() => ({}));
      return NextResponse.json({ error: errData.error ?? "Casting search failed" }, { status: searchRes.status });
    }

    const { searchId } = await searchRes.json();

    // Tag the casting_list with lgProfileId so we can find all searches for this profile
    const { data: castingList } = await service.from("casting_lists").select("filters_applied").eq("id", searchId).single();
    if (castingList) {
      const updatedFilters = { ...(castingList.filters_applied as Record<string, unknown> ?? {}), lgProfileId: profileId };
      await service.from("casting_lists").update({ filters_applied: updatedFilters }).eq("id", searchId);
    }

    // Save search ID to options
    await service.from("lg_options").update({ influencer_search_id: searchId }).eq("profile_id", profileId);

    logApiCost({ userId: user.id, source: "casting", searchId, provider: "apify", operation: "influencerSearch", estimatedCost: 0, creditsUsed: credits, metadata: { themes, resultsCount, lgProfileId: profileId } });

    console.log(`[lg-influencers] Casting search triggered: ${searchId}`);
    return NextResponse.json({ searchId });
  } catch (err) {
    console.error("[lg-influencers] Failed to call casting search:", err);
    notifyError("lg-influencer-search", err, { profileId });
    return NextResponse.json({ error: "Failed to start search" }, { status: 500 });
  }
}
