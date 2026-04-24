import { fetchProfilePosts, fetchLinkedInProfileApify, searchGoogleApify } from "./apify";
import { logApiCost, API_COSTS } from "./api-costs";

export interface EmpCandidate {
  name: string;
  slug: string;
  headline: string;
  linkedinUrl: string;
  profilePicUrl: string;
}

// Only match executive/leadership roles — exclude junior analysts, engineers, consultants
const TITLE_RE = /director|diretor|head of|head |gerente|manager|vp |vice.?president|chief|ceo|cto|cfo|coo|cmo|founder|fundador|sócio|partner|coordenador|lead\b|líder|executive|executiv|officer|strategy|strategist|innovation|country.?manager|general.?manager/i;

const COUNTRY_LOCATIONS: Record<string, string[]> = {
  br: ["brazil", "brasil"],
  us: ["united states", "usa"],
  pt: ["portugal"],
  es: ["spain", "españa"],
  mx: ["mexico", "méxico"],
  ar: ["argentina"],
  co: ["colombia"],
  cl: ["chile"],
  uk: ["united kingdom", "uk"],
  de: ["germany", "deutschland"],
  fr: ["france"],
  it: ["italy", "italia"],
  in: ["india"],
  ca: ["canada"],
  au: ["australia"],
};

export async function findActiveEmployees(
  companySlug: string,
  companyName: string,
  userId: string,
  profileId: string,
  maxCandidates = 12,
  lite = false,
  country?: string,
): Promise<EmpCandidate[]> {
  const searchName = companyName || companySlug.replace(/-/g, " ");
  console.log(`[find-employees] Searching for ${searchName} (slug: ${companySlug}, max: ${maxCandidates}, lite: ${lite})`);

  // SERP queries — use company NAME (not slug) for better results
  const serpQueries = lite
    ? [`site:linkedin.com/in "${searchName}" CEO OR CTO OR Director OR Head OR VP OR Founder OR manager OR gerente`]
    : [
        `site:linkedin.com/in "${searchName}" CEO OR CTO OR Director OR Diretor OR Head OR VP OR Founder`,
        `site:linkedin.com/in "${companySlug}"`,
        `site:linkedin.com/in "${searchName}" manager OR gerente OR lead OR senior OR architect OR engineer`,
      ];

  const seenSlugs = new Set<string>();
  let candidateSlugs: string[] = [];

  try {
    const serpResults = await Promise.all(
      serpQueries.map((q) => searchGoogleApify(q, { results: 15, country: country || undefined }).catch(() => ({ results: [] })))
    );
    for (const sr of serpResults) {
      for (const r of sr.results) {
        const s = r.link.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? "";
        if (s && s.length > 2 && !seenSlugs.has(s)) {
          seenSlugs.add(s);
          candidateSlugs.push(s);
        }
      }
    }
    if (candidateSlugs.length > maxCandidates) candidateSlugs = candidateSlugs.slice(0, maxCandidates);
    console.log(`[find-employees] ${companyName}: ${candidateSlugs.length} candidates from SERP`);

    for (const q of serpQueries) {
      logApiCost({ userId, source: "leads", searchId: profileId, provider: "apify", operation: "searchGoogleApify", estimatedCost: API_COSTS.apify.searchGoogleApify });
    }
  } catch (err) {
    console.error(`[find-employees] ${companyName}: SERP failed:`, err);
  }

  const employees: EmpCandidate[] = [];
  const targetLower = companyName.toLowerCase();
  const slugLower = companySlug.toLowerCase().replace(/-/g, " ");

  for (let i = 0; i < candidateSlugs.length; i += 5) {
    const batch = candidateSlugs.slice(i, i + 5);
    const results = await Promise.all(batch.map(async (empSlug) => {
      try {
        const profileRes = await fetchLinkedInProfileApify(empSlug);
        if (profileRes.status !== 200 || !profileRes.data) return null;
        const d = profileRes.data as Record<string, unknown>;
        const headline = String(d.headline ?? "");
        const name = String(d.name ?? d.fullName ?? "");

        // Must CURRENTLY work at this company
        let worksHere = false;
        const cp = d.currentPosition;
        if (Array.isArray(cp)) {
          for (const pos of cp as Array<{ companyName?: string }>) {
            const cn = String(pos.companyName ?? "").toLowerCase();
            if (cn && (cn.includes(targetLower) || targetLower.includes(cn) || cn.includes(slugLower) || slugLower.includes(cn))) { worksHere = true; break; }
          }
        }
        if (!worksHere) {
          const exp = d.experience;
          if (Array.isArray(exp) && exp.length > 0) {
            const first = exp[0] as { company?: string; company_name?: string; companyName?: string; end_date?: { text?: string }; ends_at?: { text?: string } };
            const endText = String(first.end_date?.text ?? first.ends_at?.text ?? "").toLowerCase();
            if (endText.includes("present")) {
              const cn = String(first.company ?? first.company_name ?? first.companyName ?? "").toLowerCase();
              if (cn && (cn.includes(targetLower) || targetLower.includes(cn) || cn.includes(slugLower) || slugLower.includes(cn))) worksHere = true;
            }
          }
        }
        if (!worksHere) {
          const compField = String(d.company ?? "").toLowerCase();
          if (compField && (compField.includes(targetLower) || targetLower.includes(compField) || compField.includes(slugLower) || slugLower.includes(compField))) worksHere = true;
        }
        if (!worksHere) {
          console.log(`[find-employees]   skip ${empSlug}: not at "${companyName}"`);
          return null;
        }

        // Location check (if country specified)
        if (country && COUNTRY_LOCATIONS[country]) {
          const rawLoc = d.location ?? d.locationName ?? d.geo ?? "";
          const loc = (typeof rawLoc === "object" && rawLoc !== null
            ? (rawLoc as Record<string, unknown>).full ?? (rawLoc as Record<string, unknown>).country ?? (rawLoc as Record<string, unknown>).countryFullName ?? JSON.stringify(rawLoc)
            : String(rawLoc)
          ).toString().toLowerCase();
          const keywords = COUNTRY_LOCATIONS[country];
          if (loc && !keywords.some((kw) => loc.includes(kw))) {
            console.log(`[find-employees]   skip ${empSlug}: location "${loc.slice(0, 60)}" not in ${country}`);
            return null;
          }
        }

        // Title check
        if (!TITLE_RE.test(headline)) {
          console.log(`[find-employees]   skip ${empSlug}: title not senior`);
          return null;
        }

        // Must have RECENT posts (within last 90 days)
        const empPosts = await fetchProfilePosts(`https://www.linkedin.com/in/${empSlug}/`, 3);
        if (empPosts.length === 0) {
          console.log(`[find-employees]   skip ${empSlug}: no posts`);
          return null;
        }

        // Check if most recent post is within last 90 days
        const now = Date.now();
        const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
        const mostRecentPost = empPosts[0] as Record<string, unknown>;
        const postedAt = mostRecentPost?.postedAt ?? mostRecentPost?.posted_at ?? mostRecentPost?.postedDate ?? "";
        if (postedAt) {
          const postDate = new Date(String(postedAt)).getTime();
          if (!isNaN(postDate) && now - postDate > ninetyDaysMs) {
            console.log(`[find-employees]   skip ${empSlug}: last post too old (${String(postedAt).slice(0, 10)})`);
            return null;
          }
        }

        // Photo
        const picCandidates = [d.profilePicture, d.picture, d.profile_photo, d.profile_pic_url];
        let pic = "";
        for (const c of picCandidates) {
          if (typeof c === "string" && c.startsWith("http")) { pic = c; break; }
        }

        console.log(`[find-employees]   ✓ ${name} — ${headline.slice(0, 50)}`);
        return { name, slug: empSlug, headline, linkedinUrl: `https://www.linkedin.com/in/${empSlug}`, profilePicUrl: pic };
      } catch {
        return null;
      }
    }));
    employees.push(...results.filter((r): r is EmpCandidate => r !== null));
  }

  console.log(`[find-employees] ${companyName}: ${employees.length} active employees found`);
  return employees;
}
