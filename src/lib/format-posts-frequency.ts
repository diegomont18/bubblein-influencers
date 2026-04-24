export type PostsFreqBucket = "low" | "mid" | "high";

export function postsFrequencyBucket(ppm: number | null | undefined): PostsFreqBucket | null {
  if (ppm == null || !Number.isFinite(ppm)) return null;
  if (ppm < 2) return "low";
  if (ppm <= 5) return "mid";
  return "high";
}

export function formatPostsPerMonth(ppm: number | null | undefined): string | null {
  const b = postsFrequencyBucket(ppm);
  if (!b) return null;
  return b === "low" ? "1/mês" : b === "mid" ? "2-5/mês" : "+5/mês";
}

export function postsFrequencyBadgeClass(bucket: PostsFreqBucket): string {
  return bucket === "high"
    ? "text-green-400 bg-green-400/10"
    : bucket === "mid"
      ? "text-yellow-400 bg-yellow-400/10"
      : "text-red-400 bg-red-400/10";
}

export const POSTS_FREQ_TOOLTIP = "Posts estimados por mês no LinkedIn";
