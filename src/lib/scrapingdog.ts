export interface ScrapingdogResult {
  status: number;
  data: Record<string, unknown> | null;
  error?: string;
}

export interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface GoogleSearchOptions {
  language?: string;
  country?: string;
  domain?: string;
  lr?: string;
  page?: number;
  results?: number;
  tbs?: string;
}

/**
 * Build Google's `tbs` date range parameter from YYYY-MM-DD strings.
 * Output: `cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY`
 */
export function buildDateRangeTbs(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split("-");
  const [ey, em, ed] = endDate.split("-");
  return `cdr:1,cd_min:${sm}/${sd}/${sy},cd_max:${em}/${ed}/${ey}`;
}

/**
 * Extract LinkedIn activity ID from a post URL.
 * Returns null if no activity ID found.
 */
export function extractActivityId(url: string): string | null {
  // Match activity_XXXXX or activity-XXXXX (permalink format)
  const actMatch = url.match(/activity[_-](\d+)/);
  if (actMatch) return actMatch[1];
  // Match urn:li:share:XXXXX or urn:li:activity:XXXXX (share link format)
  const urnMatch = url.match(/urn:li:(?:share|activity):(\d+)/);
  return urnMatch ? urnMatch[1] : null;
}

export function extractAuthorSlugFromPostUrl(url: string): string | null {
  // Extract from permalink: linkedin.com/posts/username_title-activity-...
  const postsMatch = url.match(/linkedin\.com\/posts\/([^_/?#]+)/);
  return postsMatch ? postsMatch[1] : null;
}

export async function searchGoogle(
  query: string,
  options?: GoogleSearchOptions
): Promise<{ results: GoogleSearchResult[] }> {
  const apiKey = process.env.SCRAPINGDOG_API_KEY;
  if (!apiKey) {
    console.error("[scrapingdog] SCRAPINGDOG_API_KEY is not set");
    return { results: [] };
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    query,
    results: String(options?.results ?? 10),
  });
  if (options?.language) params.set("language", options.language);
  if (options?.country) params.set("country", options.country);
  if (options?.domain) params.set("domain", options.domain);
  if (options?.lr) params.set("lr", options.lr);
  if (options?.page !== undefined) params.set("page", String(options.page));
  if (options?.tbs) params.set("tbs", options.tbs);

  const url = `https://api.scrapingdog.com/google/?${params.toString()}`;
  console.log(`[scrapingdog] Google SERP query="${query}" page=${options?.page ?? 0}`);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[scrapingdog] Google SERP error status=${res.status}`);
      return { results: [] };
    }
    const data = await res.json();
    return { results: data.organic_results ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[scrapingdog] Google SERP exception: ${message}`);
    return { results: [] };
  }
}

export async function fetchLinkedInPost(
  postUrl: string
): Promise<ScrapingdogResult> {
  const apiKey = process.env.SCRAPINGDOG_API_KEY;
  if (!apiKey) {
    console.error("[scrapingdog] SCRAPINGDOG_API_KEY is not set");
    return { status: 500, data: null, error: "SCRAPINGDOG_API_KEY not set" };
  }

  let cleanUrl: string;
  try { cleanUrl = decodeURIComponent(postUrl); } catch { cleanUrl = postUrl; }

  // Normalize locale domains (e.g. pt.linkedin.com → www.linkedin.com)
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.hostname.endsWith("linkedin.com") && parsed.hostname !== "www.linkedin.com") {
      parsed.hostname = "www.linkedin.com";
      cleanUrl = parsed.toString();
    }
  } catch { /* leave cleanUrl as-is */ }

  // Extract activity ID from URL (supports both permalink and share link formats)
  const activityId = extractActivityId(cleanUrl);
  if (!activityId) {
    console.error(`[scrapingdog] Could not extract activity ID from: ${cleanUrl}`);
    return { status: 400, data: null, error: "Could not extract activity ID" };
  }
  console.log(`[scrapingdog] Extracted activity ID: ${activityId} from ${cleanUrl}`);

  // Try the /profile/post endpoint first (works with activity IDs)
  const postApiUrl = `https://api.scrapingdog.com/profile/post?api_key=${encodeURIComponent(apiKey)}&id=${activityId}`;
  const maskedUrl = postApiUrl.replace(/api_key=[^&]+/, "api_key=***");
  console.log(`[scrapingdog] Fetching post url=${maskedUrl}`);

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(postApiUrl, { cache: "no-store" });
      const status = res.status;
      console.log(`[scrapingdog] Post response status=${status} attempt=${attempt + 1}`);

      if (status === 200) {
        let data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          data = data[0];
        }
        // /profile/post wraps response in "post_results"
        if (data && typeof data === "object" && "post_results" in data) {
          console.log(`[scrapingdog] Unwrapping post_results, inner keys: ${JSON.stringify(Object.keys(data.post_results))}`);
          data = data.post_results;
        }
        // Check if response has MEANINGFUL data (not just echoed ID)
        const d = data as Record<string, unknown>;
        const authorObj = (d.author && typeof d.author === "object" ? d.author : {}) as Record<string, unknown>;
        const hasRealData = (
          (authorObj.public_identifier && authorObj.public_identifier !== null) ||
          (d.activity_url && String(d.activity_url) !== "") ||
          (d.text && String(d.text) !== "") ||
          (Number(d.reactions_count) > 0)
        );
        if (hasRealData) {
          return { status: 200, data };
        }
        console.log(`[scrapingdog] /profile/post returned empty shell for ID ${activityId} (share URN ≠ activity ID), trying general scraper...`);
        break; // Fall through to general endpoint
      }

      const text = await res.text();
      console.error(`[scrapingdog] Post error status=${status} body=${text.slice(0, 500)}`);

      if ((status === 429 || status === 400) && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 1500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break; // Fall through to general endpoint
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[scrapingdog] Post fetch exception: ${message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
        continue;
      }
      break; // Fall through to general endpoint
    }
  }

  // Fallback: use ScrapingDog's general web scraper to load the LinkedIn page
  // This follows redirects and returns the page content
  // LinkedIn redirects urn:li:share URLs to /posts/username_title-activity-XXXXX
  const scrapeUrl = `https://api.scrapingdog.com/scrape?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(cleanUrl)}&dynamic=true`;
  console.log(`[scrapingdog] Trying general scraper for: ${cleanUrl}`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(scrapeUrl, { cache: "no-store" });
      const status = res.status;
      console.log(`[scrapingdog] General scraper response status=${status} attempt=${attempt + 1}`);

      if (status === 200) {
        const html = await res.text();
        console.log(`[scrapingdog] General scraper response length: ${html.length} chars`);

        // Extract author slug and activity ID from the page HTML
        // LinkedIn pages contain og:url meta tag or canonical URL with the permalink format
        const ogUrlMatch = html.match(/property="og:url"\s+content="([^"]+)"/);
        const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
        const redirectUrl = ogUrlMatch?.[1] ?? canonicalMatch?.[1] ?? "";
        console.log(`[scrapingdog] Extracted redirect/canonical URL: ${redirectUrl}`);

        // Also try to find the author from data-urn or other patterns
        const authorSlugMatch = redirectUrl.match(/linkedin\.com\/posts\/([^_/?#]+)/)
          ?? html.match(/linkedin\.com\/in\/([^"/?#]+)/);
        const realActivityMatch = redirectUrl.match(/activity[_-](\d+)/)
          ?? html.match(/urn:li:activity:(\d+)/);

        const extractedAuthor = authorSlugMatch?.[1] ?? null;
        const realActivityId = realActivityMatch?.[1] ?? null;

        console.log(`[scrapingdog] From page: author="${extractedAuthor}", activityId="${realActivityId}"`);

        // Return extracted data as a structured result
        return {
          status: 200,
          data: {
            activity_id: realActivityId ?? activityId,
            text: "",
            reactions_count: 0,
            comment_count: 0,
            activity_url: redirectUrl,
            share_url: cleanUrl,
            author: {
              name: null,
              public_identifier: extractedAuthor,
              headline: null,
              follower_count: null,
              image: null,
              url: extractedAuthor ? `https://www.linkedin.com/in/${extractedAuthor}/` : null,
            },
            comments: [],
            _source: "general_scraper",
          },
        };
      }

      const text = await res.text();
      console.error(`[scrapingdog] General scraper error status=${status} body=${text.slice(0, 300)}`);

      if ((status === 429 || status === 400) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
        continue;
      }
      return { status, data: null, error: text };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[scrapingdog] General scraper exception: ${message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
        continue;
      }
      return { status: 500, data: null, error: message };
    }
  }
  return { status: 500, data: null, error: "Max retries exceeded" };
}

export async function fetchLinkedInProfile(
  slug: string
): Promise<ScrapingdogResult> {
  const apiKey = process.env.SCRAPINGDOG_API_KEY;
  if (!apiKey) {
    console.error("[scrapingdog] SCRAPINGDOG_API_KEY is not set");
    return { status: 500, data: null, error: "SCRAPINGDOG_API_KEY not set" };
  }

  const url = `https://api.scrapingdog.com/linkedin/?api_key=${encodeURIComponent(apiKey)}&type=profile&linkId=${encodeURIComponent(slug)}&premium=true`;
  const maskedUrl = url.replace(/api_key=[^&]+/, "api_key=***");
  console.log(`[scrapingdog] Fetching profile for slug="${slug}" url=${maskedUrl}`);

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const status = res.status;
      console.log(`[scrapingdog] Response status=${status} for slug="${slug}" attempt=${attempt + 1}`);

      if (status === 200) {
        let data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          data = data[0];
        }
        return { status: 200, data };
      }

      if (status === 202) {
        console.log(`[scrapingdog] 202 — async processing, retrying...`);
        // Retry up to 2 times with 3s delay for async processing
        for (let retryAttempt = 1; retryAttempt <= 2; retryAttempt++) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          console.log(`[scrapingdog] Retrying 202 for slug="${slug}" attempt=${retryAttempt}`);
          const retryRes = await fetch(url, { cache: "no-store" });
          const retryStatus = retryRes.status;
          console.log(`[scrapingdog] Retry status=${retryStatus} for slug="${slug}"`);
          if (retryStatus === 200) {
            let retryData = await retryRes.json();
            if (Array.isArray(retryData) && retryData.length > 0) {
              retryData = retryData[0];
            }
            return { status: 200, data: retryData };
          }
          if (retryStatus !== 202) {
            const retryText = await retryRes.text();
            console.error(`[scrapingdog] Retry error status=${retryStatus} body=${retryText.slice(0, 500)}`);
            return { status: retryStatus, data: null, error: retryText };
          }
        }
        console.log(`[scrapingdog] 202 retries exhausted for slug="${slug}"`);
        return { status: 202, data: null };
      }

      const text = await res.text();
      console.error(`[scrapingdog] Error status=${status} body=${text.slice(0, 500)}`);

      // Retry on 429 or 400
      if ((status === 429 || status === 400) && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 2000;
        console.log(`[scrapingdog] Retrying profile in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return { status, data: null, error: text };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[scrapingdog] Fetch exception: ${message}`);
      if (attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 2000;
        console.log(`[scrapingdog] Retrying profile after exception in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { status: 500, data: null, error: message };
    }
  }
  return { status: 500, data: null, error: "Max retries exceeded" };
}
