import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchLinkedInCompany, searchGoogleApify } from "@/lib/apify";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { notifyError } from "@/lib/error-notifier";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { profileId } = await request.json();
    if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

    const service = createServiceClient();

    // Verify ownership + get profile data
    const { data: profile } = await service
      .from("lg_profiles")
      .select("id, name, linkedin_url")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .single();
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: optionsRow } = await service
      .from("lg_options")
      .select("ai_response, market_context, competitors")
      .eq("profile_id", profileId)
      .single();

    const companyName = profile.name || "";
    const companySlug = profile.linkedin_url?.match(/\/company\/([^/?#]+)/)?.[1] ?? "";
    const aiResponse = (optionsRow?.ai_response ?? {}) as Record<string, unknown>;
    const companyInfo = (aiResponse.companyInfo ?? {}) as Record<string, unknown>;
    const country = (aiResponse.country as string) || "br";

    const specialties = String(companyInfo.specialties ?? "");
    const industry = String(companyInfo.industry ?? "");

    // SERP queries to discover competitors
    const serpQueries = [
      `"${companyName}" concorrentes OR competitors OR alternativas`,
      `${specialties || industry} empresa ${country === "br" ? "brasil" : ""} site:linkedin.com/company`,
    ].filter((q) => q.trim().length > 10);

    const seenSlugs = new Set<string>();
    seenSlugs.add(companySlug);

    // Exclude already-selected competitors
    const existingComps = (optionsRow?.competitors ?? []) as Array<Record<string, unknown>>;
    for (const c of existingComps) {
      const cUrl = String(c.url ?? "");
      const cSlug = cUrl.match(/\/company\/([^/?#]+)/)?.[1] ?? "";
      if (cSlug) seenSlugs.add(cSlug);
    }

    const candidateSlugs: string[] = [];

    try {
      const serpResults = await Promise.all(
        serpQueries.map((q) => searchGoogleApify(q, { results: 10, country: country || undefined }).catch(() => ({ results: [] })))
      );
      serpQueries.forEach(() => {
        logApiCost({ userId: user.id, source: "sol", provider: "apify", operation: "searchGoogleApify", estimatedCost: API_COSTS.apify.searchGoogleApify, metadata: { context: "discover-competitors" } });
      });

      for (const sr of serpResults) {
        for (const r of sr.results) {
          const s = r.link.match(/linkedin\.com\/company\/([^/?#]+)/)?.[1];
          if (s && s.length > 2 && !seenSlugs.has(s)) {
            seenSlugs.add(s);
            candidateSlugs.push(s);
          }
        }
      }
    } catch (err) {
      console.error("[discover-competitors] SERP failed:", err);
    }

    // Fetch LinkedIn info for top candidates
    const competitors = await Promise.all(
      candidateSlugs.slice(0, 8).map(async (cSlug) => {
        try {
          const cr = await fetchLinkedInCompany(cSlug);
          logApiCost({ userId: user.id, source: "sol", provider: "apify", operation: "fetchLinkedInCompany", estimatedCost: API_COSTS.apify.fetchLinkedInCompany, metadata: { slug: cSlug } });
          return {
            name: cr.data?.name || cSlug.replace(/-/g, " "),
            logoUrl: cr.data?.profilePicUrl || "",
            url: `https://www.linkedin.com/company/${cSlug}/`,
            employeeCount: cr.data?.employeeCount ?? 0,
          };
        } catch {
          return { name: cSlug.replace(/-/g, " "), logoUrl: "", url: `https://www.linkedin.com/company/${cSlug}/`, employeeCount: 0 };
        }
      })
    );

    console.log(`[discover-competitors] Found ${competitors.length} competitors for ${companyName}`);
    return NextResponse.json({ competitors });
  } catch (err) {
    console.error("[discover-competitors] Error:", err);
    notifyError("discover-competitors", err, {});
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
