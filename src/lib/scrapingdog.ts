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

  // Extract activity ID from URL
  const activityMatch = cleanUrl.match(/activity[_-](\d+)/);
  if (!activityMatch) {
    console.error(`[scrapingdog] Could not extract activity ID from: ${cleanUrl}`);
    return { status: 400, data: null, error: "Could not extract activity ID" };
  }
  const activityId = activityMatch[1];
  console.log(`[scrapingdog] Extracted activity ID: ${activityId} from ${cleanUrl}`);

  const url = `https://api.scrapingdog.com/profile/post?api_key=${encodeURIComponent(apiKey)}&id=${activityId}`;
  const maskedUrl = url.replace(/api_key=[^&]+/, "api_key=***");
  console.log(`[scrapingdog] Fetching post url=${maskedUrl}`);

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
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
        return { status: 200, data };
      }

      const text = await res.text();
      console.error(`[scrapingdog] Post error status=${status} body=${text.slice(0, 500)}`);

      // Retry on 429 or 400
      if ((status === 429 || status === 400) && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 1500;
        console.log(`[scrapingdog] Retrying post in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return { status, data: null, error: text };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[scrapingdog] Post fetch exception: ${message}`);
      if (attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 1500;
        console.log(`[scrapingdog] Retrying post after exception in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
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

  try {
    const res = await fetch(url, { cache: "no-store" });
    const status = res.status;
    console.log(`[scrapingdog] Response status=${status} for slug="${slug}"`);

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
      for (let attempt = 1; attempt <= 2; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log(`[scrapingdog] Retrying 202 for slug="${slug}" attempt=${attempt}`);
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
    return { status, data: null, error: text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[scrapingdog] Fetch exception: ${message}`);
    return {
      status: 500,
      data: null,
      error: message,
    };
  }
}
