import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { logApiCost, API_COSTS, CostCtx } from "./api-costs";
import { searchGoogleApify } from "./apify";
import type { ApifyGoogleSearchResult, ApifyGoogleSearchOptions } from "./apify";

export type { ApifyGoogleSearchResult, ApifyGoogleSearchOptions };

// ---------------------------------------------------------------------------
// SERP cache helpers (eternal cache in Supabase)
// ---------------------------------------------------------------------------

function hashQuery(query: string, options?: ApifyGoogleSearchOptions): string {
  const key = JSON.stringify({ q: query, ...options });
  return createHash("sha256").update(key).digest("hex");
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getCachedSerp(
  query: string,
  options?: ApifyGoogleSearchOptions
): Promise<ApifyGoogleSearchResult[] | null> {
  try {
    const hash = hashQuery(query, options);
    const { data } = await getServiceClient()
      .from("serp_cache")
      .select("results")
      .eq("query_hash", hash)
      .single();

    if (data?.results) {
      return data.results as ApifyGoogleSearchResult[];
    }
  } catch {
    // Cache miss
  }
  return null;
}

async function setCachedSerp(
  query: string,
  options: ApifyGoogleSearchOptions | undefined,
  results: ApifyGoogleSearchResult[]
): Promise<void> {
  try {
    const hash = hashQuery(query, options);
    await getServiceClient()
      .from("serp_cache")
      .upsert({
        query_hash: hash,
        query,
        options: options ?? null,
        results,
        cached_at: new Date().toISOString(),
      });
  } catch (err) {
    console.error("[serper-cache] Failed to cache:", err);
  }
}

// ---------------------------------------------------------------------------
// Serper.dev Google Search
// ---------------------------------------------------------------------------

/**
 * Search Google via Serper.dev API. Same interface as searchGoogleApify()
 * for drop-in replacement. Falls back to Apify if SERPER_API_KEY is not set.
 * Uses eternal SERP cache in Supabase.
 */
export async function searchGoogle(
  query: string,
  options?: ApifyGoogleSearchOptions,
  costCtx?: CostCtx,
): Promise<{ results: ApifyGoogleSearchResult[] }> {
  // Check cache first (eternal — no TTL)
  const cached = await getCachedSerp(query, options);
  if (cached) {
    console.log(`[serper-cache] HIT query="${query.slice(0, 60)}" results=${cached.length}`);
    return { results: cached };
  }

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn("[serper] SERPER_API_KEY not set, falling back to Apify");
    const result = await searchGoogleApify(query, options);
    if (result.results.length > 0) {
      setCachedSerp(query, options, result.results);
    }
    return result;
  }

  const num = options?.results ?? 10;
  const page = options?.page ?? 0;

  console.log(`[serper] searchGoogle query="${query.slice(0, 80)}" page=${page} num=${num}`);

  const body: Record<string, unknown> = { q: query, num };
  if (options?.country) body.gl = options.country;
  if (options?.language) body.hl = options.language;
  if (options?.tbs) body.tbs = options.tbs;
  // Serper uses 1-based page numbers
  if (page > 0) body.page = page + 1;

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      const status = res.status;

      if (status === 200) {
        const data = await res.json();
        const organic = Array.isArray(data.organic) ? data.organic : [];

        const results: ApifyGoogleSearchResult[] = organic.map(
          (r: Record<string, unknown>) => ({
            title: String(r.title ?? ""),
            link: String(r.link ?? ""),
            snippet: String(r.snippet ?? ""),
          })
        );

        logApiCost({
          userId: costCtx?.userId,
          source: costCtx?.source ?? "casting",
          searchId: costCtx?.searchId,
          provider: "serper",
          operation: "searchGoogle",
          estimatedCost: API_COSTS.serper.searchGoogle,
          metadata: { query: query.slice(0, 200), page, resultsCount: results.length },
        });

        console.log(`[serper] Got ${results.length} result(s)`);

        // Cache the results (fire-and-forget)
        if (results.length > 0) {
          setCachedSerp(query, options, results);
        }

        return { results };
      }

      const text = await res.text();
      console.error(`[serper] Error status=${status} body=${text.slice(0, 400)}`);

      if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 3000;
        console.log(`[serper] Retrying in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return { results: [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[serper] Exception: ${message}`);
      if (attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 3000;
        console.log(`[serper] Retrying after exception in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { results: [] };
    }
  }
  return { results: [] };
}
