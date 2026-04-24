import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchProfilePosts, fetchLinkedInProfileApify, fetchLinkedInCompany, searchGoogleApify } from "@/lib/apify";
import { analyzeProfileForLeads, analyzeCompanyForShareOfLinkedin, scoreCompetitorAdherence } from "@/lib/ai";
import { scrapeWebsite } from "@/lib/firecrawl";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { isApifyBlocked } from "@/lib/apify-usage";
import { buildCompanyBlacklist } from "@/lib/company-match";
import { notifyError } from "@/lib/error-notifier";

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
  const { profileUrl } = body;
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
      // Find active employees: Google SERP → profile details → check posts.
      // Strategy: search LinkedIn for people at this company with relevant
      // titles, then verify each candidate posts at least 1x/month.
      // ------------------------------------------------------------------
      const companyName = companyInfo?.name ?? slug.replace(/-/g, " ");
      console.log(`[analyze] Company ${slug}: searching employees via SERP...`);

      // Run 3 SERP queries in parallel:
      // 1. Full company name + C-levels (finds CEO/CTO/Directors — highest priority)
      // 2. Company slug (finds people who mention it in their profile)
      // 3. Full company name + mid-level roles
      // Using the full company name (e.g., "Dedalus Prime" not just "Dedalus") avoids
      // matching employees of unrelated companies with similar names.
      // Use slug-based name ("Dedalus Prime") for more specific matching
      // vs companyInfo.name which might be shorter ("Dedalus")
      const slugName = slug.replace(/-/g, " ");
      const serpQueries = [
        `site:linkedin.com/in "${slugName}" CEO OR CTO OR Director OR Diretor OR Head OR VP OR Founder OR Sócio`,
        `site:linkedin.com/in "${slug}"`,
        `site:linkedin.com/in "${slugName}" manager OR gerente OR lead OR senior OR architect OR engineer`,
      ];
      const seenSlugs = new Set<string>();
      let empCandidateSlugs: string[] = [];
      try {
        const serpResults = await Promise.all(
          serpQueries.map((q) =>
            searchGoogleApify(q, { results: 15 }).catch(() => ({ results: [] }))
          )
        );
        for (const sr of serpResults) {
          for (const r of sr.results) {
            const s = r.link.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? "";
            if (s && s.length > 2 && !seenSlugs.has(s)) {
              seenSlugs.add(s);
              empCandidateSlugs.push(s);
            }
          }
        }
        // Cap at 12 candidates to keep response under 90s (each takes ~10-15s in batches of 5)
        if (empCandidateSlugs.length > 12) {
          empCandidateSlugs = empCandidateSlugs.slice(0, 12);
        }
        console.log(`[analyze] Company ${slug}: SERP found ${empCandidateSlugs.length} candidate slugs (capped at 12) from ${serpQueries.length} queries`);
      } catch (err) {
        console.error(`[analyze] Company ${slug}: SERP employee search failed:`, err);
      }

      // Fetch profiles + check posting for each candidate (concurrency 5)
      type EmpCandidate = { name: string; slug: string; headline: string; linkedinUrl: string; profilePicUrl: string };
      const allEmployees: EmpCandidate[] = [];
      // Broad regex: any role that's manager-level, senior specialist, or executive.
      // Includes both abbreviations (CEO, CTO) and full titles (Chief Technology Officer).
      const TITLE_RE = /director|diretor|head of|gerente|manager|vp |vice.?president|chief|ceo|cto|cfo|coo|cmo|founder|fundador|sócio|partner|lead|coordenador|specialist|especialista|senior|sênior|sr\.|architect|arquiteto|consultant|consultor|pre.?sales|executive|executiv|sales|comercial|engineer|engenheiro|analyst|analista|officer|technical|development|innovation|strategy|strategist/i;

      for (let i = 0; i < empCandidateSlugs.length; i += 5) {
        const batch = empCandidateSlugs.slice(i, i + 5);
        const results = await Promise.all(batch.map(async (empSlug) => {
          try {
            const profileRes = await fetchLinkedInProfileApify(empSlug);
            if (profileRes.status !== 200 || !profileRes.data) return null;
            const d = profileRes.data as Record<string, unknown>;
            const headline = String(d.headline ?? "");
            const name = String(d.name ?? d.fullName ?? "");

            // Filter 1: must CURRENTLY work at this company (not a former employee)
            const targetLower = companyName.toLowerCase();
            const slugLower = slug.toLowerCase().replace(/-/g, " ");
            let worksHere = false;

            // Check currentPosition array (most reliable)
            const cp = d.currentPosition;
            if (Array.isArray(cp) && cp.length > 0) {
              for (const pos of cp as Array<{ companyName?: string }>) {
                const cn = String(pos.companyName ?? "").toLowerCase();
                if (cn && (cn.includes(targetLower) || targetLower.includes(cn) || cn.includes(slugLower) || slugLower.includes(cn))) {
                  worksHere = true;
                  break;
                }
              }
            }

            // Check experience[0] with end_date "Present" as fallback
            if (!worksHere) {
              const exp = d.experience;
              if (Array.isArray(exp) && exp.length > 0) {
                const first = exp[0] as { company?: string; company_name?: string; companyName?: string; end_date?: { text?: string }; ends_at?: { text?: string } };
                const endText = String(first.end_date?.text ?? first.ends_at?.text ?? "").toLowerCase();
                if (endText.includes("present")) {
                  const cn = String(first.company ?? first.company_name ?? first.companyName ?? "").toLowerCase();
                  if (cn && (cn.includes(targetLower) || targetLower.includes(cn) || cn.includes(slugLower) || slugLower.includes(cn))) {
                    worksHere = true;
                  }
                }
              }
            }

            // Last fallback: d.company field
            if (!worksHere) {
              const compField = String(d.company ?? "").toLowerCase();
              if (compField && (compField.includes(targetLower) || targetLower.includes(compField) || compField.includes(slugLower) || slugLower.includes(compField))) {
                worksHere = true;
              }
            }

            if (!worksHere) {
              const currentCo = Array.isArray(cp) && cp.length > 0 ? String((cp[0] as { companyName?: string }).companyName ?? "") : String(d.company ?? "");
              console.log(`[analyze]   skip ${empSlug}: currently at "${currentCo}", not "${companyName}"`);
              return null;
            }

            // Filter 2: title must be manager/senior+ level
            if (!TITLE_RE.test(headline)) {
              console.log(`[analyze]   skip ${empSlug}: title "${headline.slice(0, 50)}" not senior enough`);
              return null;
            }

            // Filter 3: must post at least 1x/month (check 3 recent posts)
            const empPosts = await fetchProfilePosts(`https://www.linkedin.com/in/${empSlug}/`, 3);
            if (empPosts.length === 0) {
              console.log(`[analyze]   skip ${empSlug}: no posts`);
              return null;
            }

            // Get photo
            const picCandidates = [d.profilePicture, d.picture, d.profile_photo, d.profile_pic_url];
            let pic = "";
            for (const c of picCandidates) {
              if (typeof c === "string" && c.startsWith("http")) { pic = c; break; }
            }

            console.log(`[analyze]   ✓ ${name} — ${headline.slice(0, 50)} — ${empPosts.length} posts`);
            return {
              name,
              slug: empSlug,
              headline,
              linkedinUrl: `https://www.linkedin.com/in/${empSlug}`,
              profilePicUrl: pic,
            } as EmpCandidate;
          } catch (err) {
            console.log(`[analyze]   error fetching ${empSlug}: ${(err as Error).message}`);
            return null;
          }
        }));
        allEmployees.push(...results.filter((r): r is EmpCandidate => r !== null));
      }
      console.log(`[analyze] Company ${slug}: ${allEmployees.length} active employees found (from ${empCandidateSlugs.length} candidates)`);

      // 4. AI analysis: extract themes + competitors
      console.log(`[analyze] Company ${slug}: running AI analysis...`);
      const aiResult = await analyzeCompanyForShareOfLinkedin(
        companyInfo?.name ?? slug.replace(/-/g, " "),
        companyInfo?.description ?? "",
        companyInfo?.specialties ?? "",
        companyInfo?.industry ?? "",
        allEmployees.map((e) => e.headline),
      );
      logApiCost({ userId: user.id, source: "leads", searchId: profile.id, provider: "openrouter", operation: "analyzeCompanyForShareOfLinkedin", estimatedCost: API_COSTS.openrouter.classifyTopics });
      console.log(`[analyze] Company ${slug}: AI returned themes="${(aiResult?.themes ?? "").slice(0, 80)}..." competitors=${JSON.stringify(aiResult?.competitors ?? [])}`);

      // 5. Fetch competitor LinkedIn pages (logos + website URLs)
      const aiCompNames = (aiResult?.competitors ?? []).filter(Boolean);
      console.log(`[analyze] Company ${slug}: fetching ${aiCompNames.length} competitors from LinkedIn...`);
      const competitorData = await Promise.all(
        aiCompNames.slice(0, 8).map(async (cname) => {
          const compSlug = cname.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          try {
            const cr = await fetchLinkedInCompany(compSlug);
            const logo = cr.data?.profilePicUrl ?? "";
            const realName = cr.data?.name ?? cname;
            const url = cr.status === 200 ? `https://www.linkedin.com/company/${compSlug}/` : "";
            const websiteUrl = (cr.data as unknown as Record<string, unknown>)?.websiteUrl ?? cr.data?.website ?? "";
            return { name: realName || cname, logoUrl: logo, url, websiteUrl: String(websiteUrl) };
          } catch {
            return { name: cname, logoUrl: "", url: "", websiteUrl: "" };
          }
        })
      );

      // 6. Firecrawl: scrape company + competitor websites for adherence scoring
      console.log(`[analyze] Company ${slug}: scraping websites with Firecrawl...`);
      const companyWebsite = (companyInfo as unknown as Record<string, unknown>)?.websiteUrl ?? (companyInfo as unknown as Record<string, unknown>)?.website ?? "";
      let companySiteContent = "";
      if (companyWebsite) {
        const scrape = await scrapeWebsite(String(companyWebsite), { userId: user.id, searchId: profile.id });
        if (scrape) companySiteContent = `${scrape.title}. ${scrape.description}. ${scrape.content}`;
      }

      const competitorScrapes = await Promise.all(
        competitorData.map(async (c) => {
          if (!c.websiteUrl) return { ...c, siteContent: "", score: 0, reason: "", selected: false };
          const scrape = await scrapeWebsite(c.websiteUrl, { userId: user.id, searchId: profile.id });
          const content = scrape ? `${scrape.title}. ${scrape.description}. ${scrape.content}` : "";
          return { ...c, siteContent: content, score: 0, reason: "", selected: false };
        })
      );

      // 7. AI: score competitor adherence + enrich themes
      let enrichedThemes = aiResult?.themes ?? "";
      const competitorsWithScores = competitorScrapes.map((c) => ({ ...c }));

      // Score ALL competitors — those with site data get richer analysis, others scored by AI knowledge
      const allForScoring = competitorScrapes.map((c) => ({
        name: c.name,
        siteContent: c.siteContent.length > 50 ? c.siteContent : `(no website data - score based on company name and market knowledge)`,
      }));
      if (allForScoring.length > 0) {
        console.log(`[analyze] Company ${slug}: scoring ${allForScoring.length} competitors (${competitorScrapes.filter(c => c.siteContent.length > 50).length} with site data)...`);
        const scoreResult = await scoreCompetitorAdherence(
          companyInfo?.name ?? slug,
          companyInfo?.description ?? "",
          companySiteContent,
          allForScoring,
        );
        logApiCost({ userId: user.id, source: "leads", searchId: profile.id, provider: "openrouter", operation: "scoreCompetitorAdherence", estimatedCost: API_COSTS.openrouter.classifyTopics });

        if (scoreResult) {
          if (scoreResult.enrichedThemes) enrichedThemes = scoreResult.enrichedThemes;
          for (const s of scoreResult.scores) {
            const match = competitorsWithScores.find((c) => c.name.toLowerCase() === s.name.toLowerCase());
            if (match) { match.score = s.score; match.reason = s.reason; }
          }
        }
      }

      // Select top 2 competitors by score
      const sorted = [...competitorsWithScores].sort((a, b) => b.score - a.score);
      const topNames = new Set(sorted.slice(0, 2).filter((c) => c.score > 0).map((c) => c.name));
      for (const c of competitorsWithScores) { c.selected = topNames.has(c.name); }

      // Build final competitors array (drop siteContent to save DB space)
      const competitors = competitorsWithScores.map(({ siteContent: _, ...rest }) => rest);
      console.log(`[analyze] Company ${slug}: ${competitors.length} competitors, ${competitors.filter(c => c.score > 0).length} scored, ${competitors.filter(c => c.selected).length} selected`);

      const employeeProfiles = allEmployees.map((e) => ({
        name: e.name, slug: e.slug, headline: e.headline,
        linkedinUrl: e.linkedinUrl, profilePicUrl: e.profilePicUrl,
      }));

      const optionsPayload = {
        profile_id: profile.id,
        market_context: enrichedThemes,
        competitors,
        employee_profiles: employeeProfiles,
        icp_description: "",
        job_titles: [],
        departments: [],
        company_sizes: [],
        ai_response: { ...aiResult, companyInfo, employeeCount: allEmployees.length },
      };

      const { data: savedOptions, error: optError } = await service
        .from("lg_options")
        .insert(optionsPayload)
        .select()
        .single();

      if (optError) {
        console.error(`[analyze] Company ${slug}: lg_options insert failed:`, optError.message);
        // Check if new columns exist
        if (optError.message.includes("competitors") || optError.message.includes("employee_profiles") || optError.message.includes("icp_description")) {
          console.error(`[analyze] MIGRATION 038 NOT APPLIED — run migrations/038_lg_options_share_of_linkedin.sql in Supabase!`);
        }
      } else {
        console.log(`[analyze] Company ${slug}: options saved successfully — competitors=${savedOptions?.competitors?.length ?? 0}, employees=${(savedOptions?.employee_profiles as unknown[])?.length ?? 0}`);
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
