import { createClient } from "@supabase/supabase-js";
import { fetchLinkedInCompany } from "./apify";
import { searchGoogle } from "./serper";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CachedCompany {
  slug: string;
  name: string;
  employeeCount: number;
  employeeCountRange: string;
  industry: string;
  logoUrl: string;
}

function getService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function mapCountToRange(count: number): string {
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  if (count <= 500) return "201-500";
  if (count <= 1000) return "501-1.000";
  if (count <= 5000) return "1.001-5.000";
  if (count <= 10000) return "5.001-10.000";
  return "10.001+";
}

/**
 * Resolve company sizes for a batch of company names.
 * Uses cache first, then SERP + company scraper for misses.
 * Returns a Map of companyName → employeeCountRange.
 */
export async function resolveCompanySizes(
  companyNames: string[],
  _userId?: string,
  _searchId?: string,
): Promise<Map<string, CachedCompany>> {
  const result = new Map<string, CachedCompany>();
  if (companyNames.length === 0) return result;

  const service = getService();
  const unique = Array.from(new Set(companyNames.filter(Boolean)));
  console.log(`[company-cache] Resolving sizes for ${unique.length} companies`);

  // Phase 1: check cache
  const slugified = unique.map((n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  const { data: cached } = await service
    .from("company_cache")
    .select("*")
    .in("slug", slugified);

  const now = Date.now();
  const cacheMap = new Map<string, Record<string, unknown>>();
  for (const row of (cached ?? []) as Array<Record<string, unknown>>) {
    const cachedAt = new Date(row.cached_at as string).getTime();
    if (now - cachedAt < CACHE_TTL_MS) {
      cacheMap.set(row.slug as string, row);
    }
  }

  // Match names to cache
  const toFetch: Array<{ name: string; slug: string }> = [];
  for (let i = 0; i < unique.length; i++) {
    const name = unique[i];
    const slug = slugified[i];
    const hit = cacheMap.get(slug);
    if (hit) {
      result.set(name, {
        slug,
        name: (hit.name as string) || name,
        employeeCount: (hit.employee_count as number) || 0,
        employeeCountRange: (hit.employee_count_range as string) || "",
        industry: (hit.industry as string) || "",
        logoUrl: (hit.logo_url as string) || "",
      });
      console.log(`[company-cache] ${name} → ${hit.employee_count_range} (cached)`);
    } else {
      toFetch.push({ name, slug });
    }
  }

  if (toFetch.length === 0) return result;

  // Phase 2: SERP to find LinkedIn slugs, then company scraper
  console.log(`[company-cache] Fetching ${toFetch.length} companies from LinkedIn`);

  for (let i = 0; i < toFetch.length; i += 5) {
    const batch = toFetch.slice(i, i + 5);
    await Promise.all(batch.map(async ({ name, slug }) => {
      try {
        // Try direct slug first (cheaper — skips SERP)
        let companyResult = await fetchLinkedInCompany(slug);

        // If direct slug fails, try SERP to find the real slug
        if (!companyResult.data || companyResult.status !== 200) {
          const serpResult = await searchGoogle(
            `site:linkedin.com/company "${name}"`,
            { results: 3 }
          );

          const realSlug = serpResult.results
            .map((r) => r.link.match(/\/company\/([^/?#]+)/)?.[1] ?? "")
            .find((s) => s && s.length > 2);

          if (realSlug && realSlug !== slug) {
            companyResult = await fetchLinkedInCompany(realSlug);
          }
        }

        if (companyResult.status === 200 && companyResult.data) {
          const ci = companyResult.data;
          const range = ci.employeeCount > 0
            ? mapCountToRange(ci.employeeCount)
            : "";

          const cached: CachedCompany = {
            slug,
            name: ci.name || name,
            employeeCount: ci.employeeCount,
            employeeCountRange: range,
            industry: ci.industry,
            logoUrl: ci.profilePicUrl,
          };

          result.set(name, cached);
          console.log(`[company-cache] ${name} → ${range} (fetched, ${ci.employeeCount} employees)`);

          // Save to cache
          await service.from("company_cache").upsert({
            slug,
            name: ci.name || name,
            employee_count: ci.employeeCount,
            employee_count_range: range,
            industry: ci.industry,
            logo_url: ci.profilePicUrl,
            cached_at: new Date().toISOString(),
          });
        } else {
          console.log(`[company-cache] ${name} → not found`);
        }
      } catch (err) {
        console.error(`[company-cache] ${name} error:`, (err as Error).message);
      }
    }));
  }

  return result;
}
