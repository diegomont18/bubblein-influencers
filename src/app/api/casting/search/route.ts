import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { searchGoogle, fetchLinkedInProfile } from "@/lib/scrapingdog";
import { parseAbbreviatedNumber, normalizeProfileData, calculatePostingFrequency } from "@/lib/normalize";
import { generateSearchSynonyms } from "@/lib/ai";


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
    relevance_score: number;
    linkedin_url: string;
  }> = [];

  // Track SERP pagination state per theme
  const themePages = themes.map(theme => ({ theme, page: 0, exhausted: false }));
  const maxPages = 20;
  let candidateIndex = 0;
  let totalCandidatesProcessed = 0;
  let synonymsGenerated = false;

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

      console.log(`[casting] Profile ${slug}: posts_per_month=${postsPerMonth}`);

      if (postsPerMonth < 1) {
        console.log(`[casting] Skipping ${slug}: posts_per_month ${postsPerMonth} < 1`);
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
        relevance_score: 1.0,
        linkedin_url: `https://linkedin.com/in/${slug}`,
      });
    }

    if (matchedProfiles.length >= resultsCount) break;

    // Need more candidates — fetch next SERP page from any non-exhausted theme
    let fetched = false;
    for (const tp of themePages) {
      if (tp.exhausted || tp.page >= maxPages) continue;

      const query = `site:linkedin.com/posts "${tp.theme}"`;
      const { results } = await searchGoogle(query, {
        language,
        country,
        domain,
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
        }
      }
      fetched = true;
    }

    if (!fetched) {
      if (!synonymsGenerated) {
        synonymsGenerated = true;
        console.log("[casting] Original themes exhausted, generating synonym queries…");
        for (const theme of themes) {
          const synonyms = await generateSearchSynonyms(theme);
          for (const syn of synonyms) {
            themePages.push({ theme: syn, page: 0, exhausted: false });
          }
        }
        continue; // re-enter loop to search with synonym queries
      }
      break; // synonyms also exhausted
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
      notes: JSON.stringify({
        name: p.name,
        headline: p.headline,
        job_title: p.job_title,
        company: p.company,
        location: p.location,
        followers: p.followers,
        posts_per_month: p.posts_per_month,
        linkedin_url: p.linkedin_url,
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
