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
