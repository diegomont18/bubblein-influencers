import type { Database } from "./supabase/types";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type ExperienceInsert =
  Database["public"]["Tables"]["profile_experiences"]["Insert"];

export function normalizeProfileData(
  raw: Record<string, unknown>
): ProfileUpdate {
  return {
    name: str(raw.fullName) || str(raw.full_name) || str(raw.name),
    headline: str(raw.headline) || str(raw.sub_title) || buildFallbackHeadline(raw),
    company_current: str(raw.company) || extractCurrentCompany(raw),
    role_current: str(raw.title) || extractCurrentRole(raw),
    location: str(raw.location?.toString()),
    followers_count: parseAbbreviatedNumber(raw.followers) ?? parseAbbreviatedNumber(raw.follower_count),
    connections_count: parseAbbreviatedNumber(raw.connections) ?? parseAbbreviatedNumber(raw.connection_count),
    about: str(raw.about) || str(raw.summary),
    linkedin_id: str(raw.profile_id) || str(raw.linkedin_internal_id) || str(raw.public_identifier) || str(raw.entity_urn),
  };
}

export function normalizeExperiences(
  raw: Record<string, unknown>,
  profileId: string
): ExperienceInsert[] {
  const experiences = raw.experience as
    | Array<Record<string, unknown>>
    | undefined;
  if (!Array.isArray(experiences)) return [];

  return experiences.map((exp) => ({
    profile_id: profileId,
    company: str(exp.company) || str(exp.company_name),
    role: str(exp.title) || str(exp.role) || str(exp.position),
    start_date: str(exp.start_date) || str(exp.starts_at?.toString()),
    end_date: str(exp.end_date) || str(exp.ends_at?.toString()),
    is_current: exp.end_date == null && (exp.ends_at == null || exp.ends_at === "Present"),
    description: str(exp.description),
  }));
}

// Shared helper: determines if an activity item is an original post (not a reaction/comment/share)
function isOriginalPost(item: Record<string, unknown>): boolean {
  const status = String(item.activity_status ?? item.status ?? item.type ?? item.activity ?? "").toLowerCase();
  if (status) {
    // Exclude items explicitly marked as reactions/comments
    if (/liked|reacted|commented|celebrated|voted|suggested|supported|funny|insightful|love|curious/i.test(status)) {
      return false;
    }
    // Exclude reshares/reposts
    if (/shared|reposted/i.test(status)) {
      return false;
    }
    // Include items explicitly marked as original posts
    if (/posted|published/i.test(status)) {
      return true;
    }
  }
  // Fallback: count only items with meaningful text content (reactions typically don't have text)
  const text = String(item.title ?? item.text ?? item.message ?? "");
  return text.trim().length > 20;
}

export function calculatePostingFrequency(
  raw: Record<string, unknown>,
  postsData?: Record<string, unknown> | null
): { label: string; score: number } {
  // Log available post-related keys for debugging
  const postRelatedKeys = Object.keys(raw).filter(k =>
    /post|activit|article|feed|content/i.test(k)
  );
  console.log(`[posting-frequency] Available post-related keys in profile data: ${JSON.stringify(postRelatedKeys)}`);

  // Prefer dedicated posts data if provided, otherwise use profile data
  const source = postsData ?? raw;
  const activities = source.activities as
    | Array<Record<string, unknown>>
    | undefined;
  const articles = source.articles as Array<Record<string, unknown>> | undefined;
  const posts = source.posts as Array<Record<string, unknown>> | undefined;
  const postItems = source.post_items as Array<Record<string, unknown>> | undefined;

  // Debug: log the first activity item's structure so we can see what ScrapingDog returns
  if (activities && activities.length > 0) {
    const first = activities[0];
    const sampleKeys = Object.keys(first);
    const sampleValues: Record<string, unknown> = {};
    for (const k of sampleKeys.slice(0, 10)) {
      const v = first[k];
      sampleValues[k] = typeof v === "string" ? v.slice(0, 80) : v;
    }
    console.log(`[posting-frequency] First activity item keys: ${JSON.stringify(sampleKeys)}`);
    console.log(`[posting-frequency] First activity sample: ${JSON.stringify(sampleValues)}`);
    console.log(`[posting-frequency] activity_status=${first.activity_status}, status=${first.status}, type=${first.type}`);
  }

  const originalPosts = (activities ?? []).filter(isOriginalPost);
  console.log(`[posting-frequency] activities total=${activities?.length ?? 0}, original posts=${originalPosts.length}`);

  const totalCount = originalPosts.length + (articles?.length ?? 0) + (posts?.length ?? 0) + (postItems?.length ?? 0);

  // ScrapingDog returns a snapshot of recent items (typically ~20).
  // Estimate posts per month: assume the snapshot covers roughly 1 month.
  // If we have date info we could be more precise, but for now use count directly.
  const postsPerMonth = totalCount;

  return {
    label: postsPerMonth > 0 ? `${postsPerMonth}/mo` : "0/mo",
    score: postsPerMonth,
  };
}

export function calculatePostingFrequencyFromApifyPosts(
  posts: Array<Record<string, unknown>>
): { label: string; score: number } {
  if (posts.length === 0) return { label: "0/mo", score: 0 };

  // Find the oldest post date
  let oldestDate: Date | null = null;
  for (const post of posts) {
    const dateStr = post.postedAt ?? post.posted_at ?? post.postedDate ?? post.date;
    if (typeof dateStr === "string") {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        if (!oldestDate || d < oldestDate) oldestDate = d;
      }
    }
  }

  if (!oldestDate) {
    // No date info — at least we know they posted, so floor at 1
    return { label: "1/mo", score: 1 };
  }

  const now = new Date();
  const spanDays = Math.max((now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24), 1);
  const postsPerMonth = Math.max(Math.round((posts.length / spanDays) * 30 * 10) / 10, 1);

  console.log(`[posting-frequency] From ${posts.length} Apify posts spanning ${Math.round(spanDays)}d → ${postsPerMonth}/mo`);

  return {
    label: `${postsPerMonth}/mo`,
    score: postsPerMonth,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  }
  return sorted[mid];
}

export function calculateEngagementMetrics(
  raw: Record<string, unknown>
): { avgLikes: number | null; avgComments: number | null; medianLikes: number | null; medianComments: number | null } {
  const activities = raw.activities as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(activities) || activities.length === 0) {
    return { avgLikes: null, avgComments: null, medianLikes: null, medianComments: null };
  }

  // Log engagement-related keys from first activity for debugging
  const first = activities[0];
  const engagementKeys = Object.keys(first).filter(k =>
    /like|reaction|comment|social|count|num/i.test(k)
  );
  console.log(`[engagement] First activity engagement-related keys: ${JSON.stringify(engagementKeys)}`);
  for (const k of engagementKeys) {
    console.log(`[engagement]   ${k} = ${JSON.stringify(first[k])}`);
  }

  const originalPosts = activities.filter(isOriginalPost);
  if (originalPosts.length === 0) {
    return { avgLikes: null, avgComments: null, medianLikes: null, medianComments: null };
  }

  let likesSum = 0;
  let likesCount = 0;
  let commentsSum = 0;
  let commentsCount = 0;
  const likesValues: number[] = [];
  const commentsValues: number[] = [];

  for (const post of originalPosts) {
    // Try multiple field name patterns for likes/reactions
    const likes = extractNumeric(post, [
      "num_likes", "reactionCount", "reaction_count", "likes_count", "likes", "total_likes",
    ]) ?? extractNested(post, [
      ["social_detail", "totalSocialActivityCounts", "numLikes"],
      ["socialDetail", "reactionCount"],
      ["social_counts", "likes"],
    ]);

    if (likes != null) {
      likesSum += likes;
      likesCount++;
      likesValues.push(likes);
    }

    // Try multiple field name patterns for comments
    const comments = extractNumeric(post, [
      "num_comments", "commentCount", "comment_count", "comments_count", "comments", "total_comments",
    ]) ?? extractNested(post, [
      ["social_detail", "totalSocialActivityCounts", "numComments"],
      ["socialDetail", "commentCount"],
      ["social_counts", "comments"],
    ]);

    if (comments != null) {
      commentsSum += comments;
      commentsCount++;
      commentsValues.push(comments);
    }
  }

  const avgLikes = likesCount > 0 ? Math.round((likesSum / likesCount) * 10) / 10 : null;
  const avgComments = commentsCount > 0 ? Math.round((commentsSum / commentsCount) * 10) / 10 : null;
  const medianLikes = median(likesValues);
  const medianComments = median(commentsValues);

  console.log(`[engagement] originalPosts=${originalPosts.length} avgLikes=${avgLikes} medianLikes=${medianLikes} (from ${likesCount} posts) avgComments=${avgComments} medianComments=${medianComments} (from ${commentsCount} posts)`);

  return { avgLikes, avgComments, medianLikes, medianComments };
}

/**
 * Extract up to `limit` post URLs from activity items that are original posts.
 */
export function getOriginalPostLinks(
  raw: Record<string, unknown>,
  limit = 3
): string[] {
  const activities = raw.activities as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(activities)) return [];

  const links: string[] = [];
  for (const item of activities) {
    if (links.length >= limit) break;
    if (!isOriginalPost(item)) continue;
    const link = typeof item.link === "string" ? item.link.trim() : null;
    if (link && link.startsWith("http")) {
      links.push(link);
    }
  }
  console.log(`[engagement] Found ${links.length} original post links (from ${activities.length} activities)`);
  return links;
}

/**
 * Compute average likes/comments from fetched post data objects.
 */
export function computeEngagementFromPosts(
  postDataList: Array<Record<string, unknown>>
): { avgLikes: number | null; avgComments: number | null; medianLikes: number | null; medianComments: number | null } {
  let likesSum = 0;
  let likesCount = 0;
  let commentsSum = 0;
  let commentsCount = 0;
  const likesValues: number[] = [];
  const commentsValues: number[] = [];

  if (postDataList.length > 0) {
    const first = postDataList[0];
    console.log(`[engagement] First post data keys: ${JSON.stringify(Object.keys(first))}`);
    const sampleLikes = first["reactions_count"] ?? first["reaction_count"] ?? first["num_likes"];
    const sampleComments = first["comment_count"] ?? first["num_comments"];
    console.log(`[engagement] Sample values: reactions_count=${first["reactions_count"]} comment_count=${first["comment_count"]} (raw: likes=${sampleLikes} comments=${sampleComments})`);
  }

  for (const post of postDataList) {
    // ScrapingDog post endpoint returns fields like num_likes, num_comments,
    // or nested social_counts. Try multiple patterns.
    const likes = extractNumeric(post, [
      "num_likes", "reactionCount", "reaction_count", "reactions_count", "likes_count", "likes",
      "total_likes", "numLikes", "total_reaction_count",
    ]) ?? extractNested(post, [
      ["social_detail", "totalSocialActivityCounts", "numLikes"],
      ["socialDetail", "reactionCount"],
      ["social_counts", "likes"],
      ["engagement", "likes"],
    ]);

    if (likes != null) {
      likesSum += likes;
      likesCount++;
      likesValues.push(likes);
    }

    const comments = extractNumeric(post, [
      "num_comments", "commentCount", "comment_count", "comments_count",
      "comments", "total_comments", "numComments", "total_comment_count",
    ]) ?? extractNested(post, [
      ["social_detail", "totalSocialActivityCounts", "numComments"],
      ["socialDetail", "commentCount"],
      ["social_counts", "comments"],
      ["engagement", "comments"],
    ]);

    if (comments != null) {
      commentsSum += comments;
      commentsCount++;
      commentsValues.push(comments);
    }
  }

  const avgLikes = likesCount > 0 ? Math.round((likesSum / likesCount) * 10) / 10 : null;
  const avgComments = commentsCount > 0 ? Math.round((commentsSum / commentsCount) * 10) / 10 : null;
  const medianLikes = median(likesValues);
  const medianComments = median(commentsValues);

  console.log(`[engagement] From ${postDataList.length} fetched posts: avgLikes=${avgLikes} medianLikes=${medianLikes} (${likesCount} had data) avgComments=${avgComments} medianComments=${medianComments} (${commentsCount} had data)`);
  return { avgLikes, avgComments, medianLikes, medianComments };
}

function extractNumeric(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const n = parseFloat(val);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function extractNested(obj: Record<string, unknown>, paths: string[][]): number | null {
  for (const path of paths) {
    let current: unknown = obj;
    for (const key of path) {
      if (current == null || typeof current !== "object") { current = undefined; break; }
      current = (current as Record<string, unknown>)[key];
    }
    if (typeof current === "number") return current;
    if (typeof current === "string") {
      const n = parseFloat(current);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function str(val: unknown): string | null {
  if (typeof val === "string" && val.trim()) return val.trim();
  return null;
}

export function parseAbbreviatedNumber(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return null;
  const match = val.match(/([\d,.]+)\s*([KkMm])?/);
  if (!match) return null;
  const base = parseFloat(match[1].replace(/,/g, ""));
  if (isNaN(base)) return null;
  const multiplier = { k: 1000, m: 1000000 }[(match[2] || "").toLowerCase()] ?? 1;
  return Math.round(base * multiplier);
}

function buildFallbackHeadline(raw: Record<string, unknown>): string | null {
  const desc = raw.description as Record<string, unknown> | undefined;
  if (!desc) return null;
  const parts = [str(desc.description1), str(desc.description2)].filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : null;
}

function extractCurrentCompany(raw: Record<string, unknown>): string | null {
  // Try description.description1 first (ScrapingDog format)
  const desc = raw.description as Record<string, unknown> | undefined;
  if (desc) {
    const company = str(desc.description1);
    if (company) return company;
  }
  const experiences = raw.experience as
    | Array<Record<string, unknown>>
    | undefined;
  if (!Array.isArray(experiences) || experiences.length === 0) return null;
  const current = experiences.find(
    (e) => e.end_date == null && (e.ends_at == null || e.ends_at === "Present")
  );
  const target = current ?? experiences[0];
  return str(target.company) || str(target.company_name);
}

function extractCurrentRole(raw: Record<string, unknown>): string | null {
  const experiences = raw.experience as
    | Array<Record<string, unknown>>
    | undefined;
  if (!Array.isArray(experiences) || experiences.length === 0) return null;
  const current = experiences.find(
    (e) => e.end_date == null && (e.ends_at == null || e.ends_at === "Present")
  );
  const target = current ?? experiences[0];
  return str(target.title) || str(target.role) || str(target.position);
}

export function calculateCreatorScore({
  followers_count,
  avg_likes_per_post,
  avg_comments_per_post,
  posting_frequency_score,
}: {
  followers_count: number | null | undefined;
  avg_likes_per_post: number | null | undefined;
  avg_comments_per_post: number | null | undefined;
  posting_frequency_score: number | null | undefined;
}): number | null {
  const hasEngagement = avg_likes_per_post != null || avg_comments_per_post != null;
  const hasFollowers = followers_count != null && followers_count > 0;
  const hasFrequency = posting_frequency_score != null;

  if (!hasEngagement && !hasFollowers && !hasFrequency) return null;

  // Engagement Rate Score (0–100)
  let engagementScore = 0;
  if (hasEngagement && hasFollowers) {
    const avgLikes = avg_likes_per_post ?? 0;
    const avgComments = avg_comments_per_post ?? 0;
    const engagementRate = (avgLikes + avgComments) / followers_count!;
    engagementScore = Math.min(engagementRate / 0.05, 1) * 100;
  }

  // Posting Frequency Score (0–100)
  let frequencyScore = 0;
  if (hasFrequency) {
    frequencyScore = Math.min(posting_frequency_score! / 4, 1) * 100;
  }

  // Audience Size Score (0–100)
  let audienceScore = 0;
  if (hasFollowers) {
    audienceScore = Math.min(Math.log10(Math.max(followers_count!, 1)) / 6, 1) * 100;
  }

  // Weighted sum with re-weighting for missing data
  let score: number;
  if (!hasEngagement && !hasFollowers) {
    // Only frequency available — can't compute meaningful score
    return null;
  } else if (!hasEngagement) {
    // Only frequency + audience → re-weight 80/20
    score = frequencyScore * 0.8 + audienceScore * 0.2;
  } else if (!hasFollowers) {
    // Only engagement + frequency → re-weight 55/45
    // (engagement rate is 0 without followers, so this path means engagement data exists but no followers)
    score = engagementScore * 0.55 + frequencyScore * 0.45;
  } else {
    // All data available → standard weights
    score = engagementScore * 0.5 + frequencyScore * 0.4 + audienceScore * 0.1;
  }

  return Math.round(score * 10) / 10;
}

export function buildCurrentJob(
  role: string | null | undefined,
  company: string | null | undefined
): string | null {
  if (role && company) return `${role} at ${company}`;
  if (role) return role;
  return null;  // Don't return just company — it duplicates company_current
}
