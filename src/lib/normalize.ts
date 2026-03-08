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

  // Filter activities to only count original posts, not reactions/comments/shares
  const isOriginalPost = (item: Record<string, unknown>): boolean => {
    const status = String(item.activity_status ?? item.status ?? item.type ?? "").toLowerCase();
    if (status) {
      // Exclude items explicitly marked as reactions/comments
      if (/liked|reacted|commented|celebrated|voted|suggested|supported|funny|insightful|love|curious/i.test(status)) {
        return false;
      }
      // Include items explicitly marked as original posts
      if (/posted|shared|published/i.test(status)) {
        return true;
      }
    }
    // Fallback: count only items with meaningful text content (reactions typically don't have text)
    const text = String(item.title ?? item.text ?? item.message ?? "");
    return text.trim().length > 20;
  };

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

export function buildCurrentJob(
  role: string | null | undefined,
  company: string | null | undefined
): string | null {
  if (role && company) return `${role} at ${company}`;
  if (role) return role;
  return null;  // Don't return just company — it duplicates company_current
}
