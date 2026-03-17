export async function fetchProfilePosts(
  targetUrl: string
): Promise<Array<Record<string, unknown>>> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error("[apify] APIFY_API_TOKEN is not set");
    return [];
  }

  const url = `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-posts/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const body = {
    includeQuotePosts: true,
    includeReposts: false,
    maxComments: 0,
    maxPosts: 3,
    maxReactions: 0,
    scrapeComments: false,
    scrapeReactions: false,
    targetUrls: [targetUrl],
  };

  console.log(`[apify] Fetching posts for ${targetUrl}`);

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      const status = res.status;
      console.log(`[apify] Response status=${status} attempt=${attempt + 1}`);

      if (status === 200 || status === 201) {
        const data = await res.json();
        if (Array.isArray(data)) {
          console.log(`[apify] Got ${data.length} post(s)`);
          return data as Array<Record<string, unknown>>;
        }
        console.warn(`[apify] Unexpected response shape: ${typeof data}`);
        return [];
      }

      const text = await res.text();
      console.error(`[apify] Error status=${status} body=${text.slice(0, 500)}`);

      if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 3000;
        console.log(`[apify] Retrying in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[apify] Exception: ${message}`);
      if (attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 3000;
        console.log(`[apify] Retrying after exception in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return [];
    }
  }
  return [];
}
