export type PostsFreqBucket = "low" | "mid" | "high";

export function postsFrequencyBucket(ppm: number | null | undefined): PostsFreqBucket | null {
  if (ppm == null || !Number.isFinite(ppm)) return null;
  if (ppm < 4) return "low";
  if (ppm <= 10) return "mid";
  return "high";
}

export function formatPostsPerMonth(ppm: number | null | undefined): string | null {
  const b = postsFrequencyBucket(ppm);
  if (!b) return null;
  return b === "low" ? "1–4" : b === "mid" ? "4–10" : "10+";
}

export function postsFrequencyBadgeClass(bucket: PostsFreqBucket): string {
  return bucket === "high"
    ? "text-[#a2f31f] bg-[#a2f31f]/10"
    : bucket === "mid"
      ? "text-[#adaaaa] bg-[#adaaaa]/10"
      : "text-[#ff946e] bg-[#ff946e]/10";
}

export function postsFrequencyTextClass(ppm: number | null | undefined): string {
  const b = postsFrequencyBucket(ppm);
  return b === "high" ? "text-[#a2f31f]" : b === "mid" ? "text-[#adaaaa]" : "text-[#ff946e]";
}

export const POSTS_FREQ_TOOLTIP = "Posts estimados por mês no LinkedIn";
