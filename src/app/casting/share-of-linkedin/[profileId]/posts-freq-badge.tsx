"use client";

import {
  formatPostsPerMonth,
  postsFrequencyBadgeClass,
  postsFrequencyBucket,
  POSTS_FREQ_TOOLTIP,
} from "@/lib/format-posts-frequency";

interface Props {
  ppm: number | null | undefined;
  size?: "sm" | "md";
}

export default function PostsFreqBadge({ ppm, size = "sm" }: Props) {
  const bucket = postsFrequencyBucket(ppm);
  const label = formatPostsPerMonth(ppm);
  if (!bucket || !label) return null;
  const sizeCls =
    size === "md"
      ? "text-[10px] px-2 py-0.5 rounded-full"
      : "text-[9px] px-1.5 py-0.5 rounded-full";
  return (
    <span
      className={`font-bold shrink-0 relative group/tip ${sizeCls} ${postsFrequencyBadgeClass(bucket)}`}
    >
      {label}
      <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-[#0B0B1A] border border-white/10 text-[9px] text-white/70 font-normal whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity">
        {POSTS_FREQ_TOOLTIP}
      </span>
    </span>
  );
}
