import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchLinkedInCompany } from "@/lib/apify";
import { searchGoogle } from "@/lib/serper";
import { notifyError } from "@/lib/error-notifier";
import {
  assertCanEdit,
  respondAccessError,
  ResourceAccessError,
} from "@/lib/resource-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let ownerId = user.id;
  try {
    const { profileId } = await request.json();
    if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

    try {
      const access = await assertCanEdit(user.id, "lg_profile", profileId);
      ownerId = access.ownerId;
    } catch (err) {
      if (err instanceof ResourceAccessError) return respondAccessError(err);
      throw err;
    }

    const service = createServiceClient();
    const { data: profile } = await service
      .from("lg_profiles")
      .select("id, name, linkedin_url")
      .eq("id", profileId)
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

    const solCostCtx = { userId: ownerId, source: "sol" as const };

    try {
      const serpResults = await Promise.all(
        serpQueries.map((q) => searchGoogle(q, { results: 10, country: country || undefined }, solCostCtx).catch(() => ({ results: [] })))
      );

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
          const cr = await fetchLinkedInCompany(cSlug, solCostCtx);
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
