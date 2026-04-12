import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchProfilePosts } from "@/lib/apify";

function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function extractPostUrl(post: Record<string, unknown>): string {
  // Try direct post URL fields (not profile URLs)
  for (const key of ["postUrl", "permalink", "shareUrl"]) {
    const val = post[key];
    if (typeof val === "string" && val.includes("linkedin.com")) return val;
  }
  // Build from shareUrn (urn:li:share:XXXXX or urn:li:activity:XXXXX)
  const shareUrn = String(post.shareUrn ?? post.entityId ?? "");
  if (shareUrn.includes("urn:li:")) {
    return `https://www.linkedin.com/feed/update/${shareUrn}`;
  }
  // Build from numeric id field
  const id = String(post.id ?? "");
  if (id && /^\d+$/.test(id)) {
    return `https://www.linkedin.com/feed/update/urn:li:activity:${id}`;
  }
  // linkedinUrl might be a post URL (check it's not a profile URL)
  const linkedinUrl = String(post.linkedinUrl ?? "");
  if (linkedinUrl.includes("/posts/") || linkedinUrl.includes("/feed/update/")) {
    return linkedinUrl;
  }
  return "";
}

function extractText(post: Record<string, unknown>): string {
  for (const key of ["content", "text", "postText", "commentary"]) {
    const val = post[key];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return "";
}

function extractCount(post: Record<string, unknown>, countKeys: string[], arrayKeys: string[], nestedPaths: string[][]): number {
  // Try direct numeric fields
  for (const key of countKeys) {
    const val = post[key];
    if (val != null && !isNaN(Number(val))) return Number(val);
  }
  // Try array length
  for (const key of arrayKeys) {
    const val = post[key];
    if (Array.isArray(val)) return val.length;
  }
  // Try nested paths
  for (const path of nestedPaths) {
    const val = getNestedValue(post, path);
    if (val != null && !isNaN(Number(val))) return Number(val);
  }
  return 0;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { profileUrl } = body;

  if (!profileUrl || !profileUrl.includes("linkedin.com")) {
    return NextResponse.json({ error: "Valid LinkedIn profile URL is required" }, { status: 400 });
  }

  const rawPosts = await fetchProfilePosts(profileUrl, 10);

  if (rawPosts.length > 0) {
    const first = rawPosts[0];
    console.log(`[profile-posts] First post sample:`, JSON.stringify({
      keys: Object.keys(first),
      shareUrn: first.shareUrn,
      entityId: first.entityId,
      id: first.id,
      linkedinUrl: first.linkedinUrl,
      contentPreview: String(first.content ?? "").slice(0, 100),
      engagementType: typeof first.engagement,
      engagementKeys: first.engagement && typeof first.engagement === "object" ? Object.keys(first.engagement as object) : null,
      reactionsType: typeof first.reactions,
      reactionsIsArray: Array.isArray(first.reactions),
      reactionsLength: Array.isArray(first.reactions) ? (first.reactions as unknown[]).length : null,
      commentsType: typeof first.comments,
      commentsIsArray: Array.isArray(first.comments),
      commentsLength: Array.isArray(first.comments) ? (first.comments as unknown[]).length : null,
      postedAt: first.postedAt,
    }));
  }

  const posts = rawPosts.map((p, idx) => {
    const url = extractPostUrl(p);
    const text = extractText(p);
    const reactions = extractCount(p,
      ["reactionCount", "numReactions", "totalReactionCount", "num_likes", "likesCount"],
      ["reactions", "reactionIds"],
      [["engagement", "numLikes"], ["engagement", "reactionCount"], ["socialDetail", "reactionCount"], ["socialContent", "numLikes"]]
    );
    const comments = extractCount(p,
      ["commentCount", "numComments", "totalComments", "num_comments", "commentsCount"],
      ["comments", "commentIds"],
      [["engagement", "numComments"], ["engagement", "commentCount"], ["socialDetail", "commentCount"], ["socialContent", "numComments"]]
    );
    const date = String(p.postedAt ?? p.publishedAt ?? p.date ?? p.postedDate ?? "");

    return { id: idx, url, text: text.slice(0, 200) + (text.length > 200 ? "..." : ""), reactions, comments, date };
  }).filter((p) => p.url.length > 0);

  console.log(`[profile-posts] Mapped ${posts.length}/${rawPosts.length} posts with valid URLs`);

  return NextResponse.json({ posts });
}
