import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { searchGoogle, fetchLinkedInProfile } from "@/lib/scrapingdog";
import { fetchProfilePosts, fetchProfilePostsBatch, searchLinkedInProfiles } from "@/lib/apify";
import { parseAbbreviatedNumber, normalizeProfileData, calculatePostingFrequency, calculatePostingFrequencyFromApifyPosts, calculateEngagementMetrics, computeEngagementFromPosts, calculateCreatorScore } from "@/lib/normalize";
import { checkPublishLanguage, classifyTopics } from "@/lib/ai";


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
  searchMode?: "content" | "title";
}

function computeTopicMatch(publicoTags: string[], creatorTopics: string[]): { score: number; matched: string[] } {
  if (publicoTags.length === 0) return { score: 0, matched: [] };
  const topicSet = new Set(creatorTopics.map(t => t.toLowerCase()));
  const matched = publicoTags.filter(tag => topicSet.has(tag));
  return { score: Math.round((matched.length / publicoTags.length) * 100), matched };
}

const COUNTRY_NAMES: Record<string, string> = {
  br: "Brazil", us: "United States", es: "Spain", fr: "France",
};

const COUNTRY_CITIES: Record<string, string[]> = {
  br: ["são paulo", "sao paulo", "rio de janeiro", "brasília", "brasilia", "belo horizonte", "curitiba", "porto alegre", "recife", "salvador", "fortaleza", "campinas", "florianópolis", "florianopolis", "brasil"],
  us: ["new york", "san francisco", "los angeles", "chicago", "houston", "phoenix", "seattle", "boston", "austin", "denver", "miami", "atlanta", "dallas"],
  es: ["madrid", "barcelona", "valencia", "sevilla", "seville", "bilbao", "málaga", "malaga", "españa"],
  fr: ["paris", "lyon", "marseille", "toulouse", "nice", "nantes", "strasbourg", "bordeaux"],
};

function matchesTargetCountry(profileLocation: string, countryCode: string): boolean {
  if (!profileLocation) return true; // permissive: no location = pass
  const loc = profileLocation.toLowerCase();
  const name = (COUNTRY_NAMES[countryCode] ?? "").toLowerCase();
  if (name && loc.includes(name)) return true;
  const cities = COUNTRY_CITIES[countryCode] ?? [];
  for (const city of cities) {
    if (loc.includes(city)) return true;
  }
  // If location doesn't match any known pattern, pass through (permissive)
  // Only reject if location clearly matches a DIFFERENT known country
  for (const [code, cName] of Object.entries(COUNTRY_NAMES)) {
    if (code !== countryCode && loc.includes(cName.toLowerCase())) return false;
  }
  for (const [code, cities2] of Object.entries(COUNTRY_CITIES)) {
    if (code !== countryCode) {
      for (const city of cities2) {
        if (loc.includes(city)) return false;
      }
    }
  }
  return true; // unrecognized location = pass
}

function computeTitleMatch(
  searchTitles: string[],
  profileData: Record<string, unknown>,
  normalized: { headline?: string | null; role_current?: string | null }
): { score: number; matched: string[] } {
  const headline = String(profileData.headline ?? normalized.headline ?? "").toLowerCase();
  const currentRole = String(normalized.role_current ?? "").toLowerCase();
  const matched: string[] = [];
  for (const title of searchTitles) {
    const t = title.toLowerCase();
    if (headline.includes(t) || currentRole.includes(t)) matched.push(title);
  }
  if (matched.length === 0) return { score: 0, matched: [] };
  return { score: Math.round((matched.length / searchTitles.length) * 100), matched };
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

interface MatchedProfile {
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
  median_likes_per_post: number | null;
  median_comments_per_post: number | null;
  creator_score: number | null;
  topics: string[];
  topic_match: number;
  matched_publico: string[];
  final_score: number | null;
  relevance_score: number;
  linkedin_url: string;
  focus: number;
  source_keyword: string;
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
    searchMode = "content",
  } = body;

  const isTitleMode = searchMode === "title";
  const countryName = COUNTRY_NAMES[country] ?? country;

  if (!themes || themes.length === 0) {
    return NextResponse.json(
      { error: "At least one theme is required" },
      { status: 400 }
    );
  }

  const seenSlugs = new Set<string>();
  const candidateSlugs: string[] = [];
  const matchedProfiles: MatchedProfile[] = [];

  // Track focus score per candidate slug (3=original, 2=synonym, 1=broad)
  const slugFocus = new Map<string, number>();

  // Build search query tiers
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

  // Focus 2: synonym themes — only when explicitly provided (opt-in)
  if (approvedSynonyms) {
    console.log("[casting] Using pre-approved synonyms…");
    for (const theme of themes) {
      const syns = approvedSynonyms[theme] ?? [];
      for (const syn of syns) {
        themePages.push({ theme: syn, page: 0, exhausted: false, focus: 2, sourceKeyword: theme });
      }
    }
  }

  // Focus 1: original themes (broad, no quotes)
  for (const theme of themes) {
    themePages.push({ theme, page: 0, exhausted: false, focus: 1, sourceKeyword: theme });
  }

  console.log(`[casting] Total search tiers: ${themePages.length} queries (focus 3: ${themes.length}, focus 2: ${themePages.filter(t => t.focus === 2).length}, focus 1: ${themes.length})`);

  // Create casting list in DB at the start so partial results are persisted
  const service = createServiceClient();
  const listName = isTitleMode
    ? `Title: ${themes.slice(0, 3).join(", ")}${themes.length > 3 ? "..." : ""}`
    : `Casting: ${themes.slice(0, 3).join(", ")}${themes.length > 3 ? "..." : ""}`;

  const { data: list, error: listError } = await service
    .from("casting_lists")
    .insert({
      name: listName,
      query_theme: themes.join("\n"),
      filters_applied: { minFollowers, maxFollowers, language, country, domain, publico, searchMode },
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

  // Set up NDJSON streaming response
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  let profileCount = 0;

  async function emitProfile(profile: MatchedProfile) {
    matchedProfiles.push(profile);
    profileCount++;

    // Insert into DB immediately
    const row = {
      list_id: list!.id,
      profile_id: profile.slug,
      relevance_score: profile.relevance_score,
      frequency_score: profile.posts_per_month,
      composite_score: null,
      rank_position: profileCount,
      focus: profile.focus,
      notes: JSON.stringify({
        name: profile.name,
        headline: profile.headline,
        job_title: profile.job_title,
        company: profile.company,
        location: profile.location,
        followers: profile.followers,
        posts_per_month: profile.posts_per_month,
        avg_likes_per_post: profile.avg_likes_per_post,
        avg_comments_per_post: profile.avg_comments_per_post,
        creator_score: profile.creator_score,
        topics: profile.topics,
        topic_match: profile.topic_match,
        matched_publico: profile.matched_publico,
        final_score: profile.final_score,
        linkedin_url: profile.linkedin_url,
        focus: profile.focus,
        source_keyword: profile.source_keyword,
      }),
      status: "found",
    };

    const { error: insertError } = await service.from("casting_list_profiles").insert(row);
    if (insertError) {
      console.error(`[casting] Failed to insert profile ${profile.slug}:`, insertError);
    }

    // Stream to client
    try {
      await writer.write(encoder.encode(JSON.stringify({ type: "profile", data: profile }) + "\n"));
    } catch {
      // Client disconnected — profile is still saved in DB
    }
  }

  // --- processCandidate helper: encapsulates all per-profile logic ---
  let totalCandidatesProcessed = 0;

  async function processCandidate(slug: string, preFilteredFollowers?: number): Promise<MatchedProfile | null> {
    totalCandidatesProcessed++;

    // Throttle between profile fetches to avoid 429s
    if (totalCandidatesProcessed > 1) {
      await new Promise(r => setTimeout(r, 1000));
    }

    const result = await fetchLinkedInProfile(slug);
    if (result.status !== 200 || !result.data) return null;

    const data = result.data as Record<string, unknown>;
    const followers = preFilteredFollowers
      ?? parseAbbreviatedNumber(data.followers)
      ?? parseAbbreviatedNumber(data.follower_count)
      ?? parseAbbreviatedNumber(data.followers_count)
      ?? 0;

    console.log(`[casting] Profile ${slug}: followers raw=${JSON.stringify(data.followers ?? data.follower_count ?? data.followers_count)}, parsed=${followers}`);

    if (followers < minFollowers || followers > maxFollowers) return null;

    const normalized = normalizeProfileData(data);
    const activityKeys = Object.keys(data).filter(k => /activit|post|article/i.test(k));
    console.log(`[casting] Profile ${slug}: activity keys=${JSON.stringify(activityKeys)}, raw activities count=${Array.isArray(data.activities) ? (data.activities as unknown[]).length : 0}`);

    let { score: postsPerMonth } = calculatePostingFrequency(data);

    // Try inline engagement first; if null, fetch posts via Apify
    let engagement = calculateEngagementMetrics(data);
    let apifyPosts: Record<string, unknown>[] = [];
    const needApify = postsPerMonth < 1 || (engagement.avgLikes == null && engagement.avgComments == null);

    if (needApify) {
      const profileUrl = `https://www.linkedin.com/in/${slug}/`;
      console.log(`[casting] Profile ${slug}: Fetching posts via Apify (postsPerMonth=${postsPerMonth}, hasEngagement=${engagement.avgLikes != null || engagement.avgComments != null})…`);
      apifyPosts = await fetchProfilePosts(profileUrl);
      if (apifyPosts.length > 0) {
        if (engagement.avgLikes == null && engagement.avgComments == null) {
          engagement = computeEngagementFromPosts(apifyPosts);
        }
        if (postsPerMonth < 1) {
          const apifyFreq = calculatePostingFrequencyFromApifyPosts(apifyPosts);
          postsPerMonth = apifyFreq.score;
          console.log(`[casting] Profile ${slug}: recalculated postsPerMonth from Apify → ${postsPerMonth}`);
        }
      }
    }

    console.log(`[casting] Profile ${slug}: posts_per_month=${postsPerMonth}`);

    if (postsPerMonth < 1) {
      console.log(`[casting] Skipping ${slug}: posts_per_month ${postsPerMonth} < 1 (both sources confirmed)`);
      return null;
    }

    const publishesInLanguage = await checkPublishLanguage(data, language);
    if (!publishesInLanguage) {
      console.log(`[casting] Skipping ${slug}: does not publish in ${language}`);
      return null;
    }

    const creatorScore = calculateCreatorScore({
      followers_count: followers,
      avg_likes_per_post: engagement.avgLikes,
      avg_comments_per_post: engagement.avgComments,
      posting_frequency_score: postsPerMonth,
    });

    let topics: string[] = [];
    let topicMatch = 0;
    let matchedPublico: string[] = [];
    let finalScore: number | null = creatorScore;

    if (isTitleMode) {
      const titleResult = computeTitleMatch(themes, data, normalized);
      if (titleResult.score === 0) {
        console.log(`[casting] Skipping ${slug}: no title match`);
        return null;
      }
      topicMatch = titleResult.score;
      matchedPublico = titleResult.matched;
      finalScore = creatorScore != null
        ? Math.round((creatorScore * 0.6 + topicMatch * 0.4) * 10) / 10
        : null;
    } else {
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

      const topicResult = computeTopicMatch(publico, topics);
      topicMatch = topicResult.score;
      matchedPublico = topicResult.matched;
      finalScore = creatorScore != null && publico.length > 0
        ? Math.round((creatorScore * 0.7 + topicMatch * 0.3) * 10) / 10
        : creatorScore;
    }

    const srcKw = slugSourceKeyword.get(slug);
    if (srcKw) {
      const kwStats = keywordStats.get(srcKw);
      if (kwStats) kwStats.matched++;
    }

    return {
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
      median_likes_per_post: engagement.medianLikes,
      median_comments_per_post: engagement.medianComments,
      creator_score: creatorScore,
      topics,
      topic_match: topicMatch,
      matched_publico: matchedPublico,
      final_score: finalScore,
      relevance_score: 1.0,
      linkedin_url: `https://linkedin.com/in/${slug}`,
      focus: slugFocus.get(slug) ?? 1,
      source_keyword: slugSourceKeyword.get(slug) ?? "",
    };
  }

  // --- processTitleCandidate: ScrapingDog + AI language + title match, using pre-computed Apify data ---
  async function processTitleCandidate(
    slug: string,
    meta: Map<string, { followers: number; headline: string; fullName: string; location: string }>,
    preApifyPosts: Map<string, Array<Record<string, unknown>>>
  ): Promise<MatchedProfile | null> {
    totalCandidatesProcessed++;

    // Throttle between profile fetches to avoid 429s
    if (totalCandidatesProcessed > 1) {
      await new Promise(r => setTimeout(r, 1000));
    }

    const result = await fetchLinkedInProfile(slug);
    if (result.status !== 200 || !result.data) return null;

    const data = result.data as Record<string, unknown>;
    const metaInfo = meta.get(slug);
    const followers = metaInfo?.followers
      ?? parseAbbreviatedNumber(data.followers)
      ?? parseAbbreviatedNumber(data.follower_count)
      ?? parseAbbreviatedNumber(data.followers_count)
      ?? 0;

    // Re-check followers with ScrapingDog's more accurate count
    if (followers < minFollowers || followers > maxFollowers) return null;

    // AI language check (needs ScrapingDog data for about/experience text)
    const publishesInLanguage = await checkPublishLanguage(data, language);
    if (!publishesInLanguage) {
      console.log(`[casting] Skipping ${slug}: does not publish in ${language}`);
      return null;
    }

    // Title match using ScrapingDog experience data
    const normalized = normalizeProfileData(data);
    const titleResult = computeTitleMatch(themes, data, normalized);
    if (titleResult.score === 0) {
      console.log(`[casting] Skipping ${slug}: no title match in experience`);
      return null;
    }

    // Compute engagement from pre-fetched Apify posts (no redundant fetch)
    const apifyPosts = preApifyPosts.get(slug) ?? [];
    let engagement = calculateEngagementMetrics(data);
    if (engagement.avgLikes == null && engagement.avgComments == null && apifyPosts.length > 0) {
      engagement = computeEngagementFromPosts(apifyPosts);
    }

    let postsPerMonth = calculatePostingFrequency(data).score;
    if (postsPerMonth < 1 && apifyPosts.length > 0) {
      postsPerMonth = calculatePostingFrequencyFromApifyPosts(apifyPosts).score;
    }
    // For high-follower profiles that passed with 0 posts, use ScrapingDog frequency
    if (postsPerMonth < 1) {
      console.log(`[casting] Skipping ${slug}: posts_per_month ${postsPerMonth} < 1`);
      return null;
    }

    const creatorScore = calculateCreatorScore({
      followers_count: followers,
      avg_likes_per_post: engagement.avgLikes,
      avg_comments_per_post: engagement.avgComments,
      posting_frequency_score: postsPerMonth,
    });

    const topicMatch = titleResult.score;
    const matchedPublico = titleResult.matched;
    const finalScore = creatorScore != null
      ? Math.round((creatorScore * 0.6 + topicMatch * 0.4) * 10) / 10
      : null;

    const srcKw = slugSourceKeyword.get(slug);
    if (srcKw) {
      const kwStats = keywordStats.get(srcKw);
      if (kwStats) kwStats.matched++;
    }

    return {
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
      median_likes_per_post: engagement.medianLikes,
      median_comments_per_post: engagement.medianComments,
      creator_score: creatorScore,
      topics: [],
      topic_match: topicMatch,
      matched_publico: matchedPublico,
      final_score: finalScore,
      relevance_score: 1.0,
      linkedin_url: `https://linkedin.com/in/${slug}`,
      focus: slugFocus.get(slug) ?? 1,
      source_keyword: slugSourceKeyword.get(slug) ?? "",
    };
  }

  // Process search in background, streaming results as they're found
  (async () => {
    try {
      const maxPages = 20;
      let candidateIndex = 0;

      // Apify search metadata for title mode cheap-first pipeline
      const apifyMeta = new Map<string, { followers: number; headline: string; fullName: string; location: string }>();

      // --- Title mode: use Apify profile search with SERP fallback ---
      if (isTitleMode) {
        let usedApifySearch = false;

        for (const theme of themes) {
          if (request.signal.aborted) break;

          console.log(`[casting] Title mode: searching Apify for title="${theme}" location="${countryName}"`);
          const apifyResults = await searchLinkedInProfiles({
            title: theme,
            location: countryName,
            maxResults: 100,
          });

          if (apifyResults.length === 0) {
            console.warn(`[casting] Apify profile search returned 0 results for "${theme}", will fall back to SERP`);
            continue;
          }

          usedApifySearch = true;
          const stats = keywordStats.get(theme);
          if (stats) stats.googleResults += apifyResults.length;

          // Pre-filter by followers, headline title match, and location (FREE — no API calls)
          // Store Apify metadata for later use
          for (const profile of apifyResults) {
            const profileUrl = String(profile.linkedinUrl ?? profile.profileUrl ?? profile.url ?? "");
            const slug = extractLinkedInSlug(profileUrl);
            if (!slug || seenSlugs.has(slug)) continue;

            // Pre-filter followers
            const rawFollowers = parseAbbreviatedNumber(profile.followersCount ?? profile.followers ?? profile.follower_count) ?? 0;
            if (rawFollowers < minFollowers || rawFollowers > maxFollowers) {
              console.log(`[casting] Pre-filter skip ${slug}: followers=${rawFollowers} outside ${minFollowers}-${maxFollowers}`);
              continue;
            }

            // Pre-filter headline title match
            const headline = String(profile.headline ?? profile.title ?? "").toLowerCase();
            const fullName = String(profile.fullName ?? profile.name ?? "").toLowerCase();
            const profileLocation = String(profile.location ?? profile.geo ?? "");
            const hasTitle = themes.some(t => {
              const lower = t.toLowerCase();
              return headline.includes(lower) || fullName.includes(lower);
            });
            if (!hasTitle) {
              console.log(`[casting] Pre-filter skip ${slug}: headline "${headline.slice(0, 60)}" doesn't match titles`);
              continue;
            }

            // Pre-filter location (FREE)
            if (!matchesTargetCountry(profileLocation, country)) {
              console.log(`[casting] Pre-filter skip ${slug}: location "${profileLocation}" doesn't match country ${country}`);
              continue;
            }

            seenSlugs.add(slug);
            candidateSlugs.push(slug);
            slugFocus.set(slug, 3);
            slugSourceKeyword.set(slug, theme);
            apifyMeta.set(slug, { followers: rawFollowers, headline, fullName, location: profileLocation });
            if (stats) stats.candidates++;
          }
        }

        const afterLocationFilter = candidateSlugs.length;
        console.log(`[casting] Cheap filters: ${candidateSlugs.length} after followers+headline+location`);

        // Batch fetch Apify posts in groups of 5 (cheap) to filter by frequency+engagement
        const slugsAfterPostFilter: string[] = [];
        const slugApifyPosts = new Map<string, Array<Record<string, unknown>>>();

        for (let i = 0; i < candidateSlugs.length; i += 5) {
          if (request.signal.aborted) break;
          const batch = candidateSlugs.slice(i, i + 5);
          const batchUrls = batch.map(s => `https://www.linkedin.com/in/${s}/`);
          const postsMap = await fetchProfilePostsBatch(batchUrls);

          for (const slug of batch) {
            const posts = postsMap.get(slug.toLowerCase()) ?? [];
            const meta = apifyMeta.get(slug);
            const isHighFollower = (meta?.followers ?? 0) >= 5000;

            if (posts.length === 0 && isHighFollower) {
              // High-follower profiles with no Apify posts pass (may have private feed)
              console.log(`[casting] ${slug}: 0 Apify posts but high followers (${meta?.followers}), passing through`);
              slugsAfterPostFilter.push(slug);
              continue;
            }

            if (posts.length === 0) {
              console.log(`[casting] Frequency filter skip ${slug}: 0 Apify posts`);
              continue;
            }

            // Check posting frequency from Apify posts
            const apifyFreq = calculatePostingFrequencyFromApifyPosts(posts);
            if (apifyFreq.score < 1) {
              console.log(`[casting] Frequency filter skip ${slug}: posts_per_month=${apifyFreq.score} < 1`);
              continue;
            }

            slugApifyPosts.set(slug, posts);
            slugsAfterPostFilter.push(slug);
          }
        }

        console.log(`[casting] Cheap filters: ${afterLocationFilter} → ${slugsAfterPostFilter.length} after frequency+engagement`);

        // Now process survivors with ScrapingDog (expensive)
        for (const slug of slugsAfterPostFilter) {
          if (request.signal.aborted) break;
          if (matchedProfiles.length >= resultsCount) break;
          const profile = await processTitleCandidate(slug, apifyMeta, slugApifyPosts);
          if (profile) await emitProfile(profile);
        }

        // Fallback: if Apify search returned nothing, use SERP approach
        if (!usedApifySearch) {
          console.warn("[casting] Apify profile search failed for all themes, falling back to SERP for title mode");
          // Reset candidate index — SERP will add new candidates below
          // Fall through to the SERP-based loop below
        }

        // If we have enough results from Apify, skip SERP
        if (usedApifySearch && matchedProfiles.length >= resultsCount) {
          // Skip to summary
        } else if (usedApifySearch && matchedProfiles.length > 0 && candidateIndex >= candidateSlugs.length) {
          // Apify gave some results but not enough — we can still try SERP for more
          console.log(`[casting] Apify yielded ${matchedProfiles.length}/${resultsCount} results, trying SERP for more…`);
        }

        // If Apify search was used and we have enough, skip the SERP loop
        if (usedApifySearch && matchedProfiles.length >= resultsCount) {
          // Jump to summary below
        } else {
          // SERP-based discovery (fallback for title mode, primary for content mode)
          // falls through to the shared SERP loop below
        }
      }

      // --- SERP-based candidate discovery (content mode always, title mode as fallback) ---
      if (!isTitleMode || matchedProfiles.length < resultsCount) {
        while (matchedProfiles.length < resultsCount) {
          if (request.signal.aborted) {
            console.log("[casting] Client aborted, stopping search");
            break;
          }

          // Process any unprocessed candidates first
          while (candidateIndex < candidateSlugs.length && matchedProfiles.length < resultsCount) {
            if (request.signal.aborted) break;
            const slug = candidateSlugs[candidateIndex++];
            const profile = await processCandidate(slug);
            if (profile) await emitProfile(profile);
          }

          if (matchedProfiles.length >= resultsCount) break;
          if (request.signal.aborted) break;

          // Need more candidates — fetch from highest active tier first (3 → 2 → 1)
          let fetched = false;
          const tiers = [3, 2, 1];
          for (const focusLevel of tiers) {
            const tierThemes = themePages.filter(tp => tp.focus === focusLevel && !tp.exhausted && tp.page < maxPages);
            if (tierThemes.length === 0) continue;

            const minPage = Math.min(...tierThemes.map(t => t.page));
            const toFetch = tierThemes.filter(t => t.page === minPage);

            for (const tp of toFetch) {
              let query: string;
              if (isTitleMode) {
                if (tp.focus === 3) {
                  query = `site:linkedin.com/in ${tp.theme}`;
                } else if (tp.focus === 2) {
                  query = `site:linkedin.com/in "${tp.theme}" "${countryName}"`;
                } else {
                  query = `site:linkedin.com/in ${tp.theme.replace(/"/g, "")} ${countryName}`;
                }
              } else {
                if (tp.focus === 2) {
                  query = `site:linkedin.com/posts "${tp.theme}"`;
                } else if (tp.focus === 3) {
                  query = `site:linkedin.com/posts ${tp.theme}`;
                } else {
                  query = `site:linkedin.com/posts ${tp.theme.replace(/"/g, "")}`;
                }
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

                if (!isTitleMode) {
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

        // Process remaining candidates from already-fetched SERPs
        while (candidateIndex < candidateSlugs.length) {
          if (request.signal.aborted) break;
          const slug = candidateSlugs[candidateIndex++];
          const profile = await processCandidate(slug);
          if (profile) await emitProfile(profile);
        }

        // Cover all keywords: second pass for any focus-3 ThemePages never searched
        if (coverAllKeywords && !request.signal.aborted) {
          const unsearchedThemes = themePages.filter(tp => tp.focus === 3 && tp.page === 0);
          if (unsearchedThemes.length > 0) {
            console.log(`[casting] Cover-all-keywords: ${unsearchedThemes.length} keyword lines never searched, fetching one SERP page each…`);
            for (const tp of unsearchedThemes) {
              const query = isTitleMode
                ? `site:linkedin.com/in ${tp.theme}`
                : `site:linkedin.com/posts ${tp.theme}`;
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

                if (!isTitleMode) {
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

            // Process any new candidates from the cover-all pass
            while (candidateIndex < candidateSlugs.length) {
              if (request.signal.aborted) break;
              const slug = candidateSlugs[candidateIndex++];
              const profile = await processCandidate(slug);
              if (profile) await emitProfile(profile);
            }
          }
        }
      }

      // Log per-keyword breakdown
      keywordStats.forEach((stats, keyword) => {
        console.log(`[casting] Keyword "${keyword}": ${stats.googleResults} google results, ${stats.candidates} candidates, ${stats.matched} matched, ${stats.filteredJob} job posts filtered, ${stats.filteredRepost} reposts filtered`);
      });

      console.log(`[casting] Filter summary: ${totalCandidatesProcessed} candidates processed → ${matchedProfiles.length} matched`);

      // Send done event with summary
      try {
        await writer.write(encoder.encode(JSON.stringify({
          type: "done",
          data: {
            listId: list!.id,
            totalCandidates: totalCandidatesProcessed,
            keywordStats: Object.fromEntries(keywordStats),
          },
        }) + "\n"));
      } catch {
        // Client already disconnected
      }
    } catch (e) {
      console.error("[casting] Stream processing error:", e);
      try {
        await writer.write(encoder.encode(JSON.stringify({
          type: "error",
          data: { message: String(e) },
        }) + "\n"));
      } catch {
        // Client disconnected
      }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
