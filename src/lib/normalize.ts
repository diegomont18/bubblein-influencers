import type { Database } from "./supabase/types";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type ExperienceInsert =
  Database["public"]["Tables"]["profile_experiences"]["Insert"];

export function normalizeProfileData(
  raw: Record<string, unknown>
): ProfileUpdate {
  return {
    name: str(raw.fullName) || str(raw.full_name) || str(raw.name),
    headline: str(raw.headline) || str(raw.sub_title) || buildHeadlineFromDescription(raw),
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
    role: str(exp.title) || str(exp.role),
    start_date: str(exp.start_date) || str(exp.starts_at?.toString()),
    end_date: str(exp.end_date) || str(exp.ends_at?.toString()),
    is_current: exp.end_date == null && exp.ends_at == null,
    description: str(exp.description),
  }));
}

export function calculatePostingFrequency(
  raw: Record<string, unknown>
): { label: string; score: number } {
  const activities = raw.activities as
    | Array<Record<string, unknown>>
    | undefined;
  const articles = raw.articles as Array<Record<string, unknown>> | undefined;
  const posts = raw.posts as Array<Record<string, unknown>> | undefined;
  const totalCount = (activities?.length ?? 0) + (articles?.length ?? 0) + (posts?.length ?? 0);

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

function parseAbbreviatedNumber(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return null;
  const match = val.match(/([\d,.]+)\s*([KkMm])?/);
  if (!match) return null;
  const base = parseFloat(match[1].replace(/,/g, ""));
  if (isNaN(base)) return null;
  const multiplier = { k: 1000, m: 1000000 }[(match[2] || "").toLowerCase()] ?? 1;
  return Math.round(base * multiplier);
}

function buildHeadlineFromDescription(raw: Record<string, unknown>): string | null {
  const desc = raw.description as Record<string, unknown> | undefined;
  if (!desc) return null;
  const company = str(desc.description1);
  if (company) return company;
  return null;
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
    (e) => e.end_date == null && e.ends_at == null
  );
  return str((current ?? experiences[0]).company) || str((current ?? experiences[0]).company_name);
}

function extractCurrentRole(raw: Record<string, unknown>): string | null {
  const experiences = raw.experience as
    | Array<Record<string, unknown>>
    | undefined;
  if (!Array.isArray(experiences) || experiences.length === 0) return null;
  const current = experiences.find(
    (e) => e.end_date == null && e.ends_at == null
  );
  return str((current ?? experiences[0]).title) || str((current ?? experiences[0]).role);
}
