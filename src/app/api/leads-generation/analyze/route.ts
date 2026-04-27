import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchProfilePosts, fetchLinkedInProfileApify, fetchLinkedInCompany } from "@/lib/apify";
import { analyzeProfileForLeads, analyzeCompanyForShareOfLinkedin, extractBrands } from "@/lib/ai";
import { scrapeWebsite } from "@/lib/firecrawl";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { isApifyBlocked } from "@/lib/apify-usage";
import { buildCompanyBlacklist } from "@/lib/company-match";
import { notifyError } from "@/lib/error-notifier";
import { findActiveEmployees, computePostsPerMonth } from "@/lib/find-employees";
import type { EmpCandidate } from "@/lib/find-employees";

function extractPostUrl(post: Record<string, unknown>): string {
  for (const key of ["postUrl", "permalink", "shareUrl"]) {
    const val = post[key];
    if (typeof val === "string" && val.includes("linkedin.com")) return val;
  }
  const shareUrn = String(post.shareUrn ?? post.entityId ?? "");
  if (shareUrn.includes("urn:li:")) return `https://www.linkedin.com/feed/update/${shareUrn}`;
  const id = String(post.id ?? "");
  if (id && /^\d+$/.test(id)) return `https://www.linkedin.com/feed/update/urn:li:activity:${id}`;
  const linkedinUrl = String(post.linkedinUrl ?? "");
  if (linkedinUrl.includes("/posts/") || linkedinUrl.includes("/feed/update/")) return linkedinUrl;
  return "";
}

function extractText(post: Record<string, unknown>): string {
  for (const key of ["content", "text", "postText", "commentary"]) {
    const val = post[key];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return "";
}

function extractCount(post: Record<string, unknown>, keys: string[], arrayKeys: string[]): number {
  for (const key of keys) {
    const val = post[key];
    if (val != null && !isNaN(Number(val))) return Number(val);
  }
  for (const key of arrayKeys) {
    const val = post[key];
    if (Array.isArray(val)) return val.length;
  }
  return 0;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (await isApifyBlocked()) {
    return NextResponse.json(
      { error: "Limite mensal de créditos Apify atingido. Contate o admin." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { profileUrl, country: rawCountry, competitorUrls: userCompetitorUrls } = body;
  const country = rawCountry || "br";
  const competitorUrlsFromUser = (userCompetitorUrls ?? []) as string[];
  if (!profileUrl || !profileUrl.includes("linkedin.com")) {
    return NextResponse.json({ error: "Valid LinkedIn profile URL is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Detect profile type: /in/<slug> → person, /company/<slug> → company page
  const personSlugMatch = profileUrl.match(/\/in\/([^/?#]+)/);
  const companySlugMatch = profileUrl.match(/\/company\/([^/?#]+)/);
  const isCompanyPage = !!companySlugMatch && !personSlugMatch;
  const slug = (personSlugMatch?.[1] ?? companySlugMatch?.[1] ?? "").replace(/\/$/, "");

  // Normalize URL: strip trailing paths like /posts/, /about/, query params
  const cleanProfileUrl = isCompanyPage
    ? `https://www.linkedin.com/company/${slug}/`
    : personSlugMatch
      ? `https://www.linkedin.com/in/${slug}/`
      : profileUrl;

  // Create profile record
  const { data: profile, error: profileError } = await service
    .from("lg_profiles")
    .insert({ user_id: user.id, linkedin_url: cleanProfileUrl, name: slug })
    .select()
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }

  // ------------------------------------------------------------------
  // Build the company blacklist used by the scan to exclude leads from
  // the same company as the analyzed profile. For a person, we fetch
  // their full profile and collect every company in their experience
  // (current + past). For a company page we simply blacklist the company
  // itself by slug.
  // ------------------------------------------------------------------
  const rawCompanyNames: string[] = [];
  if (isCompanyPage) {
    // Company slugs are often close to the display name (e.g. "bubblein" ≈ "BubbleIn")
    rawCompanyNames.push(slug.replace(/-/g, " "));
  } else if (personSlugMatch) {
    try {
      const profileResult = await fetchLinkedInProfileApify(slug);
      if (profileResult.status === 200 && profileResult.data) {
        const data = profileResult.data as Record<string, unknown>;
        // Current company (normalizeHarvestProfile flattens this to `company`)
        if (typeof data.company === "string") rawCompanyNames.push(data.company);
        // Every experience entry
        const exp = data.experience as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(exp)) {
          for (const e of exp) {
            const c = (e.company ?? e.company_name ?? "") as string;
            if (c) rawCompanyNames.push(c);
          }
        }
      }
    } catch (err) {
      console.error("[analyze] Failed to fetch profile for blacklist:", err);
    }
  }

  const companyBlacklist = buildCompanyBlacklist(rawCompanyNames);
  if (companyBlacklist.length > 0) {
    await service
      .from("lg_profiles")
      .update({ company_blacklist: companyBlacklist })
      .eq("id", profile.id);
    console.log(`[analyze] Profile ${profile.id}: blacklist=${JSON.stringify(companyBlacklist)}`);
  }

  // ==================================================================
  // COMPANY FLOW — Share of LinkedIn market mapping
  // ==================================================================
  if (isCompanyPage) {
    try {
      // Run company info + posts in PARALLEL.
      const [companyResult, rawPosts] = await Promise.all([
        fetchLinkedInCompany(slug).catch((err) => {
          console.error("[analyze] fetchLinkedInCompany failed:", err);
          return { status: 500, data: null, error: String(err) } as const;
        }),
        fetchProfilePosts(cleanProfileUrl, 10).catch((err) => {
          console.error("[analyze] fetchProfilePosts failed:", err);
          return [] as Array<Record<string, unknown>>;
        }),
      ]);
      logApiCost({ userId: user.id, source: "leads", searchId: profile.id, provider: "apify", operation: "fetchProfilePosts", estimatedCost: API_COSTS.apify.fetchProfilePosts, metadata: { postsFound: rawPosts.length } });

      // 1. Process company info
      let companyInfo = companyResult.data;

      // Validate the returned company matches the requested slug (the actor
      // sometimes returns Google as a fallback for unknown slugs)
      if (companyInfo && companyInfo.name) {
        const returnedSlug = companyInfo.name.toLowerCase().replace(/\s+/g, "-");
        const requestedSlug = slug.toLowerCase();
        if (!returnedSlug.includes(requestedSlug) && !requestedSlug.includes(returnedSlug.split("-")[0])) {
          console.warn(`[analyze] Company scraper returned "${companyInfo.name}" for slug="${slug}" — likely wrong. Using slug as name.`);
          companyInfo = { ...companyInfo, name: slug.replace(/-/g, " ") };
        }
      }

      if (companyInfo) {
        await service.from("lg_profiles").update({
          name: companyInfo.name || slug.replace(/-/g, " "),
          headline: `${companyInfo.industry || "Company"} · ${companyInfo.employeeCount || "?"} employees`,
          profile_photo: companyInfo.profilePicUrl || null,
        }).eq("id", profile.id);
        profile.name = companyInfo.name || slug.replace(/-/g, " ");
      } else {
        // Company scraper completely failed — at least set a readable name
        await service.from("lg_profiles").update({
          name: slug.replace(/-/g, " "),
        }).eq("id", profile.id);
        profile.name = slug.replace(/-/g, " ");
      }

      // Save posts
      const posts = rawPosts.map((p) => ({
        profile_id: profile.id,
        post_url: extractPostUrl(p),
        text_content: extractText(p),
        reactions: extractCount(p, ["reactionCount", "numReactions"], ["reactions", "reactionIds"]),
        comments: extractCount(p, ["commentCount", "numComments"], ["comments", "commentIds"]),
        posted_at: String(p.postedAt ?? p.publishedAt ?? p.date ?? ""),
        raw_data: p,
      }));
      if (posts.length > 0) {
        await service.from("lg_posts").insert(posts);
      }
      console.log(`[analyze] Company ${slug}: ${posts.length} posts saved`);

      // ------------------------------------------------------------------
      // Find active employees using shared algorithm
      // ------------------------------------------------------------------
      const companyName = companyInfo?.name ?? slug.replace(/-/g, " ");
      console.log(`[analyze] Company ${slug}: searching employees...`);
      const { active: allEmployees, inactive: inactiveEmployees } = await findActiveEmployees(slug, companyName, user.id, profile.id, 12, false, country);
      console.log(`[analyze] Company ${slug}: ${allEmployees.length} active, ${inactiveEmployees.length} inactive employees found`);
      /* LEGACY inline search replaced by findActiveEmployees */
      const slugName = slug.replace(/-/g, " ");
      void slugName; // keep for backward compat references

      // 3.5. Scrape company website BEFORE AI (so AI understands what company actually does)
      const companyWebsite = (companyInfo as unknown as Record<string, unknown>)?.websiteUrl ?? (companyInfo as unknown as Record<string, unknown>)?.website ?? "";
      let companySiteContent = "";
      if (companyWebsite) {
        console.log(`[analyze] Company ${slug}: scraping website ${companyWebsite}...`);
        const scrape = await scrapeWebsite(String(companyWebsite), { userId: user.id, searchId: profile.id });
        if (scrape) companySiteContent = `${scrape.title}. ${scrape.description}. ${scrape.content}`;
      }

      // 4. AI analysis: extract themes only (competitors come from SERP)
      console.log(`[analyze] Company ${slug}: running AI for themes...`);
      const aiResult = await analyzeCompanyForShareOfLinkedin(
        companyInfo?.name ?? slug.replace(/-/g, " "),
        companyInfo?.description ?? "",
        companyInfo?.specialties ?? "",
        companyInfo?.industry ?? "",
        allEmployees.map((e) => e.headline),
        companySiteContent,
        country,
      );
      logApiCost({ userId: user.id, source: "leads", searchId: profile.id, provider: "openrouter", operation: "analyzeCompanyForShareOfLinkedin", estimatedCost: API_COSTS.openrouter.classifyTopics });
      console.log(`[analyze] Company ${slug}: AI themes="${(aiResult?.themes ?? "").slice(0, 100)}"`);

      // 7.5. Compute posts/month for the main company page (reuse rawPosts)
      const companyPostsPerMonth = computePostsPerMonth(rawPosts);
      console.log(`[analyze] Company ${slug}: companyPPM=${companyPostsPerMonth}`);

      // Extract proprietary brands for the main company
      let mainBrands = await extractBrands(companyName, companySiteContent, String(companyInfo?.description ?? ""));
      // Fallback: use brands from Gemini analysis if DeepSeek + Gemini Lite both failed
      if (mainBrands.length === 0 && aiResult?.brands && aiResult.brands.length > 0) {
        console.log(`[analyze] Company ${slug}: using Gemini brands as fallback`);
        mainBrands = aiResult.brands;
      }
      // Always ensure company name is first
      if (mainBrands.length === 0 || mainBrands[0]?.toLowerCase() !== companyName.toLowerCase()) {
        mainBrands = [companyName, ...mainBrands.filter((b) => b.toLowerCase() !== companyName.toLowerCase())];
      }
      console.log(`[analyze] Company ${slug}: brands=${JSON.stringify(mainBrands)}`);

      const enrichedThemes = aiResult?.themes ?? "";
      type CompetitorEntry = { name: string; logoUrl: string; url: string; score: number; reason: string; selected: boolean; postsPerMonth?: number; employeeCount?: number };
      const competitors: CompetitorEntry[] = [];
      const competitorEmployees: Record<string, EmpCandidate[]> = {};
      const inactiveCompetitorEmployees: Record<string, EmpCandidate[]> = {};
      const competitorBrands: Record<string, string[]> = {};

      if (competitorUrlsFromUser.length > 0) {
        // ---- USER-PROVIDED COMPETITORS: fetch info + employees directly ----
        console.log(`[analyze] Company ${slug}: processing ${competitorUrlsFromUser.length} user-provided competitors...`);

        const compResults = await Promise.all(
          competitorUrlsFromUser.map(async (compUrl) => {
            const compSlug = compUrl.match(/\/company\/([^/?#]+)/)?.[1]?.replace(/\/$/, "") ?? "";
            if (!compSlug) return null;
            const companyUrl = `https://www.linkedin.com/company/${compSlug}/`;

            // Fetch company info
            const cr = await fetchLinkedInCompany(compSlug).catch(() => ({ status: 0, data: null as Record<string, unknown> | null }));
            logApiCost({ userId: user.id, source: "leads", searchId: profile.id, provider: "apify", operation: "fetchLinkedInCompany", estimatedCost: API_COSTS.apify.fetchLinkedInCompany, metadata: { slug: compSlug, context: "user-competitor" } });

            const realName = cr.data?.name || compSlug.replace(/-/g, " ");
            const logoUrl = cr.data?.profilePicUrl || "";
            const employeeCount = cr.data?.employeeCount ?? 0;

            // Scrape competitor website for brand extraction
            const compWebsiteUrl = String((cr.data as unknown as Record<string, unknown>)?.websiteUrl ?? (cr.data as unknown as Record<string, unknown>)?.website ?? "");
            let compSiteContent = "";
            if (compWebsiteUrl) {
              const scrape = await scrapeWebsite(compWebsiteUrl, { userId: user.id, searchId: profile.id });
              if (scrape) compSiteContent = `${scrape.title}. ${scrape.description}. ${scrape.content}`;
            }
            const compBrands = await extractBrands(String(realName), compSiteContent, String(cr.data?.description ?? ""));

            // Fetch posts for frequency
            const posts = await fetchProfilePosts(companyUrl, 5).catch(() => [] as Array<Record<string, unknown>>);
            logApiCost({ userId: user.id, source: "leads", searchId: profile.id, provider: "apify", operation: "fetchProfilePosts", estimatedCost: API_COSTS.apify.fetchProfilePosts, metadata: { slug: compSlug, context: "user-competitor-freq" } });
            const postsPerMonth = computePostsPerMonth(posts);

            // Search executives
            const { active: activeEmps, inactive: inactiveEmps } = await findActiveEmployees(compSlug, String(realName), user.id, profile.id, 12, true, country);
            console.log(`[analyze]   Competitor ${realName}: ${activeEmps.length} active, ${inactiveEmps.length} inactive executives`);

            return {
              comp: { name: String(realName), logoUrl: String(logoUrl), url: companyUrl, score: 0, reason: "user-provided", selected: true, postsPerMonth, employeeCount } as CompetitorEntry,
              activeEmps,
              inactiveEmps,
              brands: compBrands,
            };
          })
        );

        for (const r of compResults) {
          if (!r) continue;
          competitors.push(r.comp);
          competitorEmployees[r.comp.name] = r.activeEmps;
          inactiveCompetitorEmployees[r.comp.name] = r.inactiveEmps;
          if (r.brands.length > 0) competitorBrands[r.comp.name] = r.brands;
        }
        console.log(`[analyze] Company ${slug}: ${competitors.length} user-provided competitors processed`);
      } else {
        // ---- NO COMPETITORS: skip SERP discovery ----
        console.log(`[analyze] Company ${slug}: no competitors provided, skipping competitor discovery`);
      }

      // NOTE: SERP competitor discovery code is available in /api/sol/discover-competitors for on-demand use

      const employeeProfiles = allEmployees.map((e) => ({
        name: e.name, slug: e.slug, headline: e.headline,
        linkedinUrl: e.linkedinUrl, profilePicUrl: e.profilePicUrl,
        postsPerMonth: e.postsPerMonth,
      }));

      const optionsPayload = {
        profile_id: profile.id,
        market_context: enrichedThemes,
        competitors,
        employee_profiles: employeeProfiles,
        icp_description: "",
        company_posts_per_month: companyPostsPerMonth,
        proprietary_brands: mainBrands.length > 0 ? mainBrands : [companyInfo?.name ?? slug.replace(/-/g, " ")],
        job_titles: [],
        departments: [],
        company_sizes: [],
        ai_response: { ...aiResult, companyInfo, employeeCount: allEmployees.length, competitor_employees: competitorEmployees, inactive_competitor_employees: inactiveCompetitorEmployees, inactive_employees: inactiveEmployees, company_brands: mainBrands, competitor_brands: competitorBrands, country },
      };

      const { data: savedOptions, error: optError } = await service
        .from("lg_options")
        .insert(optionsPayload)
        .select()
        .single();

      if (optError) {
        console.error(`[analyze] Company ${slug}: lg_options insert failed:`, optError.message);
        if (optError.message.includes("competitors") || optError.message.includes("employee_profiles") || optError.message.includes("icp_description")) {
          console.error(`[analyze] MIGRATION 038 NOT APPLIED — run migrations/038_lg_options_share_of_linkedin.sql in Supabase!`);
        }
        if (optError.message.includes("company_posts_per_month") || optError.message.includes("proprietary_brands")) {
          console.error(`[analyze] MIGRATION 043 NOT APPLIED — run migrations/043_posts_per_month_and_brands.sql in Supabase!`);
        }
      } else {
        console.log(`[analyze] Company ${slug}: options saved — competitors=${savedOptions?.competitors?.length ?? 0}, employees=${(savedOptions?.employee_profiles as unknown[])?.length ?? 0}, brands=${(savedOptions?.proprietary_brands as unknown[])?.length ?? 0}, companyPPM=${savedOptions?.company_posts_per_month ?? "null"}`);
      }

      return NextResponse.json({
        profile,
        posts: posts.map((p) => ({ post_url: p.post_url, text_content: p.text_content?.slice(0, 200), reactions: p.reactions, comments: p.comments, posted_at: p.posted_at })),
        options: savedOptions ?? optionsPayload,
        isCompany: true,
      });
    } catch (err) {
      console.error("[analyze] Company analysis failed:", err);
      notifyError("analyze-company", err, { userId: user.id, profileId: profile.id, slug });
      // Return partial success — profile was created, options can be added manually
      return NextResponse.json({
        error: "Não foi possível mapear completamente esta empresa. Tente novamente.",
        profile,
        posts: [],
        options: null,
        isCompany: true,
      }, { status: 200 }); // 200 so the frontend still redirects
    }
  }

  // ==================================================================
  // PERSON FLOW — Legacy leads generation (backward compatible)
  // ==================================================================

  // Fetch posts via Apify
  const rawPosts = await fetchProfilePosts(cleanProfileUrl, 10);
  logApiCost({ userId: user.id, source: "leads", searchId: profile.id, provider: "apify", operation: "fetchProfilePosts", estimatedCost: API_COSTS.apify.fetchProfilePosts, metadata: { postsFound: rawPosts.length } });

  // Extract and save posts
  const posts = rawPosts.map((p) => ({
    profile_id: profile.id,
    post_url: extractPostUrl(p),
    text_content: extractText(p),
    reactions: extractCount(p, ["reactionCount", "numReactions"], ["reactions", "reactionIds"]),
    comments: extractCount(p, ["commentCount", "numComments"], ["comments", "commentIds"]),
    posted_at: String(p.postedAt ?? p.publishedAt ?? p.date ?? ""),
    raw_data: p,
  }));

  if (posts.length > 0) {
    await service.from("lg_posts").insert(posts);
  }

  // Extract author info from first post if available
  const firstPost = rawPosts[0];
  if (firstPost) {
    const author = firstPost.author as Record<string, unknown> | undefined;
    if (author) {
      const name = String(author.name ?? author.firstName ?? slug);
      const headline = String(author.headline ?? author.position ?? "");
      const photo = String(author.profilePicture ?? author.pictureUrl ?? author.profilePhoto ?? "");
      await service.from("lg_profiles").update({ name, headline, profile_photo: photo }).eq("id", profile.id);
      profile.name = name;
      profile.headline = headline;
    }
  }

  // AI analysis
  const postTexts = posts.map((p) => p.text_content).filter(Boolean);
  const aiResult = await analyzeProfileForLeads(
    profile.name ?? slug,
    profile.headline ?? "",
    postTexts,
  );
  logApiCost({ userId: user.id, source: "leads", searchId: profile.id, provider: "openrouter", operation: "analyzeProfileForLeads", estimatedCost: API_COSTS.openrouter.classifyTopics, metadata: { postsAnalyzed: postTexts.length } });

  // Save options
  const options = {
    profile_id: profile.id,
    market_context: aiResult?.market_context ?? "",
    job_titles: aiResult?.job_titles ?? [],
    departments: aiResult?.departments ?? [],
    company_sizes: aiResult?.company_sizes ?? ["51-200"],
    ai_response: aiResult,
  };

  const { data: savedOptions } = await service
    .from("lg_options")
    .insert(options)
    .select()
    .single();

  return NextResponse.json({
    profile,
    posts: posts.map((p) => ({ post_url: p.post_url, text_content: p.text_content?.slice(0, 200), reactions: p.reactions, comments: p.comments, posted_at: p.posted_at })),
    options: savedOptions,
  });
}
