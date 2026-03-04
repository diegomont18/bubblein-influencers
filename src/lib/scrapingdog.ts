export interface ScrapingdogResult {
  status: number;
  data: Record<string, unknown> | null;
  error?: string;
}

export async function fetchLinkedInProfile(
  slug: string
): Promise<ScrapingdogResult> {
  const apiKey = process.env.SCRAPINGDOG_API_KEY;
  if (!apiKey) {
    return { status: 500, data: null, error: "SCRAPINGDOG_API_KEY not set" };
  }

  const url = `https://api.scrapingdog.com/linkedin/?api_key=${encodeURIComponent(apiKey)}&type=profile&linkId=${encodeURIComponent(slug)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const status = res.status;

    if (status === 200) {
      const data = await res.json();
      return { status: 200, data };
    }

    if (status === 202) {
      return { status: 202, data: null };
    }

    const text = await res.text();
    return { status, data: null, error: text };
  } catch (err) {
    return {
      status: 500,
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
