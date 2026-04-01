import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { searchGoogle, fetchLinkedInProfile, extractActivityId } from "../../src/lib/scrapingdog";
import { fetchProfilePosts, fetchProfilePostsBatch, searchLinkedInProfiles, searchLinkedInPosts } from "../../src/lib/apify";
import { parseAbbreviatedNumber, normalizeProfileData, calculatePostingFrequency, calculatePostingFrequencyFromApifyPosts, calculateEngagementMetrics, computeEngagementFromPosts, calculateCreatorScore } from "../../src/lib/normalize";
import { checkPublishLanguage, classifyTopics } from "../../src/lib/ai";

interface SearchParams {
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
  searchMode?: "content" | "title" | "posts";
  minReactions?: number;
  datePosted?: "past-24h" | "past-week" | "past-month" | "past-year";
  existingListId?: string;
  campaignId?: string;
  listId: string;
  userId: string;
  excludeSlugs?: string[];
}

interface MatchedPost {
  post_url: string;
  activity_id: string;
  content_preview: string;
  author_slug: string;
  author_name: string;
  author_headline: string;
  author_linkedin_url: string;
  reactions: number;
  comments: number;
  total_engagement: number;
  engagement_rate: number;
  posted_at: string | null;
  source_keyword: string;
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
  if (!profileLocation) return true;
  const loc = profileLocation.toLowerCase();
  const name = (COUNTRY_NAMES[countryCode] ?? "").toLowerCase();
  if (name && loc.includes(name)) return true;
  const cities = COUNTRY_CITIES[countryCode] ?? [];
  for (const city of cities) {
    if (loc.includes(city)) return true;
  }
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
  return true;
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
  const postMatch = url.match(/linkedin\.com\/posts\/([^_/?#]+)/);
  if (postMatch) {
    try { return decodeURIComponent(postMatch[1]); } catch { return postMatch[1]; }
  }
  const profileMatch = url.match(/linkedin\.com\/in\/([^/?#]+)/);
  if (!profileMatch) return null;
  try { return decodeURIComponent(profileMatch[1]); } catch { return profileMatch[1]; }
}

function getFollowersRange(n: number): string {
  if (n < 500) return "0-500";
  if (n < 1000) return "500-1K";
  if (n < 2500) return "1K-2.5K";
  if (n < 5000) return "2.5K-5K";
  if (n < 10000) return "5K-10K";
  if (n < 25000) return "10K-25K";
  if (n < 50000) return "25K-50K";
  if (n < 100000) return "50K-100K";
  if (n < 250000) return "100K-250K";
  if (n < 500000) return "250K-500K";
  if (n < 1000000) return "500K-1M";
  return "1M+";
}

interface MatchedProfile {
  slug: string;
  name: string;
  headline: string;
  job_title: string;
  company: string;
  location: string;
  followers: number;
  followers_range: string;
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
  profile_photo: string;
  found_at: string;
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const params: SearchParams = JSON.parse(event.body || "{}");
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
    minReactions = 10,
    datePosted,
    existingListId,
    campaignId,
    listId,
    userId,
    excludeSlugs = [],
  } = params;

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const isTitleMode = searchMode === "title";
  const isPostsMode = searchMode === "posts";
  const countryName = COUNTRY_NAMES[country] ?? country;

  const seenSlugs = new Set<string>(excludeSlugs);
  const candidateSlugs: string[] = [];
  const matchedProfiles: MatchedProfile[] = [];
  const slugFocus = new Map<string, number>();

  interface ThemePage {
    theme: string;
    page: number;
    exhausted: boolean;
    focus: number;
    sourceKeyword: string;
  }

  const keywordStats = new Map<string, { googleResults: number; candidates: number; matched: number; filteredJob: number; filteredRepost: number }>();
  for (const theme of themes) {
    keywordStats.set(theme, { googleResults: 0, candidates: 0, matched: 0, filteredJob: 0, filteredRepost: 0 });
  }
  const slugSourceKeyword = new Map<string, string>();

  // Focus 3: original themes (exact match)
  const themePages: ThemePage[] = themes.map(theme => ({
    theme, page: 0, exhausted: false, focus: 3, sourceKeyword: theme,
  }));

  // Focus 2: synonym themes
  if (approvedSynonyms) {
    console.log("[casting] Using pre-approved synonyms...");
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

  let profileCount = 0;

  async function emitProfile(profile: MatchedProfile) {
    if (profileCount >= resultsCount) return;
    matchedProfiles.push(profile);
    profileCount++;

    const row = {
      list_id: listId,
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
        followers_range: profile.followers_range,
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
        profile_photo: profile.profile_photo,
      }),
      status: "found",
    };

    const { error: insertError } = await service.from("casting_list_profiles").insert(row);
    if (insertError) {
      console.error(`[casting] Failed to insert profile ${profile.slug}:`, insertError);
    }
  }

  let totalCandidatesProcessed = 0;

  async function processCandidate(slug: string, preFilteredFollowers?: number): Promise<MatchedProfile | null> {
    totalCandidatesProcessed++;

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

    let engagement = calculateEngagementMetrics(data);
    let apifyPosts: Record<string, unknown>[] = [];
    const needApify = postsPerMonth < 1 || (engagement.avgLikes == null && engagement.avgComments == null);

    if (needApify) {
      const profileUrl = `https://www.linkedin.com/in/${slug}/`;
      console.log(`[casting] Profile ${slug}: Fetching posts via Apify (postsPerMonth=${postsPerMonth}, hasEngagement=${engagement.avgLikes != null || engagement.avgComments != null})...`);
      apifyPosts = await fetchProfilePosts(profileUrl);
      if (apifyPosts.length > 0) {
        if (engagement.avgLikes == null && engagement.avgComments == null) {
          engagement = computeEngagementFromPosts(apifyPosts);
        }
        if (postsPerMonth < 1) {
          const apifyFreq = calculatePostingFrequencyFromApifyPosts(apifyPosts);
          postsPerMonth = apifyFreq.score;
          console.log(`[casting] Profile ${slug}: recalculated postsPerMonth from Apify -> ${postsPerMonth}`);
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

    // Extract and store profile photo
    const rawPhotoUrl = String(
      data.profile_photo ?? data.profilePicture ?? data.profile_pic_url
      ?? data.profile_picture ?? data.photo ?? data.avatar
      ?? data.profile_image_url ?? data.profilePictureUrl ?? ""
    );
    let profilePhoto = "";
    console.log(`[casting] Profile ${slug}: rawPhotoUrl=${rawPhotoUrl ? rawPhotoUrl.slice(0, 80) : "(empty)"}`);
    if (rawPhotoUrl && rawPhotoUrl.startsWith("http")) {
      try {
        const photoRes = await fetch(rawPhotoUrl, { signal: AbortSignal.timeout(10_000) });
        if (photoRes.ok) {
          const photoBuffer = await photoRes.arrayBuffer();
          const ext = rawPhotoUrl.includes(".png") ? "png" : "jpg";
          const filePath = `${slug}.${ext}`;
          const { error: uploadError } = await service.storage
            .from("profile-photos")
            .upload(filePath, photoBuffer, {
              contentType: ext === "png" ? "image/png" : "image/jpeg",
              upsert: true,
            });
          if (uploadError) {
            console.warn(`[casting] Photo upload failed for ${slug}:`, uploadError.message);
          } else {
            const { data: urlData } = service.storage.from("profile-photos").getPublicUrl(filePath);
            profilePhoto = urlData.publicUrl;
            console.log(`[casting] Profile ${slug}: photo uploaded -> ${profilePhoto.slice(0, 80)}`);
          }
        } else {
          console.warn(`[casting] Photo download failed for ${slug}: HTTP ${photoRes.status}`);
        }
      } catch (photoErr) {
        console.warn(`[casting] Photo error for ${slug}:`, String(photoErr));
      }
    }

    return {
      slug,
      name: String(data.fullName ?? data.full_name ?? data.name ?? "Unknown"),
      headline: normalized.headline ?? "",
      job_title: normalized.role_current ?? "",
      company: normalized.company_current ?? "",
      location: String(data.location ?? ""),
      followers,
      followers_range: getFollowersRange(followers),
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
      profile_photo: profilePhoto,
      found_at: new Date().toISOString(),
    };
  }

  async function processTitleCandidate(
    slug: string,
    meta: Map<string, { followers: number; headline: string; fullName: string; location: string }>,
    preApifyPosts: Map<string, Array<Record<string, unknown>>>
  ): Promise<MatchedProfile | null> {
    totalCandidatesProcessed++;

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

    if (followers < minFollowers || followers > maxFollowers) return null;

    const publishesInLanguage = await checkPublishLanguage(data, language);
    if (!publishesInLanguage) {
      console.log(`[casting] Skipping ${slug}: does not publish in ${language}`);
      return null;
    }

    const normalized = normalizeProfileData(data);
    const titleResult = computeTitleMatch(themes, data, normalized);
    if (titleResult.score === 0) {
      console.log(`[casting] Skipping ${slug}: no title match in experience`);
      return null;
    }

    const apifyPosts = preApifyPosts.get(slug) ?? [];
    let engagement = calculateEngagementMetrics(data);
    if (engagement.avgLikes == null && engagement.avgComments == null && apifyPosts.length > 0) {
      engagement = computeEngagementFromPosts(apifyPosts);
    }

    let postsPerMonth = calculatePostingFrequency(data).score;
    if (postsPerMonth < 1 && apifyPosts.length > 0) {
      postsPerMonth = calculatePostingFrequencyFromApifyPosts(apifyPosts).score;
    }
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
      followers_range: getFollowersRange(followers),
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
      profile_photo: "",
      found_at: new Date().toISOString(),
    };
  }

  try {
    const maxPages = 100;
    let candidateIndex = 0;

    const apifyMeta = new Map<string, { followers: number; headline: string; fullName: string; location: string }>();

    // --- Posts mode ---
    if (isPostsMode) {
      const seenActivityIds = new Set<string>();

      if (existingListId) {
        const { data: existing } = await service
          .from("casting_list_profiles")
          .select("profile_id")
          .eq("list_id", existingListId);
        if (existing) existing.forEach((r: { profile_id: string }) => seenActivityIds.add(r.profile_id));
      }

      const fetchMultiplier = 10;
      const maxToFetch = resultsCount * fetchMultiplier;

      const COUNTRY_TO_LANG: Record<string, string> = { br: "pt", us: "en", es: "es", fr: "fr" };
      const contentLanguage = COUNTRY_TO_LANG[country] ?? "pt";
      const LANG_HINT_VARIATIONS: Record<string, string[]> = {
        pt: ["de para com uma", "que nao sobre como", "mais tambem pode seu", "esta muito nosso ainda"],
        es: ["de para con una", "que los mas por", "del esta como sobre", "puede tiene nuestro tambien"],
        fr: ["de pour avec une", "les des que dans", "est nous cette sont", "leur mais aussi cette"],
        en: ["", "the and with for", "this that from your", "been more about would"],
      };
      const hintVariations = LANG_HINT_VARIATIONS[contentLanguage] ?? [""];

      const buildQueries = (variationIdx: number): string[] => {
        const hint = hintVariations[variationIdx % hintVariations.length] ?? "";
        return hint ? themes.map(t => `${t} ${hint}`) : themes;
      };

      const searchQueries = buildQueries(0);

      console.log(`[casting] Posts mode: searching via Apify. queries=${JSON.stringify(searchQueries)}, maxResults=${maxToFetch}, datePosted=${datePosted ?? "any"}, lang=${contentLanguage}, minReactions=${minReactions}`);

      const rawPosts = await searchLinkedInPosts({
        searchQueries,
        maxResults: maxToFetch,
        datePosted: datePosted,
        contentLanguage,
      });

      console.log(`[casting] Apify returned ${rawPosts.length} posts`);

      if (rawPosts.length > 0) {
        const sample = rawPosts[0];
        console.log(`[casting] engagement field:`, JSON.stringify(sample.engagement).slice(0, 500));
        console.log(`[casting] reactions field:`, JSON.stringify(sample.reactions).slice(0, 500));
        console.log(`[casting] socialContent field:`, JSON.stringify(sample.socialContent).slice(0, 500));
        console.log(`[casting] comments field type:`, typeof sample.comments, Array.isArray(sample.comments) ? `(array len=${(sample.comments as unknown[]).length})` : "");
        console.log(`[casting] author field:`, JSON.stringify(sample.author).slice(0, 500));
      }

      const parseApifyPost = (raw: Record<string, unknown>, minReact: number): MatchedPost | null => {
        const postUrl = String(raw.linkedinUrl ?? raw.postUrl ?? raw.url ?? "");
        const actId = String(raw.id ?? "") || extractActivityId(postUrl) || "";
        if (!actId) return null;

        const author = (raw.author && typeof raw.author === "object" ? raw.author : {}) as Record<string, unknown>;
        const authorName = String(author.name ?? "Unknown");
        const authorSlug = String(author.publicIdentifier ?? author.universalName ?? "");
        const authorLinkedinUrl = String(author.linkedinUrl ?? "");

        const eng = (raw.engagement && typeof raw.engagement === "object" ? raw.engagement : {}) as Record<string, unknown>;
        const reactions = Number(eng.numLikes ?? eng.reactionCount ?? eng.likes ?? eng.reactions ?? 0) || 0;
        const commentsCount = Number(eng.numComments ?? eng.commentCount ?? eng.comments ?? 0) || 0;
        const totalEngagement = reactions + commentsCount;

        let engagementRate = Number(eng.engagementRate ?? eng.engagement_rate ?? 0);
        if (!engagementRate && totalEngagement > 0) {
          const followersStr = String(author.info ?? "");
          const followersMatch = followersStr.match(/([\d,.]+)\s*followers/i);
          const followers = followersMatch ? parseFloat(followersMatch[1].replace(/,/g, "")) : 0;
          if (followers > 0) {
            engagementRate = (totalEngagement / followers) * 100;
          }
        }

        if (reactions < minReact) return null;

        const content = String(raw.content ?? "");
        if (JOB_POST_REGEX.test(content)) return null;

        const postedAtObj = (raw.postedAt && typeof raw.postedAt === "object" ? raw.postedAt : {}) as Record<string, unknown>;
        const postedAt = String(postedAtObj.date ?? postedAtObj.timestamp ?? "") || null;

        const sourceKeyword = String(raw.query ?? themes[0] ?? "");

        return {
          post_url: postUrl,
          activity_id: actId,
          content_preview: content.slice(0, 300),
          author_slug: authorSlug,
          author_name: authorName,
          author_headline: "",
          author_linkedin_url: authorLinkedinUrl,
          reactions,
          comments: commentsCount,
          total_engagement: totalEngagement,
          engagement_rate: Math.round(engagementRate * 100) / 100,
          posted_at: postedAt,
          source_keyword: sourceKeyword,
        };
      };

      const matchedPosts: MatchedPost[] = [];

      for (const raw of rawPosts) {
        const post = parseApifyPost(raw, minReactions);
        if (!post) continue;
        if (seenActivityIds.has(post.activity_id)) continue;
        seenActivityIds.add(post.activity_id);
        matchedPosts.push(post);

        const kwStats = keywordStats.get(post.source_keyword);
        if (kwStats) kwStats.matched++;
      }

      matchedPosts.sort((a, b) => b.total_engagement - a.total_engagement || b.engagement_rate - a.engagement_rate);

      const finalPosts = matchedPosts.slice(0, resultsCount);
      const hasMore = matchedPosts.length > resultsCount;

      console.log(`[casting] Posts mode: ${rawPosts.length} fetched -> ${matchedPosts.length} passed filters -> ${finalPosts.length} returned (target ${resultsCount})`);

      const MAX_RETRY_ROUNDS = hintVariations.length - 1;
      let retryRound = 0;
      while (finalPosts.length < resultsCount && retryRound < MAX_RETRY_ROUNDS) {
        retryRound++;
        const retryQueries = buildQueries(retryRound);
        const retryMinReactions = retryRound >= MAX_RETRY_ROUNDS ? Math.max(1, Math.floor(minReactions / 2)) : minReactions;

        console.log(`[casting] Posts mode retry round ${retryRound}/${MAX_RETRY_ROUNDS}: queries=${JSON.stringify(retryQueries)}, minReactions=${retryMinReactions}`);

        const extraPosts = await searchLinkedInPosts({
          searchQueries: retryQueries,
          maxResults: maxToFetch,
          datePosted: datePosted,
          contentLanguage,
        });

        let newFound = 0;
        for (const raw of extraPosts) {
          if (finalPosts.length >= resultsCount) break;

          const post = parseApifyPost(raw, retryMinReactions);
          if (!post) continue;
          if (seenActivityIds.has(post.activity_id)) continue;
          seenActivityIds.add(post.activity_id);
          finalPosts.push(post);
          newFound++;
        }
        console.log(`[casting] Posts mode retry round ${retryRound}: +${newFound} new posts -> ${finalPosts.length} total`);

        if (newFound === 0) break;
      }

      let matchedCount = 0;
      for (const post of finalPosts) {
        matchedCount++;

        const row = {
          list_id: listId,
          profile_id: post.activity_id,
          relevance_score: post.total_engagement,
          frequency_score: null,
          composite_score: null,
          rank_position: matchedCount,
          focus: null,
          notes: JSON.stringify(post),
          status: "found",
        };
        const { error: insertError } = await service.from("casting_list_profiles").insert(row);
        if (insertError) {
          console.error(`[casting] Failed to insert post ${post.activity_id}:`, insertError);
        }
      }

      // Update list status to complete
      await service.from("casting_lists").update({
        status: "complete",
      }).eq("id", listId);

      console.log(`[casting] Posts mode complete. ${matchedCount} posts saved.`);
      return { statusCode: 202, body: "OK" };
    }

    // --- Title mode ---
    if (isTitleMode) {
      let usedApifySearch = false;

      for (const theme of themes) {
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

        for (const profile of apifyResults) {
          const profileUrl = String(profile.linkedinUrl ?? profile.profileUrl ?? profile.url ?? "");
          const slug = extractLinkedInSlug(profileUrl);
          if (!slug || seenSlugs.has(slug)) continue;

          const rawFollowers = parseAbbreviatedNumber(profile.followersCount ?? profile.followers ?? profile.follower_count) ?? 0;
          if (rawFollowers < minFollowers || rawFollowers > maxFollowers) {
            console.log(`[casting] Pre-filter skip ${slug}: followers=${rawFollowers} outside ${minFollowers}-${maxFollowers}`);
            continue;
          }

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

      const slugsAfterPostFilter: string[] = [];
      const slugApifyPosts = new Map<string, Array<Record<string, unknown>>>();

      for (let i = 0; i < candidateSlugs.length; i += 5) {
        const batch = candidateSlugs.slice(i, i + 5);
        const batchUrls = batch.map(s => `https://www.linkedin.com/in/${s}/`);
        const postsMap = await fetchProfilePostsBatch(batchUrls);

        for (const slug of batch) {
          const posts = postsMap.get(slug.toLowerCase()) ?? [];
          const meta = apifyMeta.get(slug);
          const isHighFollower = (meta?.followers ?? 0) >= 5000;

          if (posts.length === 0 && isHighFollower) {
            console.log(`[casting] ${slug}: 0 Apify posts but high followers (${meta?.followers}), passing through`);
            slugsAfterPostFilter.push(slug);
            continue;
          }

          if (posts.length === 0) {
            console.log(`[casting] Frequency filter skip ${slug}: 0 Apify posts`);
            continue;
          }

          const apifyFreq = calculatePostingFrequencyFromApifyPosts(posts);
          if (apifyFreq.score < 1) {
            console.log(`[casting] Frequency filter skip ${slug}: posts_per_month=${apifyFreq.score} < 1`);
            continue;
          }

          slugApifyPosts.set(slug, posts);
          slugsAfterPostFilter.push(slug);
        }
      }

      console.log(`[casting] Cheap filters: ${afterLocationFilter} -> ${slugsAfterPostFilter.length} after frequency+engagement`);

      for (const slug of slugsAfterPostFilter) {
        if (matchedProfiles.length >= resultsCount) break;
        const profile = await processTitleCandidate(slug, apifyMeta, slugApifyPosts);
        if (profile) await emitProfile(profile);
      }

      if (!usedApifySearch) {
        console.warn("[casting] Apify profile search failed for all themes, falling back to SERP for title mode");
      }

      if (usedApifySearch && matchedProfiles.length >= resultsCount) {
        // Skip SERP
      } else if (usedApifySearch && matchedProfiles.length > 0 && candidateIndex >= candidateSlugs.length) {
        console.log(`[casting] Apify yielded ${matchedProfiles.length}/${resultsCount} results, trying SERP for more...`);
      }

      if (usedApifySearch && matchedProfiles.length >= resultsCount) {
        // Jump to summary
      } else {
        // Fall through to SERP loop
      }
    }

    // --- SERP-based candidate discovery ---
    if (!isTitleMode || matchedProfiles.length < resultsCount) {
      while (matchedProfiles.length < resultsCount) {
        // Process any unprocessed candidates first
        while (candidateIndex < candidateSlugs.length && matchedProfiles.length < resultsCount) {
          const slug = candidateSlugs[candidateIndex++];
          const profile = await processCandidate(slug);
          if (profile) await emitProfile(profile);
        }

        if (matchedProfiles.length >= resultsCount) break;

        // Need more candidates
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
                  console.log(`[casting] Filtered job post: ${r.link} -- "${title.slice(0, 80)}"`);
                  if (stats) stats.filteredJob++;
                  continue;
                }
                if (isRepostResult(title, snippet)) {
                  console.log(`[casting] Filtered repost: ${r.link} -- "${title.slice(0, 80)}"`);
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
          break;
        }

        if (!fetched) {
          console.log("[casting] All search tiers exhausted");
          break;
        }
      }

      // Process remaining candidates
      while (candidateIndex < candidateSlugs.length) {
        const slug = candidateSlugs[candidateIndex++];
        const profile = await processCandidate(slug);
        if (profile) await emitProfile(profile);
      }

      // Cover all keywords
      if (coverAllKeywords && matchedProfiles.length < resultsCount) {
        const unsearchedThemes = themePages.filter(tp => tp.focus === 3 && tp.page === 0);
        if (unsearchedThemes.length > 0) {
          console.log(`[casting] Cover-all-keywords: ${unsearchedThemes.length} keyword lines never searched, fetching one SERP page each...`);
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
                  console.log(`[casting] Filtered job post: ${r.link} -- "${title.slice(0, 80)}"`);
                  if (coverStats) coverStats.filteredJob++;
                  continue;
                }
                if (isRepostResult(title, snippet)) {
                  console.log(`[casting] Filtered repost: ${r.link} -- "${title.slice(0, 80)}"`);
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

          while (candidateIndex < candidateSlugs.length && matchedProfiles.length < resultsCount) {
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

    console.log(`[casting] Filter summary: ${totalCandidatesProcessed} candidates processed -> ${matchedProfiles.length} matched`);

    // Deduct credits
    const creditsUsed = matchedProfiles.length;
    if (creditsUsed > 0) {
      const { data: userRole } = await service
        .from("user_roles")
        .select("credits")
        .eq("user_id", userId)
        .single();

      if (userRole && userRole.credits !== -1) {
        const newCredits = Math.max(0, userRole.credits - creditsUsed);
        await service
          .from("user_roles")
          .update({ credits: newCredits })
          .eq("user_id", userId);
        console.log(`[casting] Credits deducted: ${creditsUsed} used, ${userRole.credits} -> ${newCredits}`);
      }
    }

    // Update list status to complete
    await service.from("casting_lists").update({
      status: "complete",
    }).eq("id", listId);

    console.log(`[casting] Search complete. ${matchedProfiles.length}/${resultsCount} results found.`);

  } catch (e) {
    console.error("[casting] Background function error:", e);
    await service.from("casting_lists").update({
      status: "error",
      error_message: String(e),
    }).eq("id", listId);
  }

  return { statusCode: 202, body: "OK" };
};

export { handler };
