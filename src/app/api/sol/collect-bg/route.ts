import { createClient } from "@supabase/supabase-js";
import { fetchProfilePosts, fetchPostEngagers, searchLinkedInPosts, searchGoogleApify } from "@/lib/apify";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { notifyError } from "@/lib/error-notifier";
import { extractPostDate, computePostsPerMonth } from "@/lib/find-employees";
import { classifyPost, classifySentiment, generateSolRecommendations } from "@/lib/ai";

export const maxDuration = 600;

interface CollectParams {
  reportId: string;
  profileId: string;
}

interface CompetitorObj {
  name?: string;
  url?: string;
  selected?: boolean;
}

interface EmployeeProfile {
  name: string;
  slug: string;
  headline: string;
  linkedinUrl?: string;
}

interface SolPostRow {
  id: string;
  text_content: string | null;
  post_url: string | null;
  company_name: string;
  source_type: string;
  profile_slug: string;
  author_name: string | null;
  author_headline: string | null;
  reactions: number;
  comments: number;
  rer_estimate: number | null;
  rer_sample_size: number | null;
  theme: string | null;
  content_type: string | null;
  summary: string | null;
}

function extractSlug(linkedinUrl: string, type: "company" | "person"): string {
  if (type === "company") {
    const match = linkedinUrl.match(/linkedin\.com\/company\/([^/?#]+)/);
    return match ? match[1].replace(/\/$/, "") : "";
  }
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
  return match ? match[1].replace(/\/$/, "") : "";
}

function extractPostInfo(raw: Record<string, unknown>) {
  const shareUrn = String(raw.shareUrn ?? raw.entityId ?? "");
  const postUrl = shareUrn.includes("urn:li:")
    ? `https://www.linkedin.com/feed/update/${shareUrn}`
    : String(raw.linkedinUrl ?? raw.postUrl ?? raw.url ?? "");

  const textContent = String(raw.content ?? raw.text ?? raw.postText ?? "");

  // Reactions & comments — try engagement object first, then top-level
  const eng = (raw.engagement && typeof raw.engagement === "object" ? raw.engagement : {}) as Record<string, unknown>;
  const reactions = Number(eng.numLikes ?? eng.reactionCount ?? eng.likes ?? eng.reactions ?? raw.numLikes ?? 0) || 0;
  const comments = Number(eng.numComments ?? eng.commentCount ?? eng.comments ?? raw.numComments ?? 0) || 0;

  // Author
  const author = (raw.author && typeof raw.author === "object" ? raw.author : {}) as Record<string, unknown>;
  const authorName = String(author.name ?? author.fullName ?? "");
  const authorHeadline = String(author.headline ?? author.position ?? "");
  const authorSlug = String(author.publicIdentifier ?? author.universalName ?? "");

  // Posted date — harvestapi returns postedAt as object {date, timestamp}
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

  return { postUrl, textContent, reactions, comments, authorName, authorHeadline, authorSlug, postedDate };
}

export async function POST(request: Request) {
  const params: CollectParams = await request.json();
  const { reportId, profileId } = params;

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    // Fetch report to get period
    const { data: report } = await service
      .from("sol_reports")
      .select("period_start, period_end, status")
      .eq("id", reportId)
      .single();

    if (!report || report.status === "cancelled") {
      console.log(`[sol-collect] Report ${reportId} not found or cancelled, aborting`);
      return new Response("OK");
    }

    const periodStart = new Date(report.period_start);
    const periodEnd = new Date(report.period_end + "T23:59:59.999Z");

    // Fetch profile and options
    const { data: profileData } = await service
      .from("lg_profiles")
      .select("id, name, linkedin_url, user_id")
      .eq("id", profileId)
      .single();

    if (!profileData) {
      await service.from("sol_reports").update({ status: "failed" }).eq("id", reportId);
      return new Response("Profile not found");
    }

    const { data: optionsData } = await service
      .from("lg_options")
      .select("competitors, employee_profiles, ai_response, market_context, proprietary_brands")
      .eq("profile_id", profileId)
      .single();

    if (!optionsData) {
      await service.from("sol_reports").update({ status: "failed" }).eq("id", reportId);
      return new Response("Options not found");
    }

    const userId = profileData.user_id;
    const companySlug = extractSlug(profileData.linkedin_url, "company");
    const companyName = profileData.name;

    // Build list of profiles to fetch
    interface FetchTarget {
      url: string;
      maxPosts: number;
      sourceType: "company" | "employee";
      companyName: string;
      profileSlug: string;
      authorName: string;
      authorHeadline: string;
    }

    const targets: FetchTarget[] = [];

    // 1. Main company page
    if (companySlug) {
      targets.push({
        url: `https://www.linkedin.com/company/${companySlug}/`,
        maxPosts: 100,
        sourceType: "company",
        companyName,
        profileSlug: companySlug,
        authorName: companyName,
        authorHeadline: "",
      });
    }

    // 2. Main company employees
    const employees = (optionsData.employee_profiles ?? []) as EmployeeProfile[];
    for (const emp of employees) {
      if (!emp.slug) continue;
      targets.push({
        url: `https://www.linkedin.com/in/${emp.slug}/`,
        maxPosts: 15,
        sourceType: "employee",
        companyName,
        profileSlug: emp.slug,
        authorName: emp.name,
        authorHeadline: emp.headline ?? "",
      });
    }

    // 3. Competitors (selected only)
    const competitors = (optionsData.competitors ?? []) as CompetitorObj[];
    const selectedCompetitors = competitors.filter(
      (c): c is CompetitorObj & { url: string; name: string } =>
        typeof c === "object" && c !== null && c.selected === true && !!c.url && !!c.name
    );

    const aiResponse = (optionsData.ai_response ?? {}) as Record<string, unknown>;
    const competitorEmployees = (aiResponse.competitor_employees ?? {}) as Record<string, EmployeeProfile[]>;

    for (const comp of selectedCompetitors) {
      const slug = extractSlug(comp.url, "company");
      if (!slug) continue;

      // Competitor company page
      targets.push({
        url: `https://www.linkedin.com/company/${slug}/`,
        maxPosts: 100,
        sourceType: "company",
        companyName: comp.name,
        profileSlug: slug,
        authorName: comp.name,
        authorHeadline: "",
      });

      // Competitor employees
      const compEmps = competitorEmployees[comp.name] ?? [];
      for (const emp of compEmps) {
        if (!emp.slug) continue;
        targets.push({
          url: emp.linkedinUrl ?? `https://www.linkedin.com/in/${emp.slug}/`,
          maxPosts: 15,
          sourceType: "employee",
          companyName: comp.name,
          profileSlug: emp.slug,
          authorName: emp.name,
          authorHeadline: emp.headline ?? "",
        });
      }
    }

    console.log(`[sol-collect] Report ${reportId}: fetching posts from ${targets.length} profiles`);

    let totalPostsCollected = 0;

    // Process targets sequentially to avoid rate limits
    for (const target of targets) {
      // Check if report was cancelled mid-collection
      const { data: statusCheck } = await service
        .from("sol_reports")
        .select("status")
        .eq("id", reportId)
        .single();

      if (statusCheck?.status === "cancelled") {
        console.log(`[sol-collect] Report ${reportId} cancelled, stopping`);
        return new Response("Cancelled");
      }

      console.log(`[sol-collect] Fetching posts for ${target.url} (${target.sourceType})`);

      const posts = await fetchProfilePosts(target.url, target.maxPosts);

      logApiCost({
        userId,
        source: "sol",
        searchId: reportId,
        provider: "apify",
        operation: "fetchProfilePosts",
        estimatedCost: API_COSTS.apify.fetchProfilePosts,
        metadata: { profileSlug: target.profileSlug, postsReturned: posts.length },
      });

      // Filter to period and insert
      const postsInPeriod = posts.filter((p) => {
        const info = extractPostInfo(p);
        if (!info.postedDate) return false;
        return info.postedDate >= periodStart && info.postedDate <= periodEnd;
      });

      console.log(`[sol-collect] ${target.profileSlug}: ${posts.length} posts fetched, ${postsInPeriod.length} in period ${report.period_start} to ${report.period_end}`);

      if (postsInPeriod.length === 0) continue;

      const rows = postsInPeriod.map((p) => {
        const info = extractPostInfo(p);
        return {
          report_id: reportId,
          profile_slug: info.authorSlug || target.profileSlug,
          company_name: target.companyName,
          source_type: target.sourceType,
          author_name: info.authorName || target.authorName,
          author_headline: info.authorHeadline || target.authorHeadline,
          post_url: info.postUrl,
          text_content: info.textContent,
          reactions: info.reactions,
          comments: info.comments,
          posted_at: info.postedDate?.toISOString() ?? null,
        };
      });

      const { error: insertError } = await service.from("sol_posts").insert(rows);
      if (insertError) {
        console.error(`[sol-collect] Insert error for ${target.profileSlug}:`, insertError.message);
      } else {
        totalPostsCollected += rows.length;
      }
    }

    console.log(`[sol-collect] Report ${reportId}: collected ${totalPostsCollected} posts total`);

    // ============================================================
    // Phase 2: Classify posts via AI
    // ============================================================
    const marketContext = optionsData.market_context ?? "";
    const { data: allPosts } = await service
      .from("sol_posts")
      .select("id, text_content, post_url, company_name, source_type, author_name, reactions, comments, rer_estimate")
      .eq("report_id", reportId);

    if (allPosts && allPosts.length > 0) {
      console.log(`[sol-collect] Classifying ${allPosts.length} posts...`);
      const BATCH_SIZE = 5;
      for (let i = 0; i < allPosts.length; i += BATCH_SIZE) {
        // Check cancellation
        const { data: sc } = await service.from("sol_reports").select("status").eq("id", reportId).single();
        if (sc?.status === "cancelled") return new Response("Cancelled");

        const batch = allPosts.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (post) => {
            const text = post.text_content ?? "";
            if (!text.trim()) return { id: post.id, theme: "outros", content_type: "outros", summary: "" };
            const result = await classifyPost(text, marketContext);
            logApiCost({
              userId,
              source: "sol",
              searchId: reportId,
              provider: "openrouter",
              operation: "classifyPost",
              estimatedCost: API_COSTS.openrouter.classifyTopics,
              metadata: { postId: post.id },
            });
            return { id: post.id, ...result };
          })
        );
        for (const r of results) {
          await service.from("sol_posts").update({
            theme: r.theme,
            content_type: r.content_type,
            summary: r.summary,
          }).eq("id", r.id);
        }
        console.log(`[sol-collect] Classified posts ${i + 1}-${Math.min(i + BATCH_SIZE, allPosts.length)}`);
      }
    }

    // ============================================================
    // Phase 3: Sample engagers for RER estimation
    // ============================================================
    const postsForEngagers = allPosts?.filter((p) => p.post_url) ?? [];
    console.log(`[sol-collect] Sampling engagers for ${postsForEngagers.length} posts...`);

    for (const post of postsForEngagers) {
      const { data: sc } = await service.from("sol_reports").select("status").eq("id", reportId).single();
      if (sc?.status === "cancelled") return new Response("Cancelled");

      try {
        const { reactions: rxEngagers, comments: cmEngagers } = await fetchPostEngagers(
          post.post_url!, 10, 10,
          { userId, source: "sol", searchId: reportId }
        );

        const allEngagers = [...rxEngagers, ...cmEngagers];
        // supreme_coder wraps data in { type, actor: {...} } — unwrap actor
        const sample = allEngagers.map((e) => {
          const raw = e as Record<string, unknown>;
          const actor = (raw.actor && typeof raw.actor === "object" ? raw.actor : raw) as Record<string, unknown>;
          return {
            name: String(actor.name ?? raw.name ?? ""),
            headline: String(actor.position ?? actor.headline ?? raw.position ?? raw.headline ?? ""),
            linkedinUrl: String(actor.linkedinUrl ?? raw.linkedinUrl ?? ""),
          };
        });

        const decisorRegex = /\b(CEO|CTO|CFO|COO|CMO|CIO|CRO|CHRO|VP|Vice.?Pres|Director|Diretor|Head\s+(?:of|de)|Gerente|Manager|Partner|Founder|Fundador|Co.?Founder|S[oó]cio|C-Level|Chief|Managing\s+Director|President|Presidente|Owner|Propriet[aá]rio|Country.?Manager|General.?Manager|Regional|Coordenador|Supervisor|Lead(?:er)?|Principal|Senior\s+Director|Executive\s+Director|Board|Conselheiro)\b/i;
        const decisorCount = sample.filter((e) => decisorRegex.test(e.headline)).length;
        const rerEstimate = sample.length > 0 ? Math.round((decisorCount / sample.length) * 100) : 0;

        await service.from("sol_posts").update({
          rer_estimate: rerEstimate,
          rer_sample_size: sample.length,
          engager_sample: sample.slice(0, 20),
        }).eq("id", post.id);

        const decisorHeadlines = sample.filter((e) => decisorRegex.test(e.headline)).map((e) => e.headline.slice(0, 50));
        console.log(`[sol-collect] Post ${post.id.slice(0, 8)}: ${sample.length} engagers, ${decisorCount} decisors, RER=${rerEstimate}%${decisorHeadlines.length ? " decisors=" + JSON.stringify(decisorHeadlines) : ""}`);
      } catch (err) {
        console.error(`[sol-collect] Engagers error for post ${post.id.slice(0, 8)}:`, err instanceof Error ? err.message : err);
      }
    }

    // ============================================================
    // Phase 4: Calculate metrics per company
    // ============================================================
    const { data: finalPosts } = await service
      .from("sol_posts")
      .select("*")
      .eq("report_id", reportId) as { data: SolPostRow[] | null };

    if (finalPosts && finalPosts.length > 0) {
      const companyMap = new Map<string, SolPostRow[]>();
      for (const p of finalPosts) {
        const arr = companyMap.get(p.company_name) ?? [];
        arr.push(p);
        companyMap.set(p.company_name, arr);
      }

      const companies: Record<string, unknown> = {};
      const collaborators: Record<string, unknown[]> = {};
      let maxRawSol = 0;

      const compEntries: Array<[string, SolPostRow[]]> = [];
      companyMap.forEach((v, k) => compEntries.push([k, v]));

      for (const [compName, posts] of compEntries) {
        const postsCount = posts.length;
        const engagementTotal = posts.reduce((s: number, p: SolPostRow) => s + (p.reactions ?? 0) + (p.comments ?? 0), 0);
        const postsWithRer = posts.filter((p: SolPostRow) => p.rer_estimate != null && p.rer_sample_size && p.rer_sample_size > 0);
        const rerAvg = postsWithRer.length > 0 ? Math.round(postsWithRer.reduce((s: number, p: SolPostRow) => s + (p.rer_estimate ?? 0), 0) / postsWithRer.length) : 0;
        const decisoresEstimated = Math.round((rerAvg / 100) * engagementTotal);

        // Content composition
        const composition: Record<string, number> = { produto: 0, institucional: 0, vagas: 0, outros: 0 };
        for (const p of posts) composition[p.content_type ?? "outros"] = (composition[p.content_type ?? "outros"] ?? 0) + 1;

        // Top themes
        const themeCount: Record<string, number> = {};
        for (const p of posts) {
          if (p.theme) themeCount[p.theme] = (themeCount[p.theme] ?? 0) + 1;
        }
        const topThemes = Object.entries(themeCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

        // Use max(rerAvg, 1) so SOL isn't zero when no decisors are sampled
        const rerForSol = Math.max(rerAvg, 1);
        const rawSol = postsCount * (rerForSol / 100) * engagementTotal;
        if (rawSol > maxRawSol) maxRawSol = rawSol;

        companies[compName] = {
          posts_count: postsCount,
          engagement_total: engagementTotal,
          rer_avg: rerAvg,
          decisores_estimated: decisoresEstimated,
          top_themes: topThemes,
          content_composition: composition,
          raw_sol: rawSol,
        };

        // Collaborators
        const empPosts = posts.filter((p: SolPostRow) => p.source_type === "employee");
        const empMap = new Map<string, SolPostRow[]>();
        for (const p of empPosts) {
          const key = p.profile_slug;
          const arr = empMap.get(key) ?? [];
          arr.push(p);
          empMap.set(key, arr);
        }

        const empEntries: Array<[string, SolPostRow[]]> = [];
        empMap.forEach((v, k) => empEntries.push([k, v]));
        collaborators[compName] = empEntries.map(([slug, eps]) => {
          const engagement = eps.reduce((s: number, p: SolPostRow) => s + (p.reactions ?? 0) + (p.comments ?? 0), 0);
          const epsWithRer = eps.filter((p: SolPostRow) => p.rer_estimate != null);
          const empRer = epsWithRer.length > 0 ? Math.round(epsWithRer.reduce((s: number, p: SolPostRow) => s + (p.rer_estimate ?? 0), 0) / epsWithRer.length) : 0;
          const catCount: Record<string, number> = {};
          for (const p of eps) if (p.content_type) catCount[p.content_type] = (catCount[p.content_type] ?? 0) + 1;
          const mainCategory = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "outros";
          const adherence = empRer >= 30 ? "alta" : empRer >= 15 ? "média" : "baixa";
          return {
            name: eps[0]?.author_name ?? slug,
            slug,
            headline: eps[0]?.author_headline ?? "",
            posts: eps.length,
            engagement,
            rer_avg: empRer,
            main_category: mainCategory,
            adherence,
          };
        });
      }

      // Normalize SOL scores to 0-10 scale
      for (const comp of Object.values(companies)) {
        const c = comp as Record<string, unknown>;
        c.sol_score = maxRawSol > 0 ? Math.round(((c.raw_sol as number) / maxRawSol) * 100) / 10 : 0;
      }

      const metrics = { companies, collaborators };
      await service.from("sol_reports").update({ metrics }).eq("id", reportId);
      console.log(`[sol-collect] Metrics saved for ${Object.keys(companies).length} companies`);
    }

    // ============================================================
    // Phase 5: Share of Voice (mentions of proprietary brands)
    // Phase 5b: Influencers (people talking about market themes)
    // Phase 6: AI synthesis (insights + recommendations + movements)
    // These phases are best-effort; failures don't fail the report.
    // ============================================================

    // Build company → brands map (main + competitors)
    interface CompanyBrandsEntry {
      name: string;
      brand_owner: "main" | "competitor";
      brands: string[];
    }
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

    // Set of own profile slugs (lowercased) — used to exclude self-voice from SOV/Influencers
    const ownSlugs = new Set<string>();
    for (const t of targets) {
      if (t.profileSlug) ownSlugs.add(t.profileSlug.toLowerCase());
    }

    const country = String((aiResponse.country as string | undefined) ?? "");

    // Helper: normalize a search-result post into a SOV mention candidate
    interface MentionCandidate {
      author_name: string;
      author_role: string;
      author_company: string;
      author_linkedin_url: string;
      author_slug: string;
      followers: number;
      post_url: string;
      text: string;
      posted_at: string | null;
      reactions: number;
      comments: number;
    }
    const normalizeMention = (raw: Record<string, unknown>): MentionCandidate | null => {
      const info = extractPostInfo(raw);
      if (!info.postUrl || !info.textContent) return null;
      if (!info.postedDate) return null;
      if (info.postedDate < periodStart || info.postedDate > periodEnd) return null;
      const author = (raw.author && typeof raw.author === "object" ? raw.author : {}) as Record<string, unknown>;
      const authorSlug = String(
        author.publicIdentifier ?? author.universalName ?? info.authorSlug ?? "",
      ).toLowerCase();
      if (authorSlug && ownSlugs.has(authorSlug)) return null;
      const authorLinkedinUrl = String(author.linkedinUrl ?? author.url ?? "");
      const authorCompany = String(
        (author.company && typeof author.company === "object"
          ? (author.company as Record<string, unknown>).name
          : undefined) ??
          author.companyName ??
          author.currentCompany ??
          "",
      );
      const followers = Number(author.followers ?? author.followersCount ?? 0) || 0;
      return {
        author_name: info.authorName,
        author_role: info.authorHeadline,
        author_company: authorCompany,
        author_linkedin_url: authorLinkedinUrl,
        author_slug: authorSlug,
        followers,
        post_url: info.postUrl,
        text: info.textContent,
        posted_at: info.postedDate.toISOString(),
        reactions: info.reactions,
        comments: info.comments,
      };
    };

    // ----------------------------------------------------------
    // Phase 5: SOV — search per-company by their proprietary brands
    // ----------------------------------------------------------
    interface SovMention extends MentionCandidate {
      company_name: string;
      brand_owner: "main" | "competitor";
      brand_term: string;
      sentiment: "positivo" | "neutro" | "negativo";
      summary: string;
    }
    const sovMentions: SovMention[] = [];
    const totalsByCompany: Record<
      string,
      { brand_owner: "main" | "competitor"; positivo: number; neutro: number; negativo: number }
    > = {};

    try {
      const seenPostUrls = new Set<string>();
      for (const cb of companyBrandsList) {
        // cancellation check
        const { data: sc } = await service.from("sol_reports").select("status").eq("id", reportId).single();
        if (sc?.status === "cancelled") return new Response("Cancelled");

        const topBrands = cb.brands.slice(0, 3);
        const queries = topBrands.map((b) => `"${b}"`);
        console.log(`[sol-collect] SOV searching ${cb.name} (${cb.brand_owner}) with queries: ${JSON.stringify(queries)}`);

        let rawPosts: Array<Record<string, unknown>> = [];
        try {
          rawPosts = await searchLinkedInPosts({
            searchQueries: queries,
            maxResults: 20,
            datePosted: "past-month",
            contentLanguage: "pt",
          });
          logApiCost({
            userId,
            source: "sol",
            searchId: reportId,
            provider: "apify",
            operation: "searchLinkedInPosts",
            estimatedCost: API_COSTS.apify.searchLinkedInPosts,
            metadata: { phase: "sov", company: cb.name, returned: rawPosts.length },
          });
        } catch (err) {
          console.error(`[sol-collect] SOV searchLinkedInPosts error for ${cb.name}:`, err instanceof Error ? err.message : err);
        }

        // Fallback to Google SERP if no LinkedIn post results
        if (rawPosts.length === 0 && topBrands.length > 0) {
          try {
            const orQuery = topBrands.map((b) => `"${b}"`).join(" OR ");
            const fallback = await searchGoogleApify(`(${orQuery}) site:linkedin.com`, {
              results: 15,
              tbs: "qdr:m",
              country,
            });
            logApiCost({
              userId,
              source: "sol",
              searchId: reportId,
              provider: "apify",
              operation: "searchGoogleApify",
              estimatedCost: API_COSTS.apify.searchGoogleApify,
              metadata: { phase: "sov-fallback", company: cb.name, returned: fallback.results.length },
            });
            rawPosts = fallback.results as unknown as Array<Record<string, unknown>>;
          } catch (err) {
            console.error(`[sol-collect] SOV fallback SERP error for ${cb.name}:`, err instanceof Error ? err.message : err);
          }
        }

        // Normalize, dedupe, and detect which brand was mentioned
        const candidates: MentionCandidate[] = [];
        for (const raw of rawPosts) {
          const m = normalizeMention(raw);
          if (!m) continue;
          if (seenPostUrls.has(m.post_url)) continue;
          seenPostUrls.add(m.post_url);
          candidates.push(m);
        }

        // Detect brand_term by regex (case-insensitive) — keep only mentions that actually cite a brand
        const brandRegexes = topBrands.map((b) => ({
          brand: b,
          re: new RegExp(`\\b${b.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i"),
        }));
        const cited: Array<MentionCandidate & { brand_term: string }> = [];
        for (const m of candidates) {
          const hit = brandRegexes.find((br) => br.re.test(m.text));
          if (hit) cited.push({ ...m, brand_term: hit.brand });
        }
        console.log(`[sol-collect] SOV ${cb.name}: ${rawPosts.length} fetched, ${candidates.length} normalized, ${cited.length} cite a brand`);

        // Classify sentiment per mention (batches of 5)
        const SENT_BATCH = 5;
        for (let i = 0; i < cited.length; i += SENT_BATCH) {
          const { data: sc2 } = await service.from("sol_reports").select("status").eq("id", reportId).single();
          if (sc2?.status === "cancelled") return new Response("Cancelled");

          const slice = cited.slice(i, i + SENT_BATCH);
          const results = await Promise.all(
            slice.map(async (m) => {
              const r = await classifySentiment(m.text, m.brand_term);
              logApiCost({
                userId,
                source: "sol",
                searchId: reportId,
                provider: "openrouter",
                operation: "classifySentiment",
                estimatedCost: API_COSTS.openrouter.classifySentiment,
                metadata: { phase: "sov", company: cb.name },
              });
              return r;
            }),
          );
          for (let j = 0; j < slice.length; j++) {
            const m = slice[j];
            const r = results[j];
            sovMentions.push({
              ...m,
              company_name: cb.name,
              brand_owner: cb.brand_owner,
              brand_term: m.brand_term,
              sentiment: r.sentiment,
              summary: r.summary,
            });
          }
        }

        // Aggregate totals
        const totals = { brand_owner: cb.brand_owner, positivo: 0, neutro: 0, negativo: 0 };
        for (const m of sovMentions) {
          if (m.company_name === cb.name) totals[m.sentiment] += 1;
        }
        totalsByCompany[cb.name] = totals;
      }
      console.log(`[sol-collect] SOV complete: ${sovMentions.length} mentions across ${companyBrandsList.length} companies`);
    } catch (err) {
      console.error(`[sol-collect] Phase 5 SOV error:`, err instanceof Error ? err.message : err);
      notifyError("sol-collect-phase5", err, { reportId, profileId });
    }

    // ----------------------------------------------------------
    // Phase 5b: Influencers — search by market themes
    // ----------------------------------------------------------
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
    }
    interface InfluencerMentionRow {
      date: string;
      text: string;
      brand?: string;
      brand_owner?: "main" | "competitor";
      sentiment?: "positivo" | "neutro" | "negativo";
    }
    const influencers: InfluencerCard[] = [];
    const influencerMentionsMap: Record<string, InfluencerMentionRow[]> = {};

    try {
      const themesRaw = String(optionsData.market_context ?? "").trim();
      const themes = themesRaw
        ? themesRaw.split(",").map((t) => t.trim()).filter((t) => t.length > 0)
        : [];

      if (themes.length > 0) {
        const themeQueries = themes.slice(0, 4).map((t) => `"${t}"`);
        console.log(`[sol-collect] Influencers searching themes: ${JSON.stringify(themeQueries)}`);

        let themePosts: Array<Record<string, unknown>> = [];
        try {
          themePosts = await searchLinkedInPosts({
            searchQueries: themeQueries,
            maxResults: 50,
            datePosted: "past-month",
            contentLanguage: "pt",
          });
          logApiCost({
            userId,
            source: "sol",
            searchId: reportId,
            provider: "apify",
            operation: "searchLinkedInPosts",
            estimatedCost: API_COSTS.apify.searchLinkedInPosts,
            metadata: { phase: "influencers", returned: themePosts.length },
          });
        } catch (err) {
          console.error(`[sol-collect] Influencers searchLinkedInPosts error:`, err instanceof Error ? err.message : err);
        }

        // Normalize and group by author
        interface AuthorBucket {
          name: string;
          role: string;
          company: string;
          linkedin_url: string;
          slug: string;
          followers: number;
          posts: Array<{
            text: string;
            posted_at: string;
            engagement: number;
            theme_hits: string[];
          }>;
        }
        const buckets = new Map<string, AuthorBucket>();
        const themeRegexes = themes.map((t) => ({
          theme: t,
          re: new RegExp(`\\b${t.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i"),
        }));

        for (const raw of themePosts) {
          const m = normalizeMention(raw);
          if (!m) continue;
          // Identify which themes this post hits
          const themeHits = themeRegexes.filter((tr) => tr.re.test(m.text)).map((tr) => tr.theme);
          if (themeHits.length === 0) continue;
          const key = m.author_linkedin_url || m.author_slug || m.author_name;
          if (!key) continue;
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = {
              name: m.author_name,
              role: m.author_role,
              company: m.author_company,
              linkedin_url: m.author_linkedin_url,
              slug: m.author_slug,
              followers: m.followers,
              posts: [],
            };
            buckets.set(key, bucket);
          }
          bucket.posts.push({
            text: m.text,
            posted_at: m.posted_at ?? "",
            engagement: m.reactions + m.comments,
            theme_hits: themeHits,
          });
        }

        // Filter authors with ≥2 posts
        const candidates = Array.from(buckets.values()).filter((b) => b.posts.length >= 2);
        console.log(`[sol-collect] Influencers: ${buckets.size} unique authors, ${candidates.length} with ≥2 posts`);

        // Build cross-brand index: for each candidate, scan their posts for brand mentions
        const allBrandRegexes: Array<{ brand: string; brand_owner: "main" | "competitor"; company_name: string; re: RegExp }> = [];
        for (const cb of companyBrandsList) {
          for (const b of cb.brands) {
            allBrandRegexes.push({
              brand: b,
              brand_owner: cb.brand_owner,
              company_name: cb.name,
              re: new RegExp(`\\b${b.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i"),
            });
          }
        }

        // Index existing SOV mentions by author for sentiment merge
        const sovByAuthor = new Map<string, SovMention[]>();
        for (const sm of sovMentions) {
          const k = sm.author_linkedin_url || sm.author_slug || sm.author_name;
          if (!k) continue;
          const arr = sovByAuthor.get(k) ?? [];
          arr.push(sm);
          sovByAuthor.set(k, arr);
        }

        for (const b of candidates) {
          const key = b.linkedin_url || b.slug || b.name;
          const themesCoveredSet = new Set<string>();
          for (const p of b.posts) for (const t of p.theme_hits) themesCoveredSet.add(t);

          // Brand mentions across this author's theme-posts
          const brandsHitMap = new Map<string, { brand: string; brand_owner: "main" | "competitor"; company_name: string }>();
          const mentionsRows: InfluencerMentionRow[] = [];
          for (const p of b.posts) {
            const hit = allBrandRegexes.find((br) => br.re.test(p.text));
            mentionsRows.push({
              date: p.posted_at ? p.posted_at.slice(0, 10) : "",
              text: p.text.slice(0, 600),
              ...(hit
                ? { brand: hit.brand, brand_owner: hit.brand_owner }
                : {}),
            });
            if (hit) {
              brandsHitMap.set(`${hit.brand_owner}|${hit.company_name}|${hit.brand}`, {
                brand: hit.brand,
                brand_owner: hit.brand_owner,
                company_name: hit.company_name,
              });
            }
          }

          // Merge with SOV mentions for this author (already classified for sentiment)
          const sovForAuthor = sovByAuthor.get(key) ?? [];
          for (const sm of sovForAuthor) {
            mentionsRows.push({
              date: sm.posted_at ? sm.posted_at.slice(0, 10) : "",
              text: sm.text.slice(0, 600),
              brand: sm.brand_term,
              brand_owner: sm.brand_owner,
              sentiment: sm.sentiment,
            });
            brandsHitMap.set(`${sm.brand_owner}|${sm.company_name}|${sm.brand_term}`, {
              brand: sm.brand_term,
              brand_owner: sm.brand_owner,
              company_name: sm.company_name,
            });
          }

          const brandsMentioned = Array.from(brandsHitMap.values());
          const ownBrandHits = brandsMentioned.filter((x) => x.brand_owner === "main").length;

          const totalEng = b.posts.reduce((s, p) => s + p.engagement, 0);
          const avgEngagement = b.posts.length > 0 ? Math.round(totalEng / b.posts.length) : 0;
          const frequency = computePostsPerMonth(
            b.posts.map((p) => ({ posted_at: p.posted_at })) as Array<Record<string, unknown>>,
          );

          // Predominant sentiment
          const sentCounts = { positivo: 0, neutro: 0, negativo: 0 };
          for (const sm of sovForAuthor) sentCounts[sm.sentiment] += 1;
          const totalSent = sentCounts.positivo + sentCounts.neutro + sentCounts.negativo;
          let sentiment: "positivo" | "neutro" | "negativo" = "neutro";
          if (totalSent > 0) {
            if (sentCounts.positivo >= sentCounts.neutro && sentCounts.positivo >= sentCounts.negativo) sentiment = "positivo";
            else if (sentCounts.negativo >= sentCounts.neutro && sentCounts.negativo >= sentCounts.positivo) sentiment = "negativo";
            else sentiment = "neutro";
          }

          // Potential
          let potential: "alto" | "médio" | "baixo" = "baixo";
          if (b.followers >= 30000 || ownBrandHits >= 2) potential = "alto";
          else if (ownBrandHits >= 1 || b.followers >= 15000) potential = "médio";
          else if (brandsMentioned.length === 0) potential = "baixo";

          influencers.push({
            name: b.name || "—",
            role: b.role,
            company: b.company,
            linkedin_url: b.linkedin_url,
            followers: b.followers,
            posts_about: b.posts.length,
            themes_covered: Array.from(themesCoveredSet),
            brands_mentioned: brandsMentioned,
            avg_engagement: avgEngagement,
            frequency,
            sentiment,
            potential,
          });
          influencerMentionsMap[key] = mentionsRows.slice(0, 10);
        }

        // Sort by potential then followers
        const potentialOrder: Record<string, number> = { alto: 0, "médio": 1, baixo: 2 };
        influencers.sort((a, b) => {
          const p = (potentialOrder[a.potential] ?? 3) - (potentialOrder[b.potential] ?? 3);
          if (p !== 0) return p;
          return b.followers - a.followers;
        });
      } else {
        console.log(`[sol-collect] Influencers skipped: market_context is empty`);
      }
    } catch (err) {
      console.error(`[sol-collect] Phase 5b Influencers error:`, err instanceof Error ? err.message : err);
      notifyError("sol-collect-phase5b", err, { reportId, profileId });
    }

    // Persist Phase 5 + 5b raw_data
    try {
      await service
        .from("sol_reports")
        .update({
          raw_data: {
            sov: { totals_by_company: totalsByCompany, mentions: sovMentions },
            influencers,
            influencer_mentions: influencerMentionsMap,
          },
        })
        .eq("id", reportId);
      console.log(`[sol-collect] raw_data saved: ${sovMentions.length} SOV mentions, ${influencers.length} influencers`);
    } catch (err) {
      console.error(`[sol-collect] raw_data save error:`, err instanceof Error ? err.message : err);
    }

    // ----------------------------------------------------------
    // Phase 6: AI synthesis (insights + recommendations + movements)
    // ----------------------------------------------------------
    try {
      const { data: scFinal } = await service.from("sol_reports").select("status, metrics").eq("id", reportId).single();
      if (scFinal?.status === "cancelled") return new Response("Cancelled");

      const metricsForBundle = (scFinal?.metrics ?? {}) as {
        companies?: Record<string, Record<string, unknown>>;
        collaborators?: Record<string, Array<Record<string, unknown>>>;
      };
      const compsObj = metricsForBundle.companies ?? {};

      // Build top_posts per company (top 3 by engagement)
      const { data: postsForBundle } = await service
        .from("sol_posts")
        .select("company_name, summary, text_content, rer_estimate, reactions, comments, author_name")
        .eq("report_id", reportId);
      const topPostsByCompany = new Map<string, Array<{ summary: string; rer: number | null; engagement: number; author: string }>>();
      if (postsForBundle) {
        const grouped = new Map<string, typeof postsForBundle>();
        for (const p of postsForBundle) {
          const arr = grouped.get(p.company_name) ?? [];
          arr.push(p);
          grouped.set(p.company_name, arr);
        }
        grouped.forEach((arr, comp) => {
          const sorted = [...arr].sort((a, b) => (b.reactions + b.comments) - (a.reactions + a.comments)).slice(0, 3);
          topPostsByCompany.set(
            comp,
            sorted.map((p) => ({
              summary: (p.summary ?? p.text_content ?? "").slice(0, 200),
              rer: p.rer_estimate,
              engagement: p.reactions + p.comments,
              author: p.author_name ?? "",
            })),
          );
        });
      }

      const bundleCompanies: SolBundleCompanies = {};
      for (const cb of companyBrandsList) {
        const cm = compsObj[cb.name] as Record<string, unknown> | undefined;
        if (!cm) continue;
        bundleCompanies[cb.name] = {
          brand_owner: cb.brand_owner,
          posts_count: Number(cm.posts_count ?? 0),
          engagement_total: Number(cm.engagement_total ?? 0),
          rer_avg: Number(cm.rer_avg ?? 0),
          sol_score: Number(cm.sol_score ?? 0),
          decisores_estimated: Number(cm.decisores_estimated ?? 0),
          top_themes: Array.isArray(cm.top_themes) ? (cm.top_themes as string[]) : [],
          content_composition: (cm.content_composition ?? {}) as Record<string, number>,
          top_posts: topPostsByCompany.get(cb.name) ?? [],
        };
      }

      const sovTotalsForAi: Record<string, { brand_owner: "main" | "competitor"; positivo: number; neutro: number; negativo: number }> = {};
      for (const [name, t] of Object.entries(totalsByCompany)) sovTotalsForAi[name] = t;

      const topInfluencersForAi = influencers.slice(0, 5).map((i) => ({
        name: i.name,
        company: i.company,
        followers: i.followers,
        posts_about: i.posts_about,
        sentiment: i.sentiment,
        brands_mentioned: i.brands_mentioned.map((b) => ({ brand: b.brand, brand_owner: b.brand_owner })),
      }));

      const periodLabel = new Date(report.period_start + "T12:00:00Z").toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

      const aiOutput = await generateSolRecommendations({
        period: periodLabel,
        mainCompany: companyName,
        mainBrands,
        marketContext: String(optionsData.market_context ?? ""),
        companies: bundleCompanies,
        sov_totals: sovTotalsForAi,
        top_influencers: topInfluencersForAi,
      });
      logApiCost({
        userId,
        source: "sol",
        searchId: reportId,
        provider: "openrouter",
        operation: "generateSolRecommendations",
        estimatedCost: API_COSTS.openrouter.generateSolRecommendations,
        metadata: { reportId },
      });

      await service.from("sol_reports").update({ recommendations: aiOutput }).eq("id", reportId);
      console.log(`[sol-collect] recommendations saved: ${aiOutput.recommendations.length} recs, ${aiOutput.movements.length} movements`);
    } catch (err) {
      console.error(`[sol-collect] Phase 6 synthesis error:`, err instanceof Error ? err.message : err);
      notifyError("sol-collect-phase6", err, { reportId, profileId });
    }

    // Mark report as complete
    await service.from("sol_reports").update({ status: "complete" }).eq("id", reportId);
    console.log(`[sol-collect] Report ${reportId} complete`);

    return new Response("OK");
  } catch (err) {
    console.error("[sol-collect] Error:", err);
    notifyError("sol-collect", err, { reportId, profileId });
    await service.from("sol_reports").update({ status: "failed" }).eq("id", reportId);
    return new Response("Error", { status: 500 });
  }
}

type SolBundleCompanies = Record<
  string,
  {
    brand_owner: "main" | "competitor";
    posts_count: number;
    engagement_total: number;
    rer_avg: number;
    sol_score: number;
    decisores_estimated: number;
    top_themes: string[];
    content_composition: Record<string, number>;
    top_posts: Array<{ summary: string; rer: number | null; engagement: number; author: string }>;
  }
>;
