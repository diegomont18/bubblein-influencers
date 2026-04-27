import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchLinkedInCompany, fetchProfilePosts, fetchLinkedInProfileApify } from "@/lib/apify";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { notifyError } from "@/lib/error-notifier";
import { findActiveEmployees, computePostsPerMonth, EmpCandidate } from "@/lib/find-employees";
import { extractBrands } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface EmployeeData {
  name: string;
  slug: string;
  headline: string;
  linkedinUrl: string;
  profilePicUrl: string;
  postsPerMonth?: number;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { profileId, competitorIndex, slug } = await request.json();
    if (!profileId || competitorIndex === undefined || !slug) {
      return NextResponse.json({ error: "profileId, competitorIndex, slug required" }, { status: 400 });
    }

    const service = createServiceClient();

    // Verify ownership
    const { data: profile } = await service
      .from("lg_profiles")
      .select("id")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .single();
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Fetch current options
    const { data: optionsRow } = await service
      .from("lg_options")
      .select("competitors, ai_response")
      .eq("profile_id", profileId)
      .single();
    if (!optionsRow) return NextResponse.json({ error: "Options not found" }, { status: 404 });

    const competitors = (optionsRow.competitors ?? []) as Array<Record<string, unknown>>;
    if (competitorIndex < 0 || competitorIndex >= competitors.length) {
      return NextResponse.json({ error: "Invalid competitor index" }, { status: 400 });
    }

    const currentComp = competitors[competitorIndex];
    const companyAlreadyProcessed = !!(currentComp.logoUrl || currentComp.postsPerMonth != null);
    const companyUrl = `https://www.linkedin.com/company/${slug}/`;

    let realName = String(currentComp.name ?? slug.replace(/-/g, " "));
    let logoUrl = String(currentComp.logoUrl ?? "");
    let postsPerMonth = currentComp.postsPerMonth as number | undefined;
    let employeeCount = Number(currentComp.employeeCount ?? 0);

    // 1. Fetch company info only if not already processed
    if (!companyAlreadyProcessed) {
      console.log(`[process-competitor] Fetching company info for ${slug}`);
      const companyResult = await fetchLinkedInCompany(slug);

      logApiCost({
        userId: user.id,
        source: "sol",
        provider: "apify",
        operation: "fetchLinkedInCompany",
        estimatedCost: API_COSTS.apify.fetchLinkedInCompany,
        metadata: { slug },
      });

      const companyInfo = companyResult.data;
      realName = companyInfo?.name || slug.replace(/-/g, " ");
      logoUrl = companyInfo?.profilePicUrl || "";
      employeeCount = companyInfo?.employeeCount ?? 0;

      // Fetch posts to calculate postsPerMonth
      console.log(`[process-competitor] Fetching posts for ${slug}`);
      const posts = await fetchProfilePosts(companyUrl, 5);

      logApiCost({
        userId: user.id,
        source: "sol",
        provider: "apify",
        operation: "fetchProfilePosts",
        estimatedCost: API_COSTS.apify.fetchProfilePosts,
        metadata: { slug, postsReturned: posts.length },
      });

      postsPerMonth = computePostsPerMonth(posts);

    }

    // 2. Update competitor in options
    const oldName = String(currentComp.name ?? "");
    const updatedCompetitor = {
      name: realName,
      logoUrl,
      url: companyUrl,
      selected: true,
      postsPerMonth,
      employeeCount,
    };

    competitors[competitorIndex] = updatedCompetitor;

    // 3. Search for executives or enrich manually-added employees
    const aiResponse = (optionsRow.ai_response ?? {}) as Record<string, unknown>;

    // Extract brands if not already cached (brand extraction uses data from company fetch above)
    const compBrandsMap = (aiResponse.competitor_brands ?? {}) as Record<string, string[]>;
    if (!compBrandsMap[realName] && !compBrandsMap[oldName]) {
      // We need the websiteUrl — it was fetched during company info step above
      // Re-read it from the stored competitor data or use a simple heuristic
      console.log(`[process-competitor] Extracting brands for ${realName}`);
      const compBrands = await extractBrands(realName, "", "");
      if (compBrands.length > 0) {
        compBrandsMap[realName] = compBrands;
        aiResponse.competitor_brands = compBrandsMap;
      }
    }
    const competitorEmployees = (aiResponse.competitor_employees ?? {}) as Record<string, unknown>;
    const country = (aiResponse.country as string) || undefined;

    const existingEmps = (competitorEmployees[oldName] ?? competitorEmployees[realName] ?? []) as EmployeeData[];

    const existingInactive = (competitorEmployees[`__inactive_${oldName}`] ?? competitorEmployees[`__inactive_${realName}`] ?? null) as EmployeeData[] | null;
    const needsEmployeeSearch = existingEmps.length === 0 || existingInactive === null;

    let finalEmps: EmployeeData[];
    let inactiveEmpsFound: EmployeeData[] = [];

    if (needsEmployeeSearch) {
      // Search for executives via SERP + profile validation
      console.log(`[process-competitor] Searching executives for ${realName} (slug: ${slug})`);
      const { active: found, inactive: inactiveFound } = await findActiveEmployees(slug, realName, user.id, profileId, 12, true, country);
      const toEmpData = (e: EmpCandidate): EmployeeData => ({
        name: e.name, slug: e.slug, headline: e.headline,
        linkedinUrl: e.linkedinUrl, profilePicUrl: e.profilePicUrl, postsPerMonth: e.postsPerMonth,
      });
      // Merge: keep manually-added employees that aren't in found results
      const foundSlugs = new Set(found.map((e) => e.slug));
      const manualEmps = existingEmps.filter((e) => !foundSlugs.has(e.slug));
      finalEmps = [...found.map(toEmpData), ...manualEmps];
      inactiveEmpsFound = inactiveFound.map(toEmpData);
      console.log(`[process-competitor] Found ${found.length} active, ${inactiveFound.length} inactive executives for ${realName}`);
    } else {
      // Employees exist and inactive already cached — enrich pending ones only
      finalEmps = [];
      for (const emp of existingEmps) {
        const isPendingEmp = !emp.headline && !emp.profilePicUrl;
        if (!isPendingEmp) {
          finalEmps.push(emp);
          continue;
        }

        console.log(`[process-competitor] Enriching employee ${emp.slug}`);
        try {
          const result = await fetchLinkedInProfileApify(emp.slug);

          logApiCost({
            userId: user.id,
            source: "sol",
            provider: "apify",
            operation: "fetchLinkedInProfileApify",
            estimatedCost: API_COSTS.apify.fetchLinkedInProfileApify,
            metadata: { slug: emp.slug },
          });

          if (result.status === 200 && result.data) {
            const d = result.data;
            const empPosts = await fetchProfilePosts(`https://www.linkedin.com/in/${emp.slug}/`, 5);

            logApiCost({
              userId: user.id,
              source: "sol",
              provider: "apify",
              operation: "fetchProfilePosts",
              estimatedCost: API_COSTS.apify.fetchProfilePosts,
              metadata: { slug: emp.slug, postsReturned: empPosts.length },
            });

            finalEmps.push({
              name: String(d.name ?? d.fullName ?? emp.name),
              slug: emp.slug,
              headline: String(d.headline ?? ""),
              linkedinUrl: emp.linkedinUrl,
              profilePicUrl: String(d.profilePicture ?? d.profile_pic_url ?? ""),
              postsPerMonth: computePostsPerMonth(empPosts),
            });
          } else {
            finalEmps.push(emp);
          }
        } catch (err) {
          console.error(`[process-competitor] Failed to enrich ${emp.slug}:`, err);
          finalEmps.push(emp);
        }
      }
    }

    // Remove old key if name changed, set employees
    if (oldName && oldName !== realName) {
      delete competitorEmployees[oldName];
    }
    competitorEmployees[realName] = finalEmps;

    // Save inactive executives for UI display
    const inactiveCompEmps = (aiResponse.inactive_competitor_employees ?? {}) as Record<string, unknown>;
    if (oldName && oldName !== realName) {
      delete inactiveCompEmps[oldName];
    }
    inactiveCompEmps[realName] = inactiveEmpsFound;

    const updatedAiResponse = { ...aiResponse, competitor_employees: competitorEmployees, inactive_competitor_employees: inactiveCompEmps };

    // 4. Save to DB
    const { error: updateError } = await service
      .from("lg_options")
      .update({
        competitors,
        ai_response: updatedAiResponse,
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", profileId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const enrichedCount = finalEmps.filter((e) => !!e.headline).length;
    console.log(`[process-competitor] Done: ${realName} — ${postsPerMonth} posts/month, ${finalEmps.length} employees (${enrichedCount} enriched)`);

    return NextResponse.json({
      competitor: updatedCompetitor,
      employees: finalEmps,
      inactiveEmployees: inactiveEmpsFound,
      postsPerMonth,
    });
  } catch (err) {
    console.error("[process-competitor] Error:", err);
    notifyError("process-competitor", err, { userId: user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
