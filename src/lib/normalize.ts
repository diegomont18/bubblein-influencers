import type { Database } from "./supabase/types";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type ExperienceInsert =
  Database["public"]["Tables"]["profile_experiences"]["Insert"];

export function normalizeProfileData(
  raw: Record<string, unknown>
): ProfileUpdate {
  return {
    name: str(raw.full_name) || str(raw.name),
    headline: str(raw.sub_title) || str(raw.headline),
    company_current: str(raw.company) || extractCurrentCompany(raw),
    role_current: str(raw.title) || extractCurrentRole(raw),
    location: str(raw.location?.toString()),
    followers_count: num(raw.followers) ?? num(raw.follower_count),
    connections_count: num(raw.connections) ?? num(raw.connection_count),
    about: str(raw.about) || str(raw.summary),
    linkedin_id: str(raw.profile_id) || str(raw.entity_urn),
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
  const posts = raw.posts as Array<Record<string, unknown>> | undefined;
  const count = activities?.length ?? posts?.length ?? 0;

  if (count >= 20) return { label: "daily", score: 5 };
  if (count >= 10) return { label: "several_per_week", score: 4 };
  if (count >= 5) return { label: "weekly", score: 3 };
  if (count >= 2) return { label: "biweekly", score: 2 };
  if (count >= 1) return { label: "monthly", score: 1 };
  return { label: "rarely", score: 0 };
}

function str(val: unknown): string | null {
  if (typeof val === "string" && val.trim()) return val.trim();
  return null;
}

function num(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseInt(val.replace(/[,.\s]/g, ""), 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

function extractCurrentCompany(raw: Record<string, unknown>): string | null {
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
