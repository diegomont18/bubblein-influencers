import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { classifyPost, generateSolRecommendations, generateSolSuggestedPosts } from "@/lib/ai";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { notifyError } from "@/lib/error-notifier";
import {
  assertCanEdit,
  respondAccessError,
  ResourceAccessError,
} from "@/lib/resource-access";

/**
 * POST /api/sol/reprocess-ai
 * Re-runs AI classification on posts with theme="outros" and re-generates recommendations.
 * Does NOT re-collect posts — uses existing data from sol_posts.
 */
export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { reportId } = await request.json() as { reportId: string };

  if (!reportId) {
    return NextResponse.json({ error: "reportId required" }, { status: 400 });
  }

  let ownerId = user.id;
  try {
    // Load report
    const { data: report } = await service
      .from("sol_reports")
      .select("id, profile_id, status, metrics, raw_data, recommendations, period_start, period_end")
      .eq("id", reportId)
      .single();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    try {
      const access = await assertCanEdit(user.id, "lg_profile", report.profile_id);
      ownerId = access.ownerId;
    } catch (err) {
      if (err instanceof ResourceAccessError) return respondAccessError(err);
      throw err;
    }

    // Load options for market context
    const { data: opts } = await service
      .from("lg_options")
      .select("market_context, proprietary_brands")
      .eq("profile_id", report.profile_id)
      .single();

    const marketContext = opts?.market_context ?? "";
    const mainBrands = (opts?.proprietary_brands ?? []) as string[];

    // Re-classify posts that have theme="outros"
    const { data: outrosPosts } = await service
      .from("sol_posts")
      .select("id, text_content, theme")
      .eq("report_id", reportId)
      .eq("theme", "outros");

    let reclassified = 0;
    if (outrosPosts && outrosPosts.length > 0 && marketContext) {
      console.log(`[sol-reprocess-ai] Re-classifying ${outrosPosts.length} posts with theme="outros"...`);
      for (const post of outrosPosts) {
        if (!post.text_content) continue;
        const result = await classifyPost(post.text_content, marketContext);
        logApiCost({
          userId: ownerId,
          source: "sol",
          provider: "openrouter",
          operation: "classifyPost",
          estimatedCost: API_COSTS.openrouter.classifyPost,
          metadata: { postId: post.id, context: "reprocess-ai", actorUserId: user.id },
        });
        if (result.theme !== "outros") {
          await service.from("sol_posts").update({
            theme: result.theme,
            content_type: result.content_type,
            summary: result.summary,
          }).eq("id", post.id);
          reclassified++;
        }
      }
      console.log(`[sol-reprocess-ai] Re-classified ${reclassified}/${outrosPosts.length} posts`);
    }

    // Re-generate recommendations
    const metrics = report.metrics as Record<string, unknown> | null;
    const rawData = report.raw_data as Record<string, unknown> | null;

    if (metrics) {
      console.log(`[sol-reprocess-ai] Re-generating recommendations...`);

      // Load profile for company name
      const { data: profile } = await service
        .from("lg_profiles")
        .select("name")
        .eq("id", report.profile_id)
        .single();

      const companyName = profile?.name ?? "";
      const companies = (metrics.companies ?? {}) as Record<string, unknown>;
      const collabsRaw = ((metrics as Record<string, unknown>).collaborators ?? {}) as Record<string, Array<Record<string, unknown>>>;
      const rawSov = (rawData as Record<string, Record<string, unknown>> | null)?.sov ?? {};
      const sovTotals = (rawSov.totals_by_company ?? {}) as Record<string, unknown>;
      const topInfluencers = ((rawData as Record<string, unknown[]> | null)?.influencers ?? []) as Array<Record<string, unknown>>;

      const periodStart = new Date(report.period_start);
      const periodEnd = new Date(report.period_end);
      const periodLabel = `${periodStart.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })} – ${periodEnd.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}`;

      // Extract main company collaborators
      const mainCollabs = (collabsRaw[companyName] ?? []).map((c) => ({
        name: String(c.name ?? ""),
        slug: String(c.slug ?? ""),
        headline: String(c.headline ?? ""),
        posts: Number(c.posts ?? 0),
        engagement: Number(c.engagement ?? 0),
        main_category: String(c.main_category ?? "outros"),
      }));

      // Phase 6a: analyses
      const solBundle = {
        period: periodLabel,
        mainCompany: companyName,
        mainBrands,
        marketContext,
        companies: companies as Parameters<typeof generateSolRecommendations>[0]["companies"],
        sov_totals: sovTotals as Parameters<typeof generateSolRecommendations>[0]["sov_totals"],
        top_influencers: topInfluencers as Parameters<typeof generateSolRecommendations>[0]["top_influencers"],
        collaborators: mainCollabs,
      };

      const aiOutput = await generateSolRecommendations(solBundle);
      logApiCost({
        userId: ownerId,
        source: "sol",
        provider: "openrouter",
        operation: "generateSolRecommendations",
        estimatedCost: API_COSTS.openrouter.generateSolRecommendations,
        metadata: { reportId, context: "reprocess-ai", actorUserId: user.id },
      });
      console.log(`[sol-reprocess-ai] Phase 6a: ${aiOutput.recommendations.length} recs`);

      // Phase 6b: suggested posts (receives analyses)
      const suggestedPosts = await generateSolSuggestedPosts(solBundle, aiOutput);
      logApiCost({
        userId: ownerId,
        source: "sol",
        provider: "openrouter",
        operation: "generateSolSuggestedPosts",
        estimatedCost: API_COSTS.openrouter.generateSolSuggestedPosts,
        metadata: { reportId, context: "reprocess-ai", actorUserId: user.id },
      });
      console.log(`[sol-reprocess-ai] Phase 6b: ${suggestedPosts.length} suggested posts`);

      const fullAiOutput = { ...aiOutput, suggested_posts: suggestedPosts };
      const aiIncomplete = aiOutput.recommendations.length === 0 && aiOutput.insights.positives.length === 0;

      await service.from("sol_reports").update({
        recommendations: fullAiOutput,
        ai_incomplete: aiIncomplete,
      }).eq("id", reportId);

      console.log(`[sol-reprocess-ai] Saved: ${aiOutput.recommendations.length} recs, ${suggestedPosts.length} suggested posts, ai_incomplete=${aiIncomplete}`);

      return NextResponse.json({
        ok: true,
        reclassified,
        recommendations: aiOutput.recommendations.length,
        suggested_posts: suggestedPosts.length,
        ai_incomplete: aiIncomplete,
      });
    }

    return NextResponse.json({ ok: true, reclassified, recommendations: 0 });
  } catch (err) {
    console.error("[sol-reprocess-ai] Error:", err);
    notifyError("sol-reprocess-ai", err, { reportId });
    return NextResponse.json({ error: "Failed to reprocess AI" }, { status: 500 });
  }
}
