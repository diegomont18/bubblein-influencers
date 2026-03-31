export async function searchLinkedInProfiles(params: {
  title: string;
  location?: string;
  maxResults?: number;
}): Promise<Array<Record<string, unknown>>> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error("[apify] APIFY_API_TOKEN is not set");
    return [];
  }

  const url = `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-search/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const body: Record<string, unknown> = {
    title: params.title,
    rows: params.maxResults ?? 50,
  };
  if (params.location) {
    body.location = params.location;
  }

  console.log(`[apify] Searching profiles: title="${params.title}" location="${params.location ?? ""}" max=${params.maxResults ?? 50}`);

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });

      const status = res.status;
      console.log(`[apify] Profile search response status=${status} attempt=${attempt + 1}`);

      if (status === 200 || status === 201) {
        const data = await res.json();
        if (Array.isArray(data)) {
          console.log(`[apify] Profile search returned ${data.length} result(s)`);
          return data as Array<Record<string, unknown>>;
        }
        console.warn(`[apify] Unexpected response shape: ${typeof data}`);
        return [];
      }

      const text = await res.text();
      console.error(`[apify] Profile search error status=${status} body=${text.slice(0, 500)}`);

      if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 3000;
        console.log(`[apify] Retrying in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[apify] Profile search exception: ${message}`);
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

/**
 * Batch-fetch posts for multiple LinkedIn profiles in a single Apify call.
 * Returns a Map keyed by normalized slug → posts array.
 */
export async function fetchProfilePostsBatch(
  targetUrls: string[]
): Promise<Map<string, Array<Record<string, unknown>>>> {
  const result = new Map<string, Array<Record<string, unknown>>>();
  if (targetUrls.length === 0) return result;

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error("[apify] APIFY_API_TOKEN is not set");
    return result;
  }

  const url = `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-posts/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const body = {
    includeQuotePosts: true,
    includeReposts: false,
    maxComments: 0,
    maxPosts: 15,
    maxReactions: 0,
    scrapeComments: false,
    scrapeReactions: false,
    targetUrls,
  };

  console.log(`[apify] Batch fetching posts for ${targetUrls.length} profiles`);

  // Build slug lookup from input URLs
  const slugLookup = new Set<string>();
  for (const u of targetUrls) {
    const match = u.match(/linkedin\.com\/in\/([^/?#]+)/);
    if (match) {
      slugLookup.add(match[1].toLowerCase().replace(/\/$/, ""));
    }
  }

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });

      const status = res.status;
      console.log(`[apify] Batch posts response status=${status} attempt=${attempt + 1}`);

      if (status === 200 || status === 201) {
        const data = await res.json();
        if (!Array.isArray(data)) {
          console.warn(`[apify] Unexpected batch response shape: ${typeof data}`);
          return result;
        }

        console.log(`[apify] Batch got ${data.length} post(s) total`);

        // Group posts by author slug
        for (const post of data as Array<Record<string, unknown>>) {
          const authorUrl = String(post.authorUrl ?? post.profileUrl ?? post.authorProfileUrl ?? "");
          const authorMatch = authorUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
          if (!authorMatch) continue;
          const authorSlug = authorMatch[1].toLowerCase().replace(/\/$/, "");
          if (!slugLookup.has(authorSlug)) continue;

          if (!result.has(authorSlug)) result.set(authorSlug, []);
          result.get(authorSlug)!.push(post);
        }

        return result;
      }

      const text = await res.text();
      console.error(`[apify] Batch posts error status=${status} body=${text.slice(0, 500)}`);

      if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 3000;
        console.log(`[apify] Retrying batch in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[apify] Batch posts exception: ${message}`);
      if (attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 3000;
        console.log(`[apify] Retrying batch after exception in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return result;
    }
  }
  return result;
}

/**
 * Search LinkedIn posts by keyword using Apify's harvestapi actor.
 * Returns posts with engagement data, author info, and content.
 */
export async function searchLinkedInPosts(params: {
  searchQueries: string[];
  maxResults?: number;
  datePosted?: string; // "past-24h", "past-week", "past-month", "past-year"
  contentLanguage?: string; // "pt", "en", "es", "fr"
}): Promise<Array<Record<string, unknown>>> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error("[apify] APIFY_API_TOKEN is not set");
    return [];
  }

  const url = `https://api.apify.com/v2/acts/harvestapi~linkedin-post-search/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const body: Record<string, unknown> = {
    searchQueries: params.searchQueries,
    rows: params.maxResults ?? 100,
  };
  if (params.datePosted) {
    body.datePosted = params.datePosted;
  }
  if (params.contentLanguage) {
    body.contentLanguage = params.contentLanguage;
  }

  console.log(`[apify] Searching posts: queries=${JSON.stringify(params.searchQueries)} max=${params.maxResults ?? 100} datePosted=${params.datePosted ?? "any"} lang=${params.contentLanguage ?? "any"}`);

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });

      const status = res.status;
      console.log(`[apify] Post search response status=${status} attempt=${attempt + 1}`);

      if (status === 200 || status === 201) {
        const data = await res.json();
        if (Array.isArray(data)) {
          console.log(`[apify] Post search returned ${data.length} result(s)`);
          // Log first post's keys for field discovery
          if (data.length > 0) {
            console.log(`[apify] Post search sample keys: ${JSON.stringify(Object.keys(data[0]))}`);
            console.log(`[apify] Post search sample data: ${JSON.stringify(data[0]).slice(0, 1500)}`);
          }
          return data as Array<Record<string, unknown>>;
        }
        console.warn(`[apify] Unexpected response shape: ${typeof data}`);
        return [];
      }

      const text = await res.text();
      console.error(`[apify] Post search error status=${status} body=${text.slice(0, 500)}`);

      if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 3000;
        console.log(`[apify] Retrying in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[apify] Post search exception: ${message}`);
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

/**
 * Fetch engagers (likers + commenters) from a LinkedIn post URL.
 */
export async function fetchPostEngagers(
  postUrl: string,
  maxReactions = 100,
  maxComments = 100
): Promise<{ reactions: Array<Record<string, unknown>>; comments: Array<Record<string, unknown>> }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error("[apify] APIFY_API_TOKEN is not set");
    return { reactions: [], comments: [] };
  }

  const url = `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-posts/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const body = {
    includeQuotePosts: false,
    includeReposts: false,
    maxComments,
    maxPosts: 1,
    maxReactions,
    scrapeComments: true,
    scrapeReactions: true,
    targetUrls: [postUrl],
  };

  console.log(`[apify] Fetching post engagers for ${postUrl}`);

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(240_000),
      });

      if (res.status === 200 || res.status === 201) {
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return { reactions: [], comments: [] };
        const post = data[0] as Record<string, unknown>;
        const reactions = Array.isArray(post.reactions) ? post.reactions as Array<Record<string, unknown>> : [];
        const comments = Array.isArray(post.comments) ? post.comments as Array<Record<string, unknown>> : [];
        console.log(`[apify] Post engagers: ${reactions.length} reactions, ${comments.length} comments`);
        return { reactions, comments };
      }

      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
        continue;
      }
      return { reactions: [], comments: [] };
    } catch (err) {
      console.error(`[apify] Post engagers exception: ${err instanceof Error ? err.message : err}`);
      if (attempt < MAX_RETRIES) { await new Promise((r) => setTimeout(r, (attempt + 1) * 3000)); continue; }
      return { reactions: [], comments: [] };
    }
  }
  return { reactions: [], comments: [] };
}
