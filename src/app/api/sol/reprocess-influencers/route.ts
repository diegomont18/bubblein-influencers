import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { searchGoogle } from "@/lib/serper";
import { fetchLinkedInProfileCached, fetchProfilePosts } from "@/lib/apify";
import { extractPostDate, computePostsPerMonth } from "@/lib/find-employees";
import { checkPublishLanguage } from "@/lib/ai";
import { parseAbbreviatedNumber } from "@/lib/normalize";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { notifyError } from "@/lib/error-notifier";

export const maxDuration = 300;

interface InfluencerCard {
  name: string;
  role: string;
  company: string;
  linkedin_url: string;
  followers: number;
  posts_about: number;
  themes_covered: string[];
  brands_mentioned: Array<{ brand: string; brand_owner: "main" | "competitor"; company_name: string }>;
  avg_engagement: number;
  frequency: number;
  sentiment: "positivo" | "neutro" | "negativo";
  potential: "alto" | "médio" | "baixo";
  profile_photo?: string;
  slug?: string;
  posts_per_month?: number;
}

interface InfluencerMentionRow {
  date: string;
  text: string;
  brand?: string;
  brand_owner?: "main" | "competitor";
  sentiment?: "positivo" | "neutro" | "negativo";
  post_url?: string;
}

interface CompanyBrandsEntry {
  name: string;
  brand_owner: "main" | "competitor";
  brands: string[];
}

interface SovMention {
  author_name: string;
  author_slug: string;
  author_linkedin_url: string;
  company_name: string;
  brand_owner: "main" | "competitor";
  brand_term: string;
  sentiment: "positivo" | "neutro" | "negativo";
  text: string;
  posted_at: string | null;
  post_url: string;
}

function extractSlug(linkedinUrl: string, type: "company" | "person"): string {
  if (type === "company") {
    const match = linkedinUrl.match(/linkedin\.com\/company\/([^/?#]+)/);
    return match ? match[1].replace(/\/$/, "") : "";
  }
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
  return match ? match[1].replace(/\/$/, "") : "";
}

const INF_COUNTRY_NAMES: Record<string, string> = {
  br: "Brazil", us: "United States", es: "Spain", fr: "France",
};
const INF_COUNTRY_CITIES: Record<string, string[]> = {
  br: ["são paulo", "sao paulo", "rio de janeiro", "brasília", "brasilia", "belo horizonte", "curitiba", "porto alegre", "recife", "salvador", "fortaleza", "campinas", "florianópolis", "florianopolis", "brasil"],
  us: ["new york", "san francisco", "los angeles", "chicago", "houston", "phoenix", "seattle", "boston", "austin", "denver", "miami", "atlanta", "dallas"],
  es: ["madrid", "barcelona", "valencia", "sevilla", "seville", "bilbao", "málaga", "malaga", "españa"],
  fr: ["paris", "lyon", "marseille", "toulouse", "nice", "nantes", "strasbourg", "bordeaux"],
};
const INF_COUNTRY_LANG: Record<string, string> = { br: "lang_pt", us: "lang_en", es: "lang_es", fr: "lang_fr" };
const INF_COUNTRY_HINT: Record<string, string> = { br: "Brasil", us: "USA", es: "España", fr: "France" };

function infMatchesCountry(profileLocation: string, countryCode: string): boolean {
  if (!profileLocation) return true;
  const loc = profileLocation.toLowerCase();
  const name = (INF_COUNTRY_NAMES[countryCode] ?? "").toLowerCase();
  if (name && loc.includes(name)) return true;
  const cities = INF_COUNTRY_CITIES[countryCode] ?? [];
  for (const city of cities) { if (loc.includes(city)) return true; }
  for (const [code, cName] of Object.entries(INF_COUNTRY_NAMES)) {
    if (code !== countryCode && loc.includes(cName.toLowerCase())) return false;
  }
  for (const [code, cities2] of Object.entries(INF_COUNTRY_CITIES)) {
    if (code !== countryCode) { for (const c2 of cities2) { if (loc.includes(c2)) return false; } }
  }
  return true;
}

function infExtractSlug(url: string): string | null {
  const postMatch = url.match(/linkedin\.com\/posts\/([^_/?#]+)/);
  if (postMatch) { try { return decodeURIComponent(postMatch[1]); } catch { return postMatch[1]; } }
  const profileMatch = url.match(/linkedin\.com\/in\/([^/?#]+)/);
  if (!profileMatch) return null;
  try { return decodeURIComponent(profileMatch[1]); } catch { return profileMatch[1]; }
}

const JOB_POST_RE = /\b(vagas?|contratando|hiring|we.re hiring|estamos contratando|oportunidade de emprego|job opening|open position|open role|vem ser|venha fazer parte)\b/i;
const REPOST_RE = /\b(reposted this|repostou|compartilhou isso|compartilhou isto|shared this)\b/i;

function cleanSnippetText(text: string): string {
  return text
    .replace(/\b(Denunciar est[ea] (comentário|comentario|publicação|publicacao|post)|Report this (comment|post))\b\.?/gi, "")
    .replace(/\b(Curtir|Comentar|Compartilhar|Like|Comment|Share|Repost)\b/g, "")
    .replace(/,?\s*\d+\s*(sem|d|h|min)\.?(\s|,|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractPostInfo(raw: Record<string, unknown>) {
  const shareUrn = String(raw.shareUrn ?? raw.entityId ?? "");
  const postUrl = shareUrn.includes("urn:li:")
    ? `https://www.linkedin.com/feed/update/${shareUrn}`
    : String(raw.linkedinUrl ?? raw.postUrl ?? raw.url ?? "");
  const textContent = String(raw.content ?? raw.text ?? raw.postText ?? "");
  const eng = (raw.engagement && typeof raw.engagement === "object" ? raw.engagement : {}) as Record<string, unknown>;
  const reactions = Number(eng.numLikes ?? eng.reactionCount ?? eng.likes ?? eng.reactions ?? raw.numLikes ?? 0) || 0;
  const comments = Number(eng.numComments ?? eng.commentCount ?? eng.comments ?? raw.numComments ?? 0) || 0;
  let postedDate = extractPostDate(raw);
  if (!postedDate && raw.postedAt && typeof raw.postedAt === "object") {
    const obj = raw.postedAt as Record<string, unknown>;
    const dateStr = obj.date ?? obj.timestamp ?? obj.dateTime;
    if (typeof dateStr === "string") {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) postedDate = d;
    } else if (typeof dateStr === "number") {
      const d = new Date(dateStr > 1e12 ? dateStr : dateStr * 1000);
      if (!isNaN(d.getTime())) postedDate = d;
    }
  }
  return { postUrl, textContent, reactions, comments, postedDate };
}

/**
 * POST /api/sol/reprocess-influencers
 * Re-runs Phase 5b (influencer discovery via Serper + profile enrichment) for a report.
 * Admin-only. Does NOT re-collect posts or SOV — only influencers.
 */
export async function POST(request: Request) {
  const { isAdmin, userId } = await checkAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { reportId } = await request.json() as { reportId: string };
  if (!reportId) {
    return NextResponse.json({ error: "reportId required" }, { status: 400 });
  }

  const service = createServiceClient();

  try {
    // Load report
    const { data: report } = await service
      .from("sol_reports")
      .select("id, profile_id, raw_data")
      .eq("id", reportId)
      .single();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Load profile
    const { data: profileData } = await service
      .from("lg_profiles")
      .select("id, name, linkedin_url, user_id")
      .eq("id", report.profile_id)
      .single();

    if (!profileData) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Credits are charged to the profile owner; admin actor recorded in metadata.
    const ownerId = profileData.user_id as string;

    // Load options
    const { data: optionsData } = await service
      .from("lg_options")
      .select("competitors, employee_profiles, ai_response, market_context, proprietary_brands")
      .eq("profile_id", report.profile_id)
      .single();

    if (!optionsData) {
      return NextResponse.json({ error: "Options not found" }, { status: 404 });
    }

    const companySlug = extractSlug(profileData.linkedin_url, "company");
    const companyName = profileData.name;
    const aiResponse = (optionsData.ai_response ?? {}) as Record<string, unknown>;
    const country = String((aiResponse.country as string | undefined) ?? "");

    // Build ownSlugs (to exclude self from results)
    const ownSlugs = new Set<string>();
    if (companySlug) ownSlugs.add(companySlug.toLowerCase());

    const employees = ((optionsData.employee_profiles ?? []) as Array<{ slug?: string; archived?: boolean }>).filter(e => !e.archived);
    for (const emp of employees) {
      if (emp.slug) ownSlugs.add(emp.slug.toLowerCase());
    }

    const competitors = (optionsData.competitors ?? []) as Array<{ selected?: boolean; url?: string; name?: string }>;
    const selectedCompetitors = competitors.filter(
      (c): c is { selected: true; url: string; name: string } =>
        typeof c === "object" && c !== null && c.selected === true && !!c.url && !!c.name
    );

    for (const comp of selectedCompetitors) {
      const slug = extractSlug(comp.url, "company");
      if (slug) ownSlugs.add(slug.toLowerCase());
    }

    const competitorEmployees = (aiResponse.competitor_employees ?? {}) as Record<string, Array<{ slug?: string; archived?: boolean }>>;
    for (const emps of Object.values(competitorEmployees)) {
      for (const emp of (emps ?? [])) {
        if (emp.slug && !(emp as { archived?: boolean }).archived) ownSlugs.add(emp.slug.toLowerCase());
      }
    }

    // Build companyBrandsList
    const companyBrandsList: CompanyBrandsEntry[] = [];
    const mainBrandsRaw = (optionsData.proprietary_brands ?? []) as unknown[];
    const mainBrands: string[] = mainBrandsRaw
      .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
      .map((b) => b.trim());
    companyBrandsList.push({
      name: companyName,
      brand_owner: "main",
      brands: mainBrands.length > 0 ? mainBrands : [companyName],
    });

    const competitorBrandsMap = (aiResponse.competitor_brands ?? {}) as Record<string, unknown>;
    for (const comp of selectedCompetitors) {
      const raw = competitorBrandsMap[comp.name];
      const list = Array.isArray(raw)
        ? raw.filter((b): b is string => typeof b === "string" && b.trim().length > 0).map((b) => b.trim())
        : [];
      companyBrandsList.push({
        name: comp.name,
        brand_owner: "competitor",
        brands: list.length > 0 ? list : [comp.name],
      });
    }

    // Get existing SOV mentions from raw_data
    const existingRawData = (report.raw_data ?? {}) as Record<string, unknown>;
    const sovData = (existingRawData.sov ?? {}) as Record<string, unknown>;
    const sovMentions = ((sovData.mentions ?? []) as SovMention[]);

    // ---- Phase 5b: Influencers ----
    const influencers: InfluencerCard[] = [];
    const influencerMentionsMap: Record<string, InfluencerMentionRow[]> = {};

    const themesRaw = String(optionsData.market_context ?? "").trim();
    const themes = themesRaw
      ? themesRaw.split(",").map((t) => t.trim()).filter((t) => t.length > 0)
      : [];

    // Combine themes + brands for search (deduplicated)
    const allSearchTerms: string[] = [...themes];
    for (const cb of companyBrandsList) {
      for (const b of cb.brands) {
        if (!allSearchTerms.some(t => t.toLowerCase() === b.toLowerCase())) {
          allSearchTerms.push(b);
        }
      }
    }

    if (allSearchTerms.length === 0) {
      return NextResponse.json({ ok: true, influencerCount: 0, message: "No search terms" });
    }

    const targetLang = INF_COUNTRY_LANG[country] ?? "lang_pt";
    const countryHint = INF_COUNTRY_HINT[country] ?? "";

    // Step 1: Serper-based discovery (themes + brands, up to 5 queries)
    const searchTerms = allSearchTerms.slice(0, 5);
    const candidateSlugs = new Set<string>();
    const slugSnippets = new Map<string, { title: string; snippet: string; link: string }>();

    for (const theme of searchTerms) {
      if (candidateSlugs.size >= 20) break;
      const query = `site:linkedin.com/posts "${theme}"${countryHint ? ` ${countryHint}` : ""}`;
      console.log(`[sol-reprocess-influencers] Serper query: ${query}`);
      try {
        const { results } = await searchGoogle(query, {
          results: 20,
          tbs: "qdr:m",
          country: country || undefined,
          language: targetLang.replace("lang_", "") || undefined,
        }, { userId: ownerId, source: "sol", searchId: reportId });

        for (const r of results) {
          if (candidateSlugs.size >= 20) break;
          const slug = infExtractSlug(r.link);
          if (!slug) continue;
          if (ownSlugs.has(slug.toLowerCase())) continue;
          if (JOB_POST_RE.test(r.title) || JOB_POST_RE.test(r.snippet)) continue;
          if (REPOST_RE.test(r.title) || REPOST_RE.test(r.snippet)) continue;
          if (!candidateSlugs.has(slug)) {
            candidateSlugs.add(slug);
            slugSnippets.set(slug, { title: r.title, snippet: r.snippet, link: r.link });
          }
        }
      } catch (err) {
        console.error(`[sol-reprocess-influencers] Serper error for "${theme}":`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`[sol-reprocess-influencers] ${candidateSlugs.size} candidate slugs from Serper`);

    // Step 2: Enrich candidates
    const allBrandRegexes: Array<{ brand: string; brand_owner: "main" | "competitor"; company_name: string; re: RegExp }> = [];
    for (const cb of companyBrandsList) {
      for (const b of cb.brands) {
        allBrandRegexes.push({
          brand: b, brand_owner: cb.brand_owner, company_name: cb.name,
          re: new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
        });
      }
    }

    // Index SOV mentions by author slug for sentiment merge
    const sovBySlug = new Map<string, SovMention[]>();
    for (const sm of sovMentions) {
      const k = sm.author_slug || sm.author_linkedin_url || sm.author_name;
      if (!k) continue;
      const arr = sovBySlug.get(k) ?? [];
      arr.push(sm);
      sovBySlug.set(k, arr);
    }

    const themeRegexes = themes.map((t) => ({
      theme: t,
      re: new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
    }));

    const costCtx = { userId: ownerId, source: "sol" as const, searchId: reportId };
    let qualifiedCount = 0;

    for (const slug of Array.from(candidateSlugs)) {
      if (qualifiedCount >= 8) break;

      try {
        const profileResult = await fetchLinkedInProfileCached(slug, costCtx);
        if (profileResult.status !== 200 || !profileResult.data) {
          console.log(`[sol-reprocess-influencers] ${slug}: profile fetch failed (${profileResult.status})`);
          continue;
        }
        const data = profileResult.data;

        // Country filter
        const profileLocation = String(data.location ?? data.locationName ?? "");
        if (country && !infMatchesCountry(profileLocation, country)) {
          console.log(`[sol-reprocess-influencers] ${slug}: skipped (location "${profileLocation}" doesn't match ${country})`);
          continue;
        }

        // Follower minimum
        const followers = parseAbbreviatedNumber(data.followerCount)
          ?? parseAbbreviatedNumber(data.followers)
          ?? parseAbbreviatedNumber(data.follower_count)
          ?? parseAbbreviatedNumber(data.followersCount)
          ?? 0;
        if (followers < 500) {
          console.log(`[sol-reprocess-influencers] ${slug}: skipped (${followers} followers < 500)`);
          continue;
        }

        // Language check
        const publishesInLang = await checkPublishLanguage(data, targetLang);
        logApiCost({
          userId: ownerId,
          source: "sol",
          searchId: reportId,
          provider: "openrouter",
          operation: "checkPublishLanguage",
          estimatedCost: API_COSTS.openrouter.checkPublishLanguage,
          metadata: { phase: "reprocess-influencers", slug, actorUserId: userId },
        });
        if (!publishesInLang) {
          console.log(`[sol-reprocess-influencers] ${slug}: skipped (doesn't publish in ${targetLang})`);
          continue;
        }

        // Extract profile photo
        let profilePhoto = "";
        const photoCandidates = [
          data.profile_photo, data.profilePicture, data.picture,
          data.profile_pic_url, data.profile_picture, data.photo,
          data.avatar, data.profile_image_url, data.profilePictureUrl,
        ];
        let rawPhotoUrl = "";
        for (const c of photoCandidates) {
          if (typeof c === "string" && c.startsWith("http")) { rawPhotoUrl = c; break; }
          if (c && typeof c === "object") {
            const obj = c as Record<string, unknown>;
            const url = String(obj.original || obj.large || obj.medium || obj.small || "");
            if (url.startsWith("http")) { rawPhotoUrl = url; break; }
          }
        }
        if (rawPhotoUrl) {
          try {
            const photoRes = await fetch(rawPhotoUrl, { signal: AbortSignal.timeout(10_000) });
            if (photoRes.ok) {
              const photoBuffer = await photoRes.arrayBuffer();
              const ext = rawPhotoUrl.includes(".png") ? "png" : "jpg";
              const safeSlug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "-");
              const filePath = `${safeSlug}.${ext}`;
              const { error: uploadError } = await service.storage
                .from("profile-photos")
                .upload(filePath, photoBuffer, { contentType: ext === "png" ? "image/png" : "image/jpeg", upsert: true });
              if (!uploadError) {
                const { data: urlData } = service.storage.from("profile-photos").getPublicUrl(filePath);
                profilePhoto = urlData.publicUrl;
              }
            }
          } catch (photoErr) {
            console.warn(`[sol-reprocess-influencers] Photo error for ${slug}:`, String(photoErr));
          }
        }

        // Build influencer card
        const profileName = String(data.fullName ?? data.full_name ?? data.name ?? slug);
        const headline = String(data.headline ?? "");
        const profileCompany = String(
          (data.company && typeof data.company === "object" ? (data.company as Record<string, unknown>).name : undefined)
          ?? data.companyName ?? data.currentCompany ?? ""
        );

        // Fetch real posts + detect brands/themes
        const snippetData = slugSnippets.get(slug);
        const snippetText = snippetData ? `${snippetData.title} ${snippetData.snippet}` : "";
        const themesCoveredSet = new Set<string>();
        for (const tr of themeRegexes) {
          if (tr.re.test(headline) || tr.re.test(snippetText)) themesCoveredSet.add(tr.theme);
        }

        const brandsHitMap = new Map<string, { brand: string; brand_owner: "main" | "competitor"; company_name: string }>();
        const mentionsRows: InfluencerMentionRow[] = [];
        let recentPosts: Array<Record<string, unknown>> = [];

        // Fetch real posts from influencer's profile (only keep posts with keywords)
        try {
          recentPosts = await fetchProfilePosts(`https://www.linkedin.com/in/${slug}/`, 5);
          logApiCost({
            userId: ownerId, source: "sol", searchId: reportId,
            provider: "apify", operation: "fetchProfilePosts",
            estimatedCost: API_COSTS.apify.fetchProfilePosts,
            metadata: { phase: "reprocess-influencers", slug, postsRequested: 5, actorUserId: userId },
          });
          for (const rawPost of recentPosts) {
            const postInfo = extractPostInfo(rawPost);
            if (!postInfo.textContent || postInfo.textContent.length < 20) continue;
            // Only include posts that contain at least 1 monitored keyword
            const hasTheme = themeRegexes.some((tr) => tr.re.test(postInfo.textContent));
            const hasBrand = allBrandRegexes.some((br) => br.re.test(postInfo.textContent));
            if (!hasTheme && !hasBrand) continue;
            const hit = allBrandRegexes.find((br) => br.re.test(postInfo.textContent));
            if (hit) {
              brandsHitMap.set(`${hit.brand_owner}|${hit.company_name}|${hit.brand}`, {
                brand: hit.brand, brand_owner: hit.brand_owner, company_name: hit.company_name,
              });
            }
            for (const tr of themeRegexes) {
              if (tr.re.test(postInfo.textContent)) themesCoveredSet.add(tr.theme);
            }
            mentionsRows.push({
              date: postInfo.postedDate ? postInfo.postedDate.toISOString().slice(0, 10) : "",
              text: postInfo.textContent.slice(0, 600),
              post_url: postInfo.postUrl || undefined,
              ...(hit ? { brand: hit.brand, brand_owner: hit.brand_owner } : {}),
            });
          }
        } catch (postErr) {
          console.warn(`[sol-reprocess-influencers] Posts fetch error for ${slug}:`, String(postErr));
        }

        // Fallback: if no real posts fetched, use Serper snippet
        if (mentionsRows.length === 0 && snippetText) {
          const hit = allBrandRegexes.find((br) => br.re.test(snippetText));
          mentionsRows.push({
            date: "",
            text: cleanSnippetText(snippetData?.snippet ?? "").slice(0, 600),
            ...(hit ? { brand: hit.brand, brand_owner: hit.brand_owner } : {}),
            post_url: snippetData?.link,
          });
          if (hit) {
            brandsHitMap.set(`${hit.brand_owner}|${hit.company_name}|${hit.brand}`, {
              brand: hit.brand, brand_owner: hit.brand_owner, company_name: hit.company_name,
            });
          }
        }

        // Merge with SOV mentions for this author
        const sovForAuthor = sovBySlug.get(slug) ?? sovBySlug.get(profileName) ?? [];
        for (const sm of sovForAuthor) {
          mentionsRows.push({
            date: sm.posted_at ? sm.posted_at.slice(0, 10) : "",
            text: sm.text.slice(0, 600),
            brand: sm.brand_term,
            brand_owner: sm.brand_owner,
            sentiment: sm.sentiment,
            post_url: sm.post_url,
          });
          brandsHitMap.set(`${sm.brand_owner}|${sm.company_name}|${sm.brand_term}`, {
            brand: sm.brand_term, brand_owner: sm.brand_owner, company_name: sm.company_name,
          });
        }

        const brandsMentioned = Array.from(brandsHitMap.values());
        const ownBrandHits = brandsMentioned.filter((x) => x.brand_owner === "main").length;

        // Sentiment from SOV
        const sentCounts = { positivo: 0, neutro: 0, negativo: 0 };
        for (const sm of sovForAuthor) sentCounts[sm.sentiment] += 1;
        const totalSent = sentCounts.positivo + sentCounts.neutro + sentCounts.negativo;
        let sentiment: "positivo" | "neutro" | "negativo" = "neutro";
        if (totalSent > 0) {
          if (sentCounts.positivo >= sentCounts.neutro && sentCounts.positivo >= sentCounts.negativo) sentiment = "positivo";
          else if (sentCounts.negativo >= sentCounts.neutro && sentCounts.negativo >= sentCounts.positivo) sentiment = "negativo";
        }

        // Potential scoring
        let potential: "alto" | "médio" | "baixo" = "baixo";
        if (followers >= 30000 || ownBrandHits >= 2) potential = "alto";
        else if (followers >= 10000 || ownBrandHits >= 1) potential = "médio";

        const key = `https://www.linkedin.com/in/${slug}/`;

        // Calculate engagement from real posts using extractPostInfo (reliable field extraction)
        let totalReactions = 0, totalComments = 0, engPostCount = 0;
        for (const rawPost of recentPosts) {
          const pi = extractPostInfo(rawPost);
          totalReactions += pi.reactions;
          totalComments += pi.comments;
          engPostCount++;
        }
        const avgEngagement = engPostCount > 0 ? Math.round((totalReactions + totalComments) / engPostCount) : 0;
        const postsPerMonth = computePostsPerMonth(recentPosts);

        influencers.push({
          name: profileName,
          role: headline,
          company: profileCompany,
          linkedin_url: key,
          followers,
          posts_about: mentionsRows.length,
          themes_covered: Array.from(themesCoveredSet),
          brands_mentioned: brandsMentioned,
          avg_engagement: avgEngagement,
          frequency: 0,
          sentiment,
          potential,
          profile_photo: profilePhoto,
          slug,
          posts_per_month: postsPerMonth,
        });
        influencerMentionsMap[key] = mentionsRows.slice(0, 10);
        qualifiedCount++;
        console.log(`[sol-reprocess-influencers] ${slug}: QUALIFIED (${followers} followers, potential=${potential})`);
      } catch (err) {
        console.error(`[sol-reprocess-influencers] ${slug} error:`, err instanceof Error ? err.message : err);
      }
    }

    // Sort by potential then followers, keep top 8
    const potentialOrder: Record<string, number> = { alto: 0, "médio": 1, baixo: 2 };
    influencers.sort((a, b) => {
      const p = (potentialOrder[a.potential] ?? 3) - (potentialOrder[b.potential] ?? 3);
      if (p !== 0) return p;
      return b.followers - a.followers;
    });
    if (influencers.length > 8) {
      const keptKeys = new Set(influencers.slice(0, 8).map((inf) => inf.linkedin_url || inf.name));
      for (const key of Object.keys(influencerMentionsMap)) {
        if (!keptKeys.has(key)) delete influencerMentionsMap[key];
      }
      influencers.splice(8);
    }

    console.log(`[sol-reprocess-influencers] Final: ${influencers.length} qualified from ${candidateSlugs.size} candidates`);

    // Save — preserve existing raw_data (sov, etc.)
    await service.from("sol_reports").update({
      raw_data: {
        ...existingRawData,
        influencers,
        influencer_mentions: influencerMentionsMap,
      },
    }).eq("id", reportId);

    return NextResponse.json({ ok: true, influencerCount: influencers.length });
  } catch (err) {
    console.error("[sol-reprocess-influencers] Error:", err);
    notifyError("sol-reprocess-influencers", err, { reportId });
    return NextResponse.json({ error: "Failed to reprocess influencers" }, { status: 500 });
  }
}
