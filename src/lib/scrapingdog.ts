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

export async function searchGoogle(
  query: string
): Promise<{ results: GoogleSearchResult[] }> {
  const apiKey = process.env.SCRAPINGDOG_API_KEY;
  if (!apiKey) {
    console.error("[scrapingdog] SCRAPINGDOG_API_KEY is not set");
    return { results: [] };
  }

  const url = `https://api.scrapingdog.com/google/?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&results=5`;
  console.log(`[scrapingdog] Google SERP query="${query}"`);

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
      console.log(`[scrapingdog] 202 — async processing, will retry later`);
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
