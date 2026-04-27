import { createClient } from "@supabase/supabase-js";
import { fetchProfilePosts, fetchPostEngagers } from "@/lib/apify";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { notifyError } from "@/lib/error-notifier";
import { extractPostDate } from "@/lib/find-employees";
import { classifyPost } from "@/lib/ai";

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
      .select("competitors, employee_profiles, ai_response, market_context")
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
