import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { searchGoogle, fetchLinkedInProfile } from "@/lib/scrapingdog";
import { fetchProfilePosts } from "@/lib/apify";
import { parseAbbreviatedNumber, normalizeProfileData, calculatePostingFrequency, calculateEngagementMetrics, computeEngagementFromPosts, calculateCreatorScore } from "@/lib/normalize";
import { generateSearchSynonyms, checkPublishLanguage, classifyTopics } from "@/lib/ai";


interface SearchBody {
  themes: string[];
  language: string;
  country: string;
  domain: string;
  minFollowers: number;
  maxFollowers: number;
  resultsCount: number;
  approvedSynonyms?: Record<string, string[]>;
  coverAllKeywords?: boolean;
  publico?: string[];
}

function computeTopicMatch(publicoTags: string[], creatorTopics: string[]): { score: number; matched: string[] } {
  if (publicoTags.length === 0) return { score: 0, matched: [] };
  const topicSet = new Set(creatorTopics.map(t => t.toLowerCase()));
  const matched = publicoTags.filter(tag => topicSet.has(tag));
  return { score: Math.round((matched.length / publicoTags.length) * 100), matched };
}

const JOB_POST_REGEX = /\b(vagas?|contratando|hiring|we.re hiring|estamos contratando|oportunidade de emprego|job opening|open position|open role|vem ser|venha fazer parte)\b/i;

const REPOST_REGEX = /\b(reposted this|repostou|compartilhou isso|compartilhou isto|shared this)\b/i;

function isJobPostResult(title: string, snippet: string): boolean {
  return JOB_POST_REGEX.test(title) || JOB_POST_REGEX.test(snippet);
}

function isRepostResult(title: string, snippet: string): boolean {
  return REPOST_REGEX.test(title) || REPOST_REGEX.test(snippet);
}

function extractLinkedInSlug(url: string): string | null {
  // Try post URL first: linkedin.com/posts/username_...
  const postMatch = url.match(/linkedin\.com\/posts\/([^_/?#]+)/);
  if (postMatch) {
    try { return decodeURIComponent(postMatch[1]); } catch { return postMatch[1]; }
  }
  // Fallback to profile URL: linkedin.com/in/username
  const profileMatch = url.match(/linkedin\.com\/in\/([^/?#]+)/);
  if (!profileMatch) return null;
  try { return decodeURIComponent(profileMatch[1]); } catch { return profileMatch[1]; }
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
    approvedSynonyms,
    coverAllKeywords = true,
    publico = [],
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
    creator_score: number | null;
    topics: string[];
    topic_match: number;
    matched_publico: string[];
    final_score: number | null;
    relevance_score: number;
    linkedin_url: string;
    focus: number;
    source_keyword: string;
  }> = [];

  // Track focus score per candidate slug (3=original, 2=synonym, 1=broad)
  const slugFocus = new Map<string, number>();

  // Build all 3 tiers of search queries upfront
  interface ThemePage {
    theme: string;
    page: number;
    exhausted: boolean;
    focus: number;
    sourceKeyword: string;
  }

  // Per-keyword stats tracking
  const keywordStats = new Map<string, { googleResults: number; candidates: number; matched: number; filteredJob: number; filteredRepost: number }>();
  for (const theme of themes) {
    keywordStats.set(theme, { googleResults: 0, candidates: 0, matched: 0, filteredJob: 0, filteredRepost: 0 });
  }
  const slugSourceKeyword = new Map<string, string>();

  // Focus 3: original themes (exact match)
  const themePages: ThemePage[] = themes.map(theme => ({
    theme, page: 0, exhausted: false, focus: 3, sourceKeyword: theme,
  }));

  // Focus 2: synonym themes (exact match)
  if (approvedSynonyms) {
    console.log("[casting] Using pre-approved synonyms…");
    for (const theme of themes) {
      const syns = approvedSynonyms[theme] ?? [];
      for (const syn of syns) {
        themePages.push({ theme: syn, page: 0, exhausted: false, focus: 2, sourceKeyword: theme });
      }
    }
  } else {
    console.log("[casting] Generating synonym queries upfront…");
    for (const theme of themes) {
      const synonyms = await generateSearchSynonyms(theme, language);
      for (const syn of synonyms) {
        themePages.push({ theme: syn, page: 0, exhausted: false, focus: 2, sourceKeyword: theme });
      }
    }
  }

  // Focus 1: original themes (broad, no quotes)
  for (const theme of themes) {
    themePages.push({ theme, page: 0, exhausted: false, focus: 1, sourceKeyword: theme });
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

      // Throttle between profile fetches to avoid 429s
      if (totalCandidatesProcessed > 1) {
        await new Promise(r => setTimeout(r, 1000));
      }

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

      // Try inline engagement first; if null, fetch posts via Apify
      let engagement = calculateEngagementMetrics(data);
      let apifyPosts: Record<string, unknown>[] = [];
      if (engagement.avgLikes == null && engagement.avgComments == null) {
        const profileUrl = `https://www.linkedin.com/in/${slug}/`;
        console.log(`[casting] Profile ${slug}: Fetching posts via Apify…`);
        apifyPosts = await fetchProfilePosts(profileUrl);
        if (apifyPosts.length > 0) {
          engagement = computeEngagementFromPosts(apifyPosts);
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

      const creatorScore = calculateCreatorScore({
        followers_count: followers,
        avg_likes_per_post: engagement.avgLikes,
        avg_comments_per_post: engagement.avgComments,
        posting_frequency_score: postsPerMonth,
      });

      // Extract topics from posts + profile data
      let topics: string[] = [];
      try {
        if (apifyPosts.length > 0) {
          const postContent = apifyPosts.map(p => String((p as Record<string, unknown>).content ?? "")).filter(Boolean).join("\n\n");
          topics = await classifyTopics(
            String(data.headline ?? normalized.headline ?? ""),
            postContent,
            []
          );
        }
        if (topics.length === 0) {
          topics = await classifyTopics(
            String(data.headline ?? normalized.headline ?? ""),
            String(data.about ?? data.summary ?? ""),
            []
          );
        }
      } catch (e) {
        console.warn(`[casting] Topic extraction failed for ${slug}:`, e);
      }

      const { score: topicMatch, matched: matchedPublico } = computeTopicMatch(publico, topics);
      const finalScore = creatorScore != null && publico.length > 0
        ? Math.round((creatorScore * 0.7 + topicMatch * 0.3) * 10) / 10
        : creatorScore;

      const srcKw = slugSourceKeyword.get(slug);
      if (srcKw) {
        const kwStats = keywordStats.get(srcKw);
        if (kwStats) kwStats.matched++;
      }

      matchedProfiles.push({
        slug,
        name: String(data.fullName ?? data.full_name ?? data.name ?? "Unknown"),
        headline: normalized.headline ?? "",
        job_title: normalized.role_current ?? "",
        company: normalized.company_current ?? "",
        location: String(data.location ?? ""),
        followers,
        posts_per_month: postsPerMonth,
        avg_likes_per_post: engagement.avgLikes,
        avg_comments_per_post: engagement.avgComments,
        creator_score: creatorScore,
        topics,
        topic_match: topicMatch,
        matched_publico: matchedPublico,
        final_score: finalScore,
        relevance_score: 1.0,
        linkedin_url: `https://linkedin.com/in/${slug}`,
        focus: slugFocus.get(slug) ?? 1,
        source_keyword: slugSourceKeyword.get(slug) ?? "",
      });
    }

    if (matchedProfiles.length >= resultsCount) break;

    // Need more candidates — fetch from highest active tier first (3 → 2 → 1)
    // Fetch one page from ALL themes at the same page level to guarantee all keywords are searched
    let fetched = false;
    const tiers = [3, 2, 1];
    for (const focusLevel of tiers) {
      const tierThemes = themePages.filter(tp => tp.focus === focusLevel && !tp.exhausted && tp.page < maxPages);
      if (tierThemes.length === 0) continue;

      // Fetch one page from ALL themes at the lowest page level (ensures all keywords are searched)
      const minPage = Math.min(...tierThemes.map(t => t.page));
      const toFetch = tierThemes.filter(t => t.page === minPage);

      for (const tp of toFetch) {
        let query: string;
        if (tp.focus === 2) {
          // AI-generated synonyms — wrap in quotes
          query = `site:linkedin.com/posts "${tp.theme}"`;
        } else if (tp.focus === 3) {
          // User's original themes — pass as-is (user controls their own quoting)
          query = `site:linkedin.com/posts ${tp.theme}`;
        } else {
          // Broad search — strip any quotes
          query = `site:linkedin.com/posts ${tp.theme.replace(/"/g, "")}`;
        }
        const { results } = await searchGoogle(query, {
          language,
          country,
          domain,
          lr: language,
          page: tp.page,
          results: 50,
        });
        tp.page++;

        const stats = keywordStats.get(tp.sourceKeyword);
        if (stats) stats.googleResults += results.length;

        if (results.length === 0) {
          tp.exhausted = true;
          continue;
        }

        for (const r of results) {
          const title = r.title ?? "";
          const snippet = r.snippet ?? "";

          if (isJobPostResult(title, snippet)) {
            console.log(`[casting] Filtered job post: ${r.link} — "${title.slice(0, 80)}"`);
            if (stats) stats.filteredJob++;
            continue;
          }
          if (isRepostResult(title, snippet)) {
            console.log(`[casting] Filtered repost: ${r.link} — "${title.slice(0, 80)}"`);
            if (stats) stats.filteredRepost++;
            continue;
          }

          const slug = extractLinkedInSlug(r.link);
          if (slug && !seenSlugs.has(slug)) {
            seenSlugs.add(slug);
            candidateSlugs.push(slug);
            slugFocus.set(slug, tp.focus);
            slugSourceKeyword.set(slug, tp.sourceKeyword);
            if (stats) stats.candidates++;
          }
        }
      }
      fetched = toFetch.some(tp => !tp.exhausted);
      break; // Process candidates before fetching more SERPs
    }

    if (!fetched) {
      console.log("[casting] All search tiers exhausted");
      break;
    }
  }

  // Process remaining candidates from already-fetched SERPs to ensure all keywords are represented
  while (candidateIndex < candidateSlugs.length) {
    const slug = candidateSlugs[candidateIndex++];
    totalCandidatesProcessed++;

    if (totalCandidatesProcessed > 1) {
      await new Promise(r => setTimeout(r, 1000));
    }

    const result = await fetchLinkedInProfile(slug);
    if (result.status !== 200 || !result.data) continue;

    const data = result.data as Record<string, unknown>;
    const followers = parseAbbreviatedNumber(data.followers)
      ?? parseAbbreviatedNumber(data.follower_count)
      ?? parseAbbreviatedNumber(data.followers_count)
      ?? 0;

    if (followers < minFollowers || followers > maxFollowers) continue;

    const normalized = normalizeProfileData(data);
    const { score: postsPerMonth } = calculatePostingFrequency(data);

    let engagement = calculateEngagementMetrics(data);
    let remainingPosts: Record<string, unknown>[] = [];
    if (engagement.avgLikes == null && engagement.avgComments == null) {
      const profileUrl = `https://www.linkedin.com/in/${slug}/`;
      console.log(`[casting] Remaining candidate ${slug}: Fetching posts via Apify…`);
      remainingPosts = await fetchProfilePosts(profileUrl);
      if (remainingPosts.length > 0) {
        engagement = computeEngagementFromPosts(remainingPosts);
      }
    }

    if (postsPerMonth < 1) continue;

    const publishesInLanguage = await checkPublishLanguage(data, language);
    if (!publishesInLanguage) continue;

    const creatorScore = calculateCreatorScore({
      followers_count: followers,
      avg_likes_per_post: engagement.avgLikes,
      avg_comments_per_post: engagement.avgComments,
      posting_frequency_score: postsPerMonth,
    });

    let topics: string[] = [];
    try {
      if (remainingPosts.length > 0) {
        const postContent = remainingPosts.map(p => String((p as Record<string, unknown>).content ?? "")).filter(Boolean).join("\n\n");
        topics = await classifyTopics(
          String(data.headline ?? normalized.headline ?? ""),
          postContent,
          []
        );
      }
      if (topics.length === 0) {
        topics = await classifyTopics(
          String(data.headline ?? normalized.headline ?? ""),
          String(data.about ?? data.summary ?? ""),
          []
        );
      }
    } catch (e) {
      console.warn(`[casting] Topic extraction failed for ${slug}:`, e);
    }

    const { score: topicMatch, matched: matchedPublico } = computeTopicMatch(publico, topics);
    const finalScore = creatorScore != null && publico.length > 0
      ? Math.round((creatorScore * 0.7 + topicMatch * 0.3) * 10) / 10
      : creatorScore;

    const srcKw2 = slugSourceKeyword.get(slug);
    if (srcKw2) {
      const kwStats = keywordStats.get(srcKw2);
      if (kwStats) kwStats.matched++;
    }

    matchedProfiles.push({
      slug,
      name: String(data.fullName ?? data.full_name ?? data.name ?? "Unknown"),
      headline: normalized.headline ?? "",
      job_title: normalized.role_current ?? "",
      company: normalized.company_current ?? "",
      location: String(data.location ?? ""),
      followers,
      posts_per_month: postsPerMonth,
      avg_likes_per_post: engagement.avgLikes,
      avg_comments_per_post: engagement.avgComments,
      creator_score: creatorScore,
      topics,
      topic_match: topicMatch,
      matched_publico: matchedPublico,
      final_score: finalScore,
      relevance_score: 1.0,
      linkedin_url: `https://linkedin.com/in/${slug}`,
      focus: slugFocus.get(slug) ?? 1,
      source_keyword: slugSourceKeyword.get(slug) ?? "",
    });
  }

  // Cover all keywords: second pass for any focus-3 ThemePages never searched
  if (coverAllKeywords) {
    const unsearchedThemes = themePages.filter(tp => tp.focus === 3 && tp.page === 0);
    if (unsearchedThemes.length > 0) {
      console.log(`[casting] Cover-all-keywords: ${unsearchedThemes.length} keyword lines never searched, fetching one SERP page each…`);
      for (const tp of unsearchedThemes) {
        // User's original themes — pass as-is (user controls their own quoting)
        const query = `site:linkedin.com/posts ${tp.theme}`;
        const { results } = await searchGoogle(query, {
          language,
          country,
          domain,
          lr: language,
          page: 0,
          results: 50,
        });
        tp.page++;

        const coverStats = keywordStats.get(tp.sourceKeyword);
        if (coverStats) coverStats.googleResults += results.length;

        if (results.length === 0) {
          tp.exhausted = true;
          continue;
        }

        for (const r of results) {
          const title = r.title ?? "";
          const snippet = r.snippet ?? "";

          if (isJobPostResult(title, snippet)) {
            console.log(`[casting] Filtered job post: ${r.link} — "${title.slice(0, 80)}"`);
            if (coverStats) coverStats.filteredJob++;
            continue;
          }
          if (isRepostResult(title, snippet)) {
            console.log(`[casting] Filtered repost: ${r.link} — "${title.slice(0, 80)}"`);
            if (coverStats) coverStats.filteredRepost++;
            continue;
          }

          const slug = extractLinkedInSlug(r.link);
          if (slug && !seenSlugs.has(slug)) {
            seenSlugs.add(slug);
            candidateSlugs.push(slug);
            slugFocus.set(slug, tp.focus);
            slugSourceKeyword.set(slug, tp.sourceKeyword);
            if (coverStats) coverStats.candidates++;
          }
        }
      }

      // Process any new candidates from the cover-all pass (no resultsCount cap)
      while (candidateIndex < candidateSlugs.length) {
        const slug = candidateSlugs[candidateIndex++];
        totalCandidatesProcessed++;

        // Throttle between profile fetches to avoid 429s
        if (totalCandidatesProcessed > 1) {
          await new Promise(r => setTimeout(r, 1000));
        }

        const result = await fetchLinkedInProfile(slug);
        if (result.status !== 200 || !result.data) continue;

        const data = result.data as Record<string, unknown>;
        const followers = parseAbbreviatedNumber(data.followers)
          ?? parseAbbreviatedNumber(data.follower_count)
          ?? parseAbbreviatedNumber(data.followers_count)
          ?? 0;

        if (followers < minFollowers || followers > maxFollowers) continue;

        const normalized = normalizeProfileData(data);
        const { score: postsPerMonth } = calculatePostingFrequency(data);

        let engagement = calculateEngagementMetrics(data);
        let coverPosts: Record<string, unknown>[] = [];
        if (engagement.avgLikes == null && engagement.avgComments == null) {
          const profileUrl = `https://www.linkedin.com/in/${slug}/`;
          console.log(`[casting] Cover-all profile ${slug}: Fetching posts via Apify…`);
          coverPosts = await fetchProfilePosts(profileUrl);
          if (coverPosts.length > 0) {
            engagement = computeEngagementFromPosts(coverPosts);
          }
        }

        if (postsPerMonth < 1) continue;

        const publishesInLanguage = await checkPublishLanguage(data, language);
        if (!publishesInLanguage) continue;

        const creatorScore = calculateCreatorScore({
          followers_count: followers,
          avg_likes_per_post: engagement.avgLikes,
          avg_comments_per_post: engagement.avgComments,
          posting_frequency_score: postsPerMonth,
        });

        // Extract topics from posts + profile data
        let topics: string[] = [];
        try {
          if (coverPosts.length > 0) {
            const postContent = coverPosts.map(p => String((p as Record<string, unknown>).content ?? "")).filter(Boolean).join("\n\n");
            topics = await classifyTopics(
              String(data.headline ?? normalized.headline ?? ""),
              postContent,
              []
            );
          }
          if (topics.length === 0) {
            topics = await classifyTopics(
              String(data.headline ?? normalized.headline ?? ""),
              String(data.about ?? data.summary ?? ""),
              []
            );
          }
        } catch (e) {
          console.warn(`[casting] Topic extraction failed for ${slug}:`, e);
        }

        const { score: topicMatch, matched: matchedPublico } = computeTopicMatch(publico, topics);
        const finalScore = creatorScore != null && publico.length > 0
          ? Math.round((creatorScore * 0.7 + topicMatch * 0.3) * 10) / 10
          : creatorScore;

        const srcKw3 = slugSourceKeyword.get(slug);
        if (srcKw3) {
          const kwStats = keywordStats.get(srcKw3);
          if (kwStats) kwStats.matched++;
        }

        matchedProfiles.push({
          slug,
          name: String(data.fullName ?? data.full_name ?? data.name ?? "Unknown"),
          headline: normalized.headline ?? "",
          job_title: normalized.role_current ?? "",
          company: normalized.company_current ?? "",
          location: String(data.location ?? ""),
          followers,
          posts_per_month: postsPerMonth,
          avg_likes_per_post: engagement.avgLikes,
          avg_comments_per_post: engagement.avgComments,
          creator_score: creatorScore,
          topics,
          topic_match: topicMatch,
          matched_publico: matchedPublico,
          final_score: finalScore,
          relevance_score: 1.0,
          linkedin_url: `https://linkedin.com/in/${slug}`,
          focus: slugFocus.get(slug) ?? 1,
          source_keyword: slugSourceKeyword.get(slug) ?? "",
        });
      }
    }
  }

  // Log per-keyword breakdown
  keywordStats.forEach((stats, keyword) => {
    console.log(`[casting] Keyword "${keyword}": ${stats.googleResults} google results, ${stats.candidates} candidates, ${stats.matched} matched, ${stats.filteredJob} job posts filtered, ${stats.filteredRepost} reposts filtered`);
  });

  console.log(`[casting] Filter summary: ${totalCandidatesProcessed} candidates processed → ${matchedProfiles.length} matched`);

  // Sort by final_score descending when publico is provided
  if (publico.length > 0) {
    matchedProfiles.sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0));
  }

  // Save to database
  const service = createServiceClient();
  const listName = `Casting: ${themes.slice(0, 3).join(", ")}${themes.length > 3 ? "..." : ""}`;

  const { data: list, error: listError } = await service
    .from("casting_lists")
    .insert({
      name: listName,
      query_theme: themes.join("\n"),
      filters_applied: { minFollowers, maxFollowers, language, country, domain, publico },
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
        creator_score: p.creator_score,
        topics: p.topics,
        topic_match: p.topic_match,
        matched_publico: p.matched_publico,
        final_score: p.final_score,
        linkedin_url: p.linkedin_url,
        focus: p.focus,
        source_keyword: p.source_keyword,
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
    keywordStats: Object.fromEntries(keywordStats),
  });
}
