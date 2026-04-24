import { logApiCost } from "./api-costs";

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";

interface ScrapeResult {
  title: string;
  description: string;
  content: string;
  url: string;
}

export async function scrapeWebsite(
  url: string,
  opts?: { userId?: string; searchId?: string }
): Promise<ScrapeResult | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn("[firecrawl] FIRECRAWL_API_KEY not set, skipping scrape");
    return null;
  }

  try {
    console.log(`[firecrawl] Scraping ${url}`);
    const res = await fetch(FIRECRAWL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!res.ok) {
      console.error(`[firecrawl] HTTP ${res.status} for ${url}`);
      return null;
    }

    const json = await res.json();
    const data = json.data;
    if (!data) {
      console.error(`[firecrawl] No data in response for ${url}`);
      return null;
    }

    // Truncate content to 3000 chars to save AI tokens
    const content = (data.markdown || data.content || "").slice(0, 3000);
    const title = data.metadata?.title || data.title || "";
    const description = data.metadata?.description || data.description || "";

    console.log(`[firecrawl] OK ${url}: title="${title.slice(0, 60)}", content=${content.length} chars`);

    logApiCost({
      userId: opts?.userId,
      source: "enrichment",
      searchId: opts?.searchId,
      provider: "apify", // using apify category for tracking
      operation: "firecrawlScrape",
      estimatedCost: 0.01,
      metadata: { url },
    });

    return { title, description, content, url };
  } catch (err) {
    console.error(`[firecrawl] Error scraping ${url}:`, (err as Error).message);
    return null;
  }
}
