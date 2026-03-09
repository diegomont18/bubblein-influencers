import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { searchGoogle, fetchLinkedInProfile, fetchLinkedInPost } from "@/lib/scrapingdog";
import { parseAbbreviatedNumber, normalizeProfileData, calculatePostingFrequency, calculateEngagementMetrics, getOriginalPostLinks, computeEngagementFromPosts } from "@/lib/normalize";
import { generateSearchSynonyms, checkPublishLanguage } from "@/lib/ai";


interface SearchBody {
  themes: string[];
  language: string;
  country: string;
  domain: string;
  minFollowers: number;
  maxFollowers: number;
  resultsCount: number;
}

function extractLinkedInSlug(url: string): string | null {
  // Try post URL first: linkedin.com/posts/username_...
  const postMatch = url.match(/linkedin\.com\/posts\/([^_/?#]+)/);
  if (postMatch) return postMatch[1];
  // Fallback to profile URL: linkedin.com/in/username
  const profileMatch = url.match(/linkedin\.com\/in\/([^/?#]+)/);
  return profileMatch ? profileMatch[1] : null;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: SearchBody = await request.json();
  const {
    themes,
    language,
    country,
    domain,
    minFollowers,
    maxFollowers,
    resultsCount,
  } = body;

  if (!themes || themes.length === 0) {
    return NextResponse.json(
      { error: "At least one theme is required" },
      { status: 400 }
    );
  }

  const seenSlugs = new Set<string>();
  const candidateSlugs: string[] = [];

  // Scrape profiles and filter — keep fetching SERP pages until resultsCount matched or exhausted
  const matchedProfiles: Array<{
    slug: string;
    name: string;
    headline: string;
    job_title: string;
    company: string;
    location: string;
    followers: number;
    posts_per_month: number;
    avg_likes_per_post: number | null;
    avg_comments_per_post: number | null;
    relevance_score: number;
    linkedin_url: string;
    focus: number;
  }> = [];

  // Track focus score per candidate slug (3=original, 2=synonym, 1=broad)
  const slugFocus = new Map<string, number>();

  // Build all 3 tiers of search queries upfront
  interface ThemePage {
    theme: string;
    page: number;
    exhausted: boolean;
    focus: number;
  }

  // Focus 3: original themes (exact match)
  const themePages: ThemePage[] = themes.map(theme => ({
    theme, page: 0, exhausted: false, focus: 3,
  }));

  // Focus 2: synonym themes (exact match)
  console.log("[casting] Generating synonym queries upfront…");
  for (const theme of themes) {
    const synonyms = await generateSearchSynonyms(theme, language);
    for (const syn of synonyms) {
      themePages.push({ theme: syn, page: 0, exhausted: false, focus: 2 });
    }
  }

  // Focus 1: original themes (broad, no quotes)
  for (const theme of themes) {
    themePages.push({ theme, page: 0, exhausted: false, focus: 1 });
  }

  console.log(`[casting] Total search tiers: ${themePages.length} queries (focus 3: ${themes.length}, focus 2: ${themePages.filter(t => t.focus === 2).length}, focus 1: ${themes.length})`);

  const maxPages = 20;
  let candidateIndex = 0;
  let totalCandidatesProcessed = 0;

  while (matchedProfiles.length < resultsCount) {
    // Process any unprocessed candidates first
    while (candidateIndex < candidateSlugs.length && matchedProfiles.length < resultsCount) {
      const slug = candidateSlugs[candidateIndex++];
      totalCandidatesProcessed++;

      const result = await fetchLinkedInProfile(slug);
      if (result.status !== 200 || !result.data) continue;

      const data = result.data as Record<string, unknown>;
      const followers = parseAbbreviatedNumber(data.followers)
        ?? parseAbbreviatedNumber(data.follower_count)
        ?? parseAbbreviatedNumber(data.followers_count)
        ?? 0;

      console.log(`[casting] Profile ${slug}: followers raw=${JSON.stringify(data.followers ?? data.follower_count ?? data.followers_count)}, parsed=${followers}`);

      if (followers < minFollowers || followers > maxFollowers) continue;

      const normalized = normalizeProfileData(data);
      const activityKeys = Object.keys(data).filter(k => /activit|post|article/i.test(k));
      console.log(`[casting] Profile ${slug}: activity keys=${JSON.stringify(activityKeys)}, raw activities count=${Array.isArray(data.activities) ? (data.activities as unknown[]).length : 0}`);

      const { score: postsPerMonth } = calculatePostingFrequency(data);

      // Try inline engagement first; if null, fetch individual posts
      let engagement = calculateEngagementMetrics(data);
      if (engagement.avgLikes == null && engagement.avgComments == null) {
        const postLinks = getOriginalPostLinks(data, 3);
        if (postLinks.length > 0) {
          console.log(`[casting] Profile ${slug}: Fetching ${postLinks.length} posts for engagement…`);
          const postDataList: Record<string, unknown>[] = [];
          for (let i = 0; i < postLinks.length; i++) {
            if (i > 0) await new Promise((r) => setTimeout(r, 1000));
            const result = await fetchLinkedInPost(postLinks[i]);
            if (result.status === 200 && result.data != null) {
              postDataList.push(result.data as Record<string, unknown>);
            }
          }
          if (postDataList.length > 0) {
            engagement = computeEngagementFromPosts(postDataList);
          }
        }
      }

      console.log(`[casting] Profile ${slug}: posts_per_month=${postsPerMonth}`);

      if (postsPerMonth < 1) {
        console.log(`[casting] Skipping ${slug}: posts_per_month ${postsPerMonth} < 1`);
        continue;
      }

      const publishesInLanguage = await checkPublishLanguage(data, language);
      if (!publishesInLanguage) {
        console.log(`[casting] Skipping ${slug}: does not publish in ${language}`);
        continue;
      }

      matchedProfiles.push({
        slug,
        name: String(data.fullName ?? data.full_name ?? data.name ?? "Unknown"),
        headline: String(data.headline ?? ""),
        job_title: normalized.role_current ?? "",
        company: normalized.company_current ?? "",
        location: String(data.location ?? ""),
        followers,
        posts_per_month: postsPerMonth,
        avg_likes_per_post: engagement.avgLikes,
        avg_comments_per_post: engagement.avgComments,
        relevance_score: 1.0,
        linkedin_url: `https://linkedin.com/in/${slug}`,
        focus: slugFocus.get(slug) ?? 1,
      });
    }

    if (matchedProfiles.length >= resultsCount) break;

    // Need more candidates — fetch next SERP page from any non-exhausted theme
    let fetched = false;
    for (const tp of themePages) {
      if (tp.exhausted || tp.page >= maxPages) continue;

      const query = tp.focus >= 2
        ? `site:linkedin.com/posts "${tp.theme}"`
        : `site:linkedin.com/posts ${tp.theme}`;
      const { results } = await searchGoogle(query, {
        language,
        country,
        domain,
        lr: language,
        page: tp.page,
        results: 50,
      });
      tp.page++;

      if (results.length === 0) {
        tp.exhausted = true;
        continue;
      }

      for (const r of results) {
        const slug = extractLinkedInSlug(r.link);
        if (slug && !seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          candidateSlugs.push(slug);
          slugFocus.set(slug, tp.focus);
        }
      }
      fetched = true;
    }

    if (!fetched) {
      console.log("[casting] All search tiers exhausted");
      break;
    }
  }

  console.log(`[casting] Filter summary: ${totalCandidatesProcessed} candidates processed → ${matchedProfiles.length} matched`);

  // Save to database
  const service = createServiceClient();
  const listName = `Casting: ${themes.slice(0, 3).join(", ")}${themes.length > 3 ? "..." : ""}`;

  const { data: list, error: listError } = await service
    .from("casting_lists")
    .insert({
      name: listName,
      query_theme: themes.join("\n"),
      filters_applied: { minFollowers, maxFollowers, language, country, domain },
      created_by: user.id,
    })
    .select()
    .single();

  if (listError || !list) {
    console.error("[casting] Failed to create list:", listError);
    return NextResponse.json(
      { error: "Failed to save casting list" },
      { status: 500 }
    );
  }

  // Insert matched profiles
  if (matchedProfiles.length > 0) {
    const rows = matchedProfiles.map((p, i) => ({
      list_id: list.id,
      profile_id: p.slug,
      relevance_score: p.relevance_score,
      frequency_score: p.posts_per_month,
      composite_score: null,
      rank_position: i + 1,
      focus: p.focus,
      notes: JSON.stringify({
        name: p.name,
        headline: p.headline,
        job_title: p.job_title,
        company: p.company,
        location: p.location,
        followers: p.followers,
        posts_per_month: p.posts_per_month,
        avg_likes_per_post: p.avg_likes_per_post,
        avg_comments_per_post: p.avg_comments_per_post,
        linkedin_url: p.linkedin_url,
        focus: p.focus,
      }),
      status: "found",
    }));

    const { error: profilesError } = await service
      .from("casting_list_profiles")
      .insert(rows);

    if (profilesError) {
      console.error("[casting] Failed to insert profiles:", profilesError);
    }
  }

  return NextResponse.json({
    listId: list.id,
    profiles: matchedProfiles,
    totalCandidates: totalCandidatesProcessed,
  });
}
