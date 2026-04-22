import { logApiCost, API_COSTS } from "./api-costs";

export interface ApifyLinkedInProfileResult {
  status: number;
  data: Record<string, unknown> | null;
  error?: string;
}

export interface ApifyGoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface ApifyGoogleSearchOptions {
  language?: string;
  country?: string;
  domain?: string;
  lr?: string;
  page?: number;
  results?: number;
  tbs?: string;
}

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
  targetUrl: string,
  maxPosts = 3
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
    maxPosts,
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
/**
 * Fetch engagers (reactions + comments) from a LinkedIn post.
 * Supports both URL formats:
 *   - Share link: https://www.linkedin.com/feed/update/urn:li:share:XXXXX
 *   - Permalink:  https://www.linkedin.com/posts/username_title-activity-XXXXX-xxxx
 *
 * Uses harvestapi~linkedin-profile-posts with the POST URL in targetUrls.
 * The actor returns a flat array of items with type "reaction" or "comment",
 * each containing an actor object with linkedinUrl.
 *
 * For share links (urn:li:share:), first resolves to permalink via
 * fetchLinkedInPostApify.
 */
export interface FetchEngagersCostCtx {
  userId?: string;
  source?: "casting" | "leads" | "enrichment";
  searchId?: string;
}

/**
 * Public entry point for fetching a post's reactions + comments.
 *
 * Default implementation: supreme_coder/linkedin-post (~86% cheaper than
 * harvestapi, returns public LinkedIn slugs instead of hashed ACoAA IDs
 * which also fixes downstream enrichment).
 *
 * Rollback: set env var USE_LEGACY_APIFY_ACTORS=1 to use the old harvestapi
 * path (higher cost, hashed slugs, but battle-tested).
 *
 * Both implementations return objects in the shape:
 *   { reactions: [{ actor: {id, name, linkedinUrl, position, pictureUrl} }],
 *     comments:  [{ actor: {...}, text?, time? }] }
 */
export async function fetchPostEngagers(
  postUrl: string,
  maxReactions = 100,
  maxComments = 100,
  costCtx?: FetchEngagersCostCtx
): Promise<{ reactions: Array<Record<string, unknown>>; comments: Array<Record<string, unknown>> }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error("[apify] APIFY_API_TOKEN is not set");
    return { reactions: [], comments: [] };
  }

  // Resolve non-permalink URLs first (free — uses plain fetch). Both
  // implementations accept a canonical /posts/... permalink.
  let resolvedPostUrl = postUrl.trim();
  const isNonPermalink =
    resolvedPostUrl.includes("urn:li:share:") ||
    resolvedPostUrl.includes("urn:li:activity:") ||
    resolvedPostUrl.includes("urn:li:ugcPost:");
  if (isNonPermalink) {
    console.log(`[apify] fetchPostEngagers: non-permalink URL detected, resolving...`);
    const postResult = await fetchLinkedInPostApify(resolvedPostUrl);
    if (postResult.status === 200 && postResult.data) {
      const postData = postResult.data as Record<string, unknown>;
      const activityUrl = String(postData.activity_url ?? "");
      if (activityUrl && activityUrl.includes("/posts/")) {
        resolvedPostUrl = activityUrl;
        console.log(`[apify] fetchPostEngagers: resolved to permalink: ${resolvedPostUrl.slice(0, 120)}`);
      }
    }
  }

  if (process.env.USE_LEGACY_APIFY_ACTORS === "1") {
    return fetchPostEngagersHarvestLegacy(resolvedPostUrl, maxReactions, maxComments, costCtx);
  }
  return fetchPostEngagersSupreme(resolvedPostUrl, costCtx);
}

/**
 * Build a canonical LinkedIn profile URL from a supreme_coder profile
 * object, preferring the public slug (bruno-david-123) over the hashed
 * ACoAA... ID which LinkedIn treats as opaque.
 */
function buildLinkedInUrlFromSupremeProfile(profile: Record<string, unknown>): string {
  const publicId = String(profile.publicId ?? "").trim();
  if (publicId) return `https://www.linkedin.com/in/${publicId}`;
  const profileId = String(profile.profileId ?? "").trim();
  if (profileId) return `https://www.linkedin.com/in/${profileId}`;
  return "";
}

/**
 * Normalize a supreme_coder reactor/commenter profile into the shape the
 * rest of our code already consumes from the old harvestapi path:
 *   { id, name, linkedinUrl, position, pictureUrl }
 */
function normalizeSupremeProfile(profile: Record<string, unknown>): Record<string, unknown> {
  const firstName = String(profile.firstName ?? "").trim();
  const lastName = String(profile.lastName ?? "").trim();
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    // Prefer publicId for dedup — it's stable across LinkedIn views.
    // Fall back to profileId (ACoAA...) when publicId is absent.
    id: String(profile.publicId ?? profile.profileId ?? profile.id ?? ""),
    name,
    linkedinUrl: buildLinkedInUrlFromSupremeProfile(profile),
    position: String(profile.occupation ?? ""),
    pictureUrl: String(profile.picture ?? ""),
  };
}

/**
 * Primary implementation: supreme_coder/linkedin-post. Returns the post
 * plus an inline array of up to ~10 reactions and all comments (varies by
 * post size). Charges per item (~$0.0012 each).
 *
 * Note: maxReactions/maxComments from the public signature are IGNORED —
 * this actor has a built-in cap we can't override. The cap is usually fine
 * because our Phase A2 dynamic caps already targeted 20-50 engagers, and
 * the 86% cost reduction per call compensates by letting us scan more
 * posts overall.
 */
async function fetchPostEngagersSupreme(
  resolvedPostUrl: string,
  costCtx?: FetchEngagersCostCtx
): Promise<{ reactions: Array<Record<string, unknown>>; comments: Array<Record<string, unknown>> }> {
  const token = process.env.APIFY_API_TOKEN!;
  console.log(`[apify] fetchPostEngagersSupreme: calling supreme_coder with urls=[${resolvedPostUrl.slice(0, 120)}]`);

  const url = `https://api.apify.com/v2/acts/supreme_coder~linkedin-post/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const body = { urls: [resolvedPostUrl] };

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });

      if (res.status === 200 || res.status === 201) {
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          console.log(`[apify] fetchPostEngagersSupreme: empty dataset`);
          return { reactions: [], comments: [] };
        }

        const post = (data[0] ?? {}) as Record<string, unknown>;
        const rawReactions = Array.isArray(post.reactions)
          ? (post.reactions as Array<Record<string, unknown>>)
          : [];
        const rawComments = Array.isArray(post.comments)
          ? (post.comments as Array<Record<string, unknown>>)
          : [];

        // Normalize to the internal shape the rest of the codebase expects.
        // Each item gets { actor: {...} } at the top level.
        const reactions = rawReactions
          .map((r) => {
            const profile = (r.profile && typeof r.profile === "object" ? r.profile : null) as Record<string, unknown> | null;
            if (!profile) return null;
            const actor = normalizeSupremeProfile(profile);
            if (!actor.name || String(actor.name).length < 2) return null;
            return { type: "reaction", actor };
          })
          .filter((x): x is { type: string; actor: Record<string, unknown> } => x !== null);

        const comments: Array<Record<string, unknown>> = [];
        for (const c of rawComments) {
          const author = (c.author && typeof c.author === "object" ? c.author : null) as Record<string, unknown> | null;
          if (!author) continue;
          const actor = normalizeSupremeProfile(author);
          if (!actor.name || String(actor.name).length < 2) continue;
          comments.push({
            type: "comment",
            actor,
            text: c.text ?? "",
            time: c.time ?? null,
          });
        }

        const numLikes = Number(post.numLikes ?? 0);
        const numComments = Number(post.numComments ?? 0);
        console.log(
          `[apify] fetchPostEngagersSupreme: ${reactions.length} reactions, ${comments.length} comments ` +
          `(post has ${numLikes} likes, ${numComments} comments total)`
        );
        if (reactions.length > 0) {
          const a = reactions[0].actor as Record<string, unknown>;
          console.log(`[apify] fetchPostEngagersSupreme sample: name="${a.name}" slug="${a.id}" position="${String(a.position).slice(0, 60)}"`);
        }

        // Dynamic cost: per-item pricing. +1 for the single "post" item
        // supreme_coder also counts as an event.
        const itemsCharged = 1 + reactions.length + comments.length;
        const estimatedCost = itemsCharged * API_COSTS.apify.perSupremeItem;
        logApiCost({
          userId: costCtx?.userId,
          source: costCtx?.source ?? "leads",
          searchId: costCtx?.searchId,
          provider: "apify",
          operation: "fetchPostEngagersSupreme",
          estimatedCost,
          metadata: {
            postUrl: resolvedPostUrl.slice(0, 200),
            reactions: reactions.length,
            comments: comments.length,
            numLikes,
            numComments,
          },
        });

        return {
          reactions: reactions as Array<Record<string, unknown>>,
          comments,
        };
      }

      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
        continue;
      }
      const text = await res.text().catch(() => "");
      console.error(`[apify] fetchPostEngagersSupreme: status=${res.status} body=${text.slice(0, 300)}`);
      return { reactions: [], comments: [] };
    } catch (err) {
      console.error(`[apify] fetchPostEngagersSupreme exception: ${err instanceof Error ? err.message : err}`);
      if (attempt < MAX_RETRIES) { await new Promise((r) => setTimeout(r, (attempt + 1) * 3000)); continue; }
      return { reactions: [], comments: [] };
    }
  }
  return { reactions: [], comments: [] };
}

/**
 * Legacy implementation: harvestapi~linkedin-profile-posts. Kept behind
 * USE_LEGACY_APIFY_ACTORS=1 env flag for immediate rollback if supreme
 * misbehaves in prod. Delete once stable for a couple of weeks.
 */
async function fetchPostEngagersHarvestLegacy(
  resolvedPostUrl: string,
  maxReactions: number,
  maxComments: number,
  costCtx?: FetchEngagersCostCtx
): Promise<{ reactions: Array<Record<string, unknown>>; comments: Array<Record<string, unknown>> }> {
  const token = process.env.APIFY_API_TOKEN!;
  console.log(`[apify] fetchPostEngagersHarvestLegacy: calling with targetUrls=[${resolvedPostUrl}]`);

  const apifyUrl = `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-posts/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const body = {
    targetUrls: [resolvedPostUrl],
    maxPosts: 1,
    maxReactions,
    maxComments,
    scrapeReactions: true,
    scrapeComments: true,
    includeQuotePosts: false,
    includeReposts: false,
  };

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(apifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(240_000),
      });

      if (res.status === 200 || res.status === 201) {
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          console.log(`[apify] fetchPostEngagersHarvestLegacy: Apify returned empty`);
          return { reactions: [], comments: [] };
        }

        const reactions: Array<Record<string, unknown>> = [];
        const comments: Array<Record<string, unknown>> = [];
        for (const item of data as Array<Record<string, unknown>>) {
          const itemType = String(item.type ?? "");
          if (itemType === "reaction") reactions.push(item);
          else if (itemType === "comment") comments.push(item);
        }

        console.log(`[apify] fetchPostEngagersHarvestLegacy: ${reactions.length} reactions, ${comments.length} comments from ${data.length} items`);

        const items = reactions.length + comments.length;
        const estimatedCost = items * API_COSTS.apify.perEngagerItem + API_COSTS.apify.fetchPostEngagers;
        logApiCost({
          userId: costCtx?.userId,
          source: costCtx?.source ?? "leads",
          searchId: costCtx?.searchId,
          provider: "apify",
          operation: "fetchPostEngagers",
          estimatedCost,
          metadata: {
            postUrl: resolvedPostUrl.slice(0, 200),
            reactions: reactions.length,
            comments: comments.length,
            maxReactions,
            maxComments,
          },
        });

        return { reactions, comments };
      }

      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
        continue;
      }
      console.error(`[apify] fetchPostEngagersHarvestLegacy: Apify error status=${res.status}`);
      return { reactions: [], comments: [] };
    } catch (err) {
      console.error(`[apify] fetchPostEngagersHarvestLegacy exception: ${err instanceof Error ? err.message : err}`);
      if (attempt < MAX_RETRIES) { await new Promise((r) => setTimeout(r, (attempt + 1) * 3000)); continue; }
      return { reactions: [], comments: [] };
    }
  }
  return { reactions: [], comments: [] };
}

// ---------------------------------------------------------------------------
// Helpers for building Apify URLs
// ---------------------------------------------------------------------------

function apifyActorUrl(actor: string): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return "";
  return `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
}

async function apifyPostJson(
  actor: string,
  body: unknown,
  timeoutMs: number,
  logPrefix: string
): Promise<{ status: number; data: unknown }> {
  const url = apifyActorUrl(actor);
  if (!url) {
    console.error(`[apify] APIFY_API_TOKEN is not set (${logPrefix})`);
    return { status: 500, data: null };
  }

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const status = res.status;
      if (status === 200 || status === 201) {
        const data = await res.json();
        return { status: 200, data };
      }
      const text = await res.text();
      console.error(`[apify] ${logPrefix} error status=${status} body=${text.slice(0, 400)}`);
      if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
        continue;
      }
      return { status, data: null };
    } catch (err) {
      console.error(`[apify] ${logPrefix} exception: ${err instanceof Error ? err.message : err}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
        continue;
      }
      return { status: 500, data: null };
    }
  }
  return { status: 500, data: null };
}

// ---------------------------------------------------------------------------
// LinkedIn profile by slug (replaces scrapingdog.fetchLinkedInProfile)
// ---------------------------------------------------------------------------

/**
 * Normalize a harvestapi profile item into a shape compatible with the
 * existing `normalizeProfileData` helper (`src/lib/normalize.ts`), so that
 * callers migrating from `scrapingdog.fetchLinkedInProfile` don't need to
 * change their downstream parsing.
 */
function normalizeHarvestProfile(raw: Record<string, unknown>): Record<string, unknown> {
  const exp = (raw.experience ?? raw.experiences) as Array<Record<string, unknown>> | undefined;
  const experience = Array.isArray(exp)
    ? exp.map((e) => ({
        title: e.title ?? e.position ?? e.role ?? null,
        position: e.position ?? e.title ?? null,
        company: e.company ?? e.companyName ?? e.company_name ?? null,
        company_name: e.companyName ?? e.company ?? null,
        start_date: e.startDate ?? e.start_date ?? null,
        end_date: e.endDate ?? e.end_date ?? null,
        starts_at: e.startDate ?? e.starts_at ?? null,
        ends_at: e.endDate ?? e.ends_at ?? null,
        description: e.description ?? null,
      }))
    : [];

  const current = (raw.currentPosition ?? raw.current_position) as Record<string, unknown> | undefined;
  const currentCompany = current ? (current.companyName ?? current.company ?? current.company_name ?? null) : null;
  const currentTitle = current ? (current.title ?? current.position ?? null) : null;

  // Build full name from firstName + lastName when name is absent
  const builtName = [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim() || null;

  // profilePicture may be a string URL, an object with size variants, or
  // empty string. Use || (not ??) to skip empty strings too.
  const picCandidates = [
    raw.profilePicture, raw.picture, raw.photo,
    raw.profile_pic_url, raw.profilePictureUrl, raw.avatar,
  ];
  let profilePicUrl = "";
  for (const c of picCandidates) {
    if (typeof c === "string" && c.startsWith("http")) {
      profilePicUrl = c;
      break;
    }
    if (c && typeof c === "object") {
      const obj = c as Record<string, unknown>;
      const url = String(obj.original || obj.large || obj.medium || obj.small || "");
      if (url.startsWith("http")) {
        profilePicUrl = url;
        break;
      }
    }
  }

  return {
    ...raw,
    name: raw.name ?? raw.fullName ?? raw.full_name ?? builtName,
    fullName: raw.fullName ?? raw.name ?? builtName,
    headline: raw.headline ?? raw.sub_title ?? null,
    about: raw.about ?? raw.summary ?? null,
    location: raw.location ?? raw.locationName ?? null,
    followers: raw.followerCount ?? raw.followersCount ?? raw.followers_count ?? raw.followers ?? null,
    follower_count: raw.followerCount ?? raw.followersCount ?? raw.follower_count ?? null,
    followers_count: raw.followerCount ?? raw.followersCount ?? raw.followers_count ?? null,
    connections: raw.connectionsCount ?? raw.connections_count ?? raw.connections ?? null,
    connection_count: raw.connectionsCount ?? null,
    public_identifier: raw.publicIdentifier ?? raw.public_identifier ?? null,
    linkedin_internal_id: raw.linkedinInternalId ?? raw.profileId ?? raw.linkedin_internal_id ?? null,
    profile_id: raw.profileId ?? raw.public_identifier ?? null,
    company: currentCompany,
    title: currentTitle,
    experience,
    // Flatten photo to a string URL (casting-search-background checks
    // profile_photo, profilePicture, photo — cover all variants).
    profilePicture: profilePicUrl,
    profile_photo: profilePicUrl,
    profile_pic_url: profilePicUrl,
  };
}

export async function fetchLinkedInProfileApify(
  slugOrUrl: string
): Promise<ApifyLinkedInProfileResult> {
  // Accept both a bare slug (public or ACoAA...) and a full LinkedIn URL.
  // Full URLs preserve case, which matters: ACoAA... base64 IDs are
  // case-sensitive and lower-casing them yields 404/403 from harvestapi.
  const isUrl = /^https?:\/\//i.test(slugOrUrl);
  const profileUrl = isUrl
    ? slugOrUrl
    : `https://www.linkedin.com/in/${slugOrUrl.replace(/^\/+|\/+$/g, "")}/`;
  const logKey = isUrl ? profileUrl.slice(0, 80) : slugOrUrl.slice(0, 60);
  console.log(`[apify] fetchLinkedInProfileApify target="${logKey}"`);

  const body = {
    profileScraperMode: "Profile details no email ($4 per 1k)",
    urls: [profileUrl],
  };

  const { status, data } = await apifyPostJson(
    "harvestapi~linkedin-profile-scraper",
    body,
    180_000,
    `profile-scraper ${logKey}`
  );

  logApiCost({
    source: "enrichment",
    provider: "apify",
    operation: "fetchLinkedInProfileApify",
    estimatedCost: API_COSTS.apify.fetchLinkedInProfileApify,
    metadata: { target: logKey, status },
  });

  if (status !== 200) {
    return { status, data: null, error: `Apify profile scraper status ${status}` };
  }

  if (!Array.isArray(data) || data.length === 0) {
    console.log(`[apify] fetchLinkedInProfileApify: empty dataset for target="${logKey}"`);
    return { status: 404, data: null, error: "Empty dataset" };
  }

  const first = (data as Array<Record<string, unknown>>)[0];

  // harvestapi wraps inaccessible profiles in an error shell instead of
  // returning real data: { element: null, status: 403|404, error: ..., query: {...} }.
  // Detect and surface that as a proper error so callers can fall back.
  const firstStatus = Number(first.status ?? 200);
  const hasElement = first.element !== undefined; // only present in error shells
  const hasError = first.error != null;
  if (hasElement && first.element == null && (firstStatus >= 400 || hasError)) {
    console.log(`[apify] fetchLinkedInProfileApify: actor returned error shell status=${firstStatus} for target="${logKey}"`);
    return {
      status: firstStatus || 404,
      data: null,
      error: typeof first.error === "string" ? first.error : "Profile not accessible",
    };
  }

  const normalized = normalizeHarvestProfile(first);
  return { status: 200, data: normalized };
}

// ---------------------------------------------------------------------------
// Google SERP (replaces scrapingdog.searchGoogle)
// ---------------------------------------------------------------------------

/**
 * Build Google's `tbs` date range parameter from YYYY-MM-DD strings.
 * Output: `cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY`
 */
export function buildDateRangeTbs(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split("-");
  const [ey, em, ed] = endDate.split("-");
  return `cdr:1,cd_min:${sm}/${sd}/${sy},cd_max:${em}/${ed}/${ey}`;
}

/** Extract LinkedIn activity ID from a post URL (permalink or share URN). */
export function extractActivityId(url: string): string | null {
  const actMatch = url.match(/activity[_-](\d+)/);
  if (actMatch) return actMatch[1];
  const urnMatch = url.match(/urn:li:(?:share|activity):(\d+)/);
  return urnMatch ? urnMatch[1] : null;
}

export function extractAuthorSlugFromPostUrl(url: string): string | null {
  const postsMatch = url.match(/linkedin\.com\/posts\/([^_/?#]+)/);
  return postsMatch ? postsMatch[1] : null;
}

export async function searchGoogleApify(
  query: string,
  options?: ApifyGoogleSearchOptions
): Promise<{ results: ApifyGoogleSearchResult[] }> {
  const resultsPerPage = options?.results ?? 10;
  const page = options?.page ?? 0;
  const maxPagesPerQuery = page + 1;

  const countryRaw = options?.country ?? "";
  console.log(`[apify] searchGoogleApify query="${query}" page=${page} results=${resultsPerPage} country="${countryRaw}"`);

  const body: Record<string, unknown> = {
    queries: query,
    resultsPerPage,
    maxPagesPerQuery,
    saveHtml: false,
    saveHtmlToKeyValueStore: false,
    mobileResults: false,
  };
  if (countryRaw) body.countryCode = countryRaw;
  // NOTE: languageCode is intentionally omitted — the Apify actor
  // rejects common ISO codes (e.g. "pt") and the search query itself
  // already contains keywords in the target language, so Google returns
  // results in the correct language without this hint.
  if (options?.domain) body.forceExactMatch = false;

  const { status, data } = await apifyPostJson(
    "apify~google-search-scraper",
    body,
    180_000,
    `google-search query="${query.slice(0, 60)}"`
  );

  logApiCost({
    source: "casting",
    provider: "apify",
    operation: "searchGoogleApify",
    estimatedCost: API_COSTS.apify.searchGoogleApify,
    metadata: { query: query.slice(0, 200), page },
  });

  if (status !== 200 || !Array.isArray(data)) {
    return { results: [] };
  }

  // apify~google-search-scraper returns array of page objects, each with
  // `organicResults: [{ title, url, description, ... }]`. We may receive
  // multiple pages; flatten them and pick the one matching `page`.
  const pages = data as Array<Record<string, unknown>>;
  let organic: Array<Record<string, unknown>> = [];
  if (pages.length > 0) {
    // Prefer the requested page if present, else first page
    const target = pages[page] ?? pages[0];
    organic = (target?.organicResults as Array<Record<string, unknown>>) ?? [];
  }

  const results: ApifyGoogleSearchResult[] = organic.map((r) => ({
    title: String(r.title ?? ""),
    link: String(r.url ?? r.link ?? ""),
    snippet: String(r.description ?? r.snippet ?? ""),
  }));

  return { results };
}

// ---------------------------------------------------------------------------
// LinkedIn post by URL — resolves share/urn URLs to canonical permalinks.
//
// Apify has no universally-available actor for a single post lookup, and
// our only use-case is turning a share URN into a permalink so the
// `harvestapi~linkedin-profile-posts` engagers call accepts it. That can be
// done in-process: LinkedIn's public share page (no auth required)
// redirects/renders with an `og:url` / canonical `<link>` pointing to the
// real permalink.
// ---------------------------------------------------------------------------

export async function fetchLinkedInPostApify(
  postUrl: string
): Promise<ApifyLinkedInProfileResult> {
  let cleanUrl: string;
  try { cleanUrl = decodeURIComponent(postUrl); } catch { cleanUrl = postUrl; }

  // Normalize locale domains
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.hostname.endsWith("linkedin.com") && parsed.hostname !== "www.linkedin.com") {
      parsed.hostname = "www.linkedin.com";
      cleanUrl = parsed.toString();
    }
  } catch { /* leave as-is */ }

  console.log(`[apify] fetchLinkedInPostApify url=${cleanUrl.slice(0, 120)}`);

  try {
    const res = await fetch(cleanUrl, {
      redirect: "follow",
      headers: {
        // Real-browser UA so LinkedIn serves the public preview with
        // canonical metadata rather than the auth wall.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.error(`[apify] fetchLinkedInPostApify fetch status=${res.status}`);
      return { status: res.status, data: null, error: `HTTP ${res.status}` };
    }

    const finalUrl = res.url || cleanUrl;
    const html = await res.text();

    const ogMatch = html.match(/property="og:url"\s+content="([^"]+)"/i);
    const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
    const redirectUrl = ogMatch?.[1] ?? canonicalMatch?.[1] ?? finalUrl;

    const authorSlug =
      redirectUrl.match(/linkedin\.com\/posts\/([^_/?#]+)/)?.[1]
      ?? html.match(/linkedin\.com\/in\/([^"/?#]+)/)?.[1]
      ?? null;

    const realActivityId =
      redirectUrl.match(/activity[_-](\d+)/)?.[1]
      ?? html.match(/urn:li:activity:(\d+)/)?.[1]
      ?? extractActivityId(cleanUrl)
      ?? null;

    console.log(`[apify] fetchLinkedInPostApify resolved → author="${authorSlug}" activity="${realActivityId}" permalink="${redirectUrl.slice(0, 120)}"`);

    return {
      status: 200,
      data: {
        activity_id: realActivityId,
        activity_url: redirectUrl,
        share_url: cleanUrl,
        text: "",
        reactions_count: 0,
        comment_count: 0,
        author: {
          name: null,
          public_identifier: authorSlug,
          headline: null,
          follower_count: null,
          image: null,
          url: authorSlug ? `https://www.linkedin.com/in/${authorSlug}/` : null,
        },
        comments: [],
        _source: "linkedin-public-html",
      },
    };
  } catch (err) {
    console.error(`[apify] fetchLinkedInPostApify exception: ${err instanceof Error ? err.message : err}`);
    return { status: 500, data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// LinkedIn Company Scraper (Share of LinkedIn — market mapping)
// ---------------------------------------------------------------------------

export interface CompanyInfo {
  name: string;
  description: string;
  industry: string;
  specialties: string;
  website: string;
  followers: number;
  employeeCount: number;
  similarPages: Array<{ name: string; url: string; industry: string; location: string; logoUrl: string }>;
  affiliatedPages: Array<{ name: string; url: string; category: string }>;
  profilePicUrl: string;
}

export async function fetchLinkedInCompany(
  companySlug: string
): Promise<{ status: number; data: CompanyInfo | null; error?: string }> {
  const companyUrl = `https://www.linkedin.com/company/${companySlug.replace(/^\/+|\/+$/g, "")}/`;
  console.log(`[apify] fetchLinkedInCompany slug="${companySlug}"`);

  const { status, data } = await apifyPostJson(
    "dev_fusion~linkedin-company-scraper",
    { profileUrls: [companyUrl] },
    120_000,
    `company-scraper slug=${companySlug}`
  );

  logApiCost({
    source: "leads",
    provider: "apify",
    operation: "fetchLinkedInCompany",
    estimatedCost: API_COSTS.apify.fetchLinkedInCompany,
    metadata: { slug: companySlug, status },
  });

  if (status !== 200 || !Array.isArray(data) || data.length === 0) {
    return { status: status || 404, data: null, error: "Company not found" };
  }

  const raw = (data as Array<Record<string, unknown>>)[0];
  // dev_fusion uses: similarOrganizations, affiliatedOrganizationsByEmployees
  const similar = (raw.similarOrganizations ?? raw.similar_pages ?? []) as Array<Record<string, unknown>>;
  const affiliated = (raw.affiliatedOrganizationsByShowcases ?? raw.affiliated_pages ?? []) as Array<Record<string, unknown>>;
  // specialities (dev_fusion) is an array; specialties (data-slayer) was a string
  const rawSpec = raw.specialities ?? raw.specialties ?? [];
  const specialtiesStr = Array.isArray(rawSpec) ? rawSpec.join(", ") : String(rawSpec);

  const info: CompanyInfo = {
    name: String(raw.companyName ?? raw.name ?? ""),
    description: String(raw.description ?? ""),
    industry: String(raw.industry ?? raw.about_industry ?? ""),
    specialties: specialtiesStr,
    website: String(raw.websiteUrl ?? raw.website ?? raw.formatted_url ?? ""),
    followers: Number(raw.followerCount ?? raw.followers ?? 0),
    employeeCount: Number(raw.employeeCount ?? raw.employee_count ?? 0),
    similarPages: similar.map((sp) => ({
      name: String(sp.name ?? ""),
      url: String(sp.url ?? ""),
      industry: String(sp.industry ?? ""),
      location: String(sp.location ?? ""),
      logoUrl: String(sp.logoResolutionResult ?? sp.logo_url ?? ""),
    })),
    affiliatedPages: affiliated.map((ap) => ({
      name: String(ap.name ?? ""),
      url: String(ap.url ?? ""),
      category: String(ap.category ?? ""),
    })),
    profilePicUrl: String(raw.logoResolutionResult ?? raw.profile_pic_url ?? ""),
  };

  console.log(`[apify] fetchLinkedInCompany: "${info.name}" — ${info.similarPages.length} similar, ${info.employeeCount} employees`);
  return { status: 200, data: info };
}

// ---------------------------------------------------------------------------
// LinkedIn Company Employees Scraper
// ---------------------------------------------------------------------------

export interface EmployeeProfile {
  name: string;
  slug: string;
  headline: string;
  linkedinUrl: string;
  profilePicUrl: string;
  location: string;
  isCreator: boolean;
  isInfluencer: boolean;
}

export async function fetchCompanyEmployees(
  companyUrl: string,
  limit = 30
): Promise<EmployeeProfile[]> {
  console.log(`[apify] fetchCompanyEmployees url="${companyUrl.slice(0, 80)}" limit=${limit}`);

  const { status, data } = await apifyPostJson(
    "apimaestro~linkedin-company-employees-scraper-no-cookies",
    { companyUrl, limit },
    90_000,
    `employees-scraper limit=${limit}`
  );

  if (status !== 200 || !Array.isArray(data)) {
    console.log(`[apify] fetchCompanyEmployees: failed status=${status}`);
    return [];
  }

  const employees: EmployeeProfile[] = (data as Array<Record<string, unknown>>)
    .slice(0, limit)
    .map((e) => ({
      name: String(e.fullname ?? [e.first_name, e.last_name].filter(Boolean).join(" ") ?? ""),
      slug: String(e.public_identifier ?? ""),
      headline: String(e.headline ?? ""),
      linkedinUrl: String(e.profile_url ?? ""),
      profilePicUrl: String(e.profile_picture_url ?? ""),
      location: typeof e.location === "object" && e.location
        ? String((e.location as Record<string, unknown>).full ?? "")
        : String(e.location ?? ""),
      isCreator: Boolean(e.is_creator),
      isInfluencer: Boolean(e.is_influencer),
    }));

  const itemCost = employees.length * API_COSTS.apify.fetchCompanyEmployees;
  logApiCost({
    source: "leads",
    provider: "apify",
    operation: "fetchCompanyEmployees",
    estimatedCost: itemCost,
    metadata: { companyUrl: companyUrl.slice(0, 200), found: employees.length, limit },
  });

  console.log(`[apify] fetchCompanyEmployees: found ${employees.length} employees`);
  return employees;
}
