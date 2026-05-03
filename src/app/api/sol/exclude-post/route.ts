import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";

/**
 * POST /api/sol/exclude-post
 * Excludes or restores a post and recalculates metrics.
 * Body: { reportId, postId: string, exclude: boolean }
 */
export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId, postId, exclude } = await request.json() as {
    reportId: string;
    postId: string;
    exclude: boolean;
  };

  if (!reportId || !postId) {
    return NextResponse.json({ error: "reportId and postId required" }, { status: 400 });
  }

  const service = createServiceClient();

  try {
    const { data: report } = await service
      .from("sol_reports")
      .select("id, raw_data")
      .eq("id", reportId)
      .single();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Update excluded_posts list
    const rawData = (report.raw_data ?? {}) as Record<string, unknown>;
    const currentExcluded = (rawData.excluded_posts ?? []) as string[];

    let newExcluded: string[];
    if (exclude) {
      newExcluded = currentExcluded.includes(postId) ? currentExcluded : [...currentExcluded, postId];
    } else {
      newExcluded = currentExcluded.filter((id) => id !== postId);
    }

    // Fetch all posts for recalculation
    const { data: allPosts } = await service
      .from("sol_posts")
      .select("*")
      .eq("report_id", reportId);

    if (!allPosts) {
      return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
    }

    const excludedSet = new Set(newExcluded);
    const activePosts = allPosts.filter((p) => !excludedSet.has(p.id));

    // Recalculate metrics
    type PostRow = (typeof allPosts)[number];
    const companyMap = new Map<string, PostRow[]>();
    for (const p of activePosts) {
      const arr = companyMap.get(p.company_name) ?? [];
      arr.push(p);
      companyMap.set(p.company_name, arr);
    }

    const companies: Record<string, unknown> = {};
    const collaborators: Record<string, unknown[]> = {};
    let maxRawSol = 0;

    const compEntries: Array<[string, PostRow[]]> = [];
    companyMap.forEach((v, k) => compEntries.push([k, v]));

    for (const [compName, posts] of compEntries) {
      const postsCount = posts.length;
      const engagementTotal = posts.reduce((s: number, p: PostRow) => s + (p.reactions ?? 0) + (p.comments ?? 0), 0);

      const composition: Record<string, number> = { produto: 0, institucional: 0, vagas: 0, outros: 0 };
      for (const p of posts) composition[p.content_type ?? "outros"] = (composition[p.content_type ?? "outros"] ?? 0) + 1;

      const themeCount: Record<string, number> = {};
      for (const p of posts) {
        if (p.theme) themeCount[p.theme] = (themeCount[p.theme] ?? 0) + 1;
      }
      const topThemes = Object.entries(themeCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

      const rawSol = postsCount * engagementTotal;
      if (rawSol > maxRawSol) maxRawSol = rawSol;

      companies[compName] = {
        posts_count: postsCount,
        engagement_total: engagementTotal,
        top_themes: topThemes,
        content_composition: composition,
        raw_sol: rawSol,
      };

      // Collaborators
      const empPosts = posts.filter((p: PostRow) => p.source_type === "employee");
      const empMap = new Map<string, PostRow[]>();
      for (const p of empPosts) {
        const arr = empMap.get(p.profile_slug) ?? [];
        arr.push(p);
        empMap.set(p.profile_slug, arr);
      }

      collaborators[compName] = Array.from(empMap.entries()).map(([slug, eps]) => {
        const engagement = eps.reduce((s: number, p: PostRow) => s + (p.reactions ?? 0) + (p.comments ?? 0), 0);
        const catCount: Record<string, number> = {};
        for (const p of eps) if (p.content_type) catCount[p.content_type] = (catCount[p.content_type] ?? 0) + 1;
        const mainCategory = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "outros";
        return {
          name: eps[0]?.author_name ?? slug,
          slug,
          headline: eps[0]?.author_headline ?? "",
          posts: eps.length,
          engagement,
          main_category: mainCategory,
        };
      });
    }

    // Also include companies that had all posts excluded (0 metrics)
    const allCompanyNames = Array.from(new Set(allPosts.map((p: PostRow) => p.company_name)));
    for (const compName of allCompanyNames) {
      if (!companies[compName]) {
        companies[compName] = {
          posts_count: 0,
          engagement_total: 0,
          top_themes: [],
          content_composition: { produto: 0, institucional: 0, vagas: 0, outros: 0 },
          raw_sol: 0,
        };
        collaborators[compName] = [];
      }
    }

    // Normalize SOL scores to 0-10 scale
    for (const comp of Object.values(companies)) {
      const c = comp as Record<string, unknown>;
      c.sol_score = maxRawSol > 0 ? Math.round(((c.raw_sol as number) / maxRawSol) * 100) / 10 : 0;
    }

    const metrics = { companies, collaborators };

    await service.from("sol_reports").update({
      raw_data: { ...rawData, excluded_posts: newExcluded },
      metrics,
    }).eq("id", reportId);

    return NextResponse.json({ ok: true, excluded_posts: newExcluded });
  } catch (err) {
    console.error("[sol-exclude-post] Error:", err);
    notifyError("sol-exclude-post", err, { reportId, postId });
    return NextResponse.json({ error: "Failed to exclude post" }, { status: 500 });
  }
}
