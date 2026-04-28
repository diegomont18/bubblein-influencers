import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { analyzeProfileForLeads, analyzeCompanyForShareOfLinkedin, extractBrands } from "@/lib/ai";
import { notifyError } from "@/lib/error-notifier";

/**
 * POST /api/leads-generation/reprocess-ai
 * Re-runs only the AI analysis (themes, brands) for a profile that had ai_incomplete=true.
 * Does NOT re-scrape Apify data — uses existing data from the DB.
 */
export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { profileId } = await request.json() as { profileId: string };

  if (!profileId) {
    return NextResponse.json({ error: "profileId required" }, { status: 400 });
  }

  try {
    // Load existing options
    const { data: opts } = await service
      .from("lg_options")
      .select("*")
      .eq("profile_id", profileId)
      .single();

    if (!opts) {
      return NextResponse.json({ error: "Options not found" }, { status: 404 });
    }

    // Load profile
    const { data: profile } = await service
      .from("lg_profiles")
      .select("id, name, headline, linkedin_url")
      .eq("id", profileId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const aiResponse = (opts.ai_response ?? {}) as Record<string, unknown>;
    const isCompany = Array.isArray(opts.competitors) && opts.competitors.length > 0;

    if (isCompany) {
      // Company flow: re-run analyzeCompanyForShareOfLinkedin
      const companyInfo = (aiResponse.companyInfo ?? {}) as Record<string, unknown>;
      const country = String(aiResponse.country ?? "");
      const employees = Array.isArray(opts.employee_profiles)
        ? (opts.employee_profiles as Array<{ headline?: string }>).map((e) => e.headline ?? "")
        : [];

      console.log(`[reprocess-ai] Company flow for ${profileId}: re-running AI...`);

      const aiResult = await analyzeCompanyForShareOfLinkedin(
        String(companyInfo.name ?? profile.name ?? ""),
        String(companyInfo.description ?? ""),
        String(companyInfo.specialties ?? ""),
        String(companyInfo.industry ?? ""),
        employees,
        String(aiResponse.siteContent ?? ""),
        country,
      );

      // Re-extract brands if needed
      let brands = opts.proprietary_brands as string[] | null;
      if (aiResult?.brands && aiResult.brands.length > 0) {
        brands = aiResult.brands;
      }
      if (!brands || brands.length === 0) {
        const companyName = String(companyInfo.name ?? profile.name ?? "");
        brands = await extractBrands(companyName, String(aiResponse.siteContent ?? ""), String(companyInfo.description ?? ""));
        if (brands.length === 0) brands = [companyName];
      }

      const updatePayload = {
        market_context: aiResult?.themes ?? opts.market_context ?? "",
        proprietary_brands: brands,
        ai_incomplete: !aiResult || !(aiResult.themes),
        ai_response: { ...aiResponse, ...aiResult },
      };

      await service.from("lg_options").update(updatePayload).eq("profile_id", profileId);
      console.log(`[reprocess-ai] Company ${profileId}: themes="${(updatePayload.market_context ?? "").slice(0, 80)}", ai_incomplete=${updatePayload.ai_incomplete}`);

      return NextResponse.json({ ok: true, options: updatePayload });
    } else {
      // Person flow: re-run analyzeProfileForLeads
      const { data: posts } = await service
        .from("lg_posts")
        .select("text_content")
        .eq("profile_id", profileId)
        .limit(10);

      const postTexts = (posts ?? []).map((p) => p.text_content).filter(Boolean) as string[];

      console.log(`[reprocess-ai] Person flow for ${profileId}: re-running AI with ${postTexts.length} posts...`);

      const aiResult = await analyzeProfileForLeads(
        profile.name ?? "",
        profile.headline ?? "",
        postTexts,
      );

      const updatePayload = {
        market_context: aiResult?.market_context ?? "",
        job_titles: aiResult?.job_titles ?? [],
        departments: aiResult?.departments ?? [],
        company_sizes: aiResult?.company_sizes ?? ["51-200"],
        ai_response: aiResult,
        ai_incomplete: !aiResult,
      };

      await service.from("lg_options").update(updatePayload).eq("profile_id", profileId);
      console.log(`[reprocess-ai] Person ${profileId}: market_context="${(updatePayload.market_context ?? "").slice(0, 80)}", ai_incomplete=${updatePayload.ai_incomplete}`);

      return NextResponse.json({ ok: true, options: updatePayload });
    }
  } catch (err) {
    console.error("[reprocess-ai] Error:", err);
    notifyError("reprocess-ai", err, { profileId });
    return NextResponse.json({ error: "Failed to reprocess AI" }, { status: 500 });
  }
}
