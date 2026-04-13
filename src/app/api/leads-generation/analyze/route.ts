import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchProfilePosts } from "@/lib/apify";
import { analyzeProfileForLeads } from "@/lib/ai";
import { logApiCost, API_COSTS } from "@/lib/api-costs";

function extractPostUrl(post: Record<string, unknown>): string {
  for (const key of ["postUrl", "permalink", "shareUrl"]) {
    const val = post[key];
    if (typeof val === "string" && val.includes("linkedin.com")) return val;
  }
  const shareUrn = String(post.shareUrn ?? post.entityId ?? "");
  if (shareUrn.includes("urn:li:")) return `https://www.linkedin.com/feed/update/${shareUrn}`;
  const id = String(post.id ?? "");
  if (id && /^\d+$/.test(id)) return `https://www.linkedin.com/feed/update/urn:li:activity:${id}`;
  const linkedinUrl = String(post.linkedinUrl ?? "");
  if (linkedinUrl.includes("/posts/") || linkedinUrl.includes("/feed/update/")) return linkedinUrl;
  return "";
}

function extractText(post: Record<string, unknown>): string {
  for (const key of ["content", "text", "postText", "commentary"]) {
    const val = post[key];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return "";
}

function extractCount(post: Record<string, unknown>, keys: string[], arrayKeys: string[]): number {
  for (const key of keys) {
    const val = post[key];
    if (val != null && !isNaN(Number(val))) return Number(val);
  }
  for (const key of arrayKeys) {
    const val = post[key];
    if (Array.isArray(val)) return val.length;
  }
  return 0;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { profileUrl } = body;
  if (!profileUrl || !profileUrl.includes("linkedin.com")) {
    return NextResponse.json({ error: "Valid LinkedIn profile URL is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Extract profile name from URL for initial record
  const slugMatch = profileUrl.match(/\/in\/([^/?#]+)/);
  const slug = slugMatch ? slugMatch[1] : "";

  // Create profile record
  const { data: profile, error: profileError } = await service
    .from("lg_profiles")
    .insert({ user_id: user.id, linkedin_url: profileUrl, name: slug })
    .select()
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }

  // Fetch posts via Apify
  const rawPosts = await fetchProfilePosts(profileUrl, 10);
  logApiCost({ userId: user.id, source: "leads", searchId: profile.id, provider: "apify", operation: "fetchProfilePosts", estimatedCost: API_COSTS.apify.fetchProfilePosts, metadata: { postsFound: rawPosts.length } });

  // Extract and save posts
  const posts = rawPosts.map((p) => ({
    profile_id: profile.id,
    post_url: extractPostUrl(p),
    text_content: extractText(p),
    reactions: extractCount(p, ["reactionCount", "numReactions"], ["reactions", "reactionIds"]),
    comments: extractCount(p, ["commentCount", "numComments"], ["comments", "commentIds"]),
    posted_at: String(p.postedAt ?? p.publishedAt ?? p.date ?? ""),
    raw_data: p,
  }));

  if (posts.length > 0) {
    await service.from("lg_posts").insert(posts);
  }

  // Extract author info from first post if available
  const firstPost = rawPosts[0];
  if (firstPost) {
    const author = firstPost.author as Record<string, unknown> | undefined;
    if (author) {
      const name = String(author.name ?? author.firstName ?? slug);
      const headline = String(author.headline ?? author.position ?? "");
      const photo = String(author.profilePicture ?? author.pictureUrl ?? author.profilePhoto ?? "");
      await service.from("lg_profiles").update({ name, headline, profile_photo: photo }).eq("id", profile.id);
      profile.name = name;
      profile.headline = headline;
    }
  }

  // AI analysis
  const postTexts = posts.map((p) => p.text_content).filter(Boolean);
  const aiResult = await analyzeProfileForLeads(
    profile.name ?? slug,
    profile.headline ?? "",
    postTexts,
  );
  logApiCost({ userId: user.id, source: "leads", searchId: profile.id, provider: "openrouter", operation: "analyzeProfileForLeads", estimatedCost: API_COSTS.openrouter.classifyTopics, metadata: { postsAnalyzed: postTexts.length } });

  // Save options
  const options = {
    profile_id: profile.id,
    market_context: aiResult?.market_context ?? "",
    job_titles: aiResult?.job_titles ?? [],
    departments: aiResult?.departments ?? [],
    company_sizes: aiResult?.company_sizes ?? ["51-200"],
    ai_response: aiResult,
  };

  const { data: savedOptions } = await service
    .from("lg_options")
    .insert(options)
    .select()
    .single();

  return NextResponse.json({
    profile,
    posts: posts.map((p) => ({ post_url: p.post_url, text_content: p.text_content?.slice(0, 200), reactions: p.reactions, comments: p.comments, posted_at: p.posted_at })),
    options: savedOptions,
  });
}
