import { fetchProfilePosts, fetchLinkedInProfileApify, searchGoogleApify } from "./apify";
import { logApiCost, API_COSTS } from "./api-costs";

export interface EmpCandidate {
  name: string;
  slug: string;
  headline: string;
  linkedinUrl: string;
  profilePicUrl: string;
  postsPerMonth: number;
}

export interface FindEmployeesResult {
  active: EmpCandidate[];
  inactive: EmpCandidate[];
}

export function extractPostDate(p: Record<string, unknown>): Date | null {
  const candidates = [p.postedAt, p.posted_at, p.postedDate, p.publishedAt, p.date, p.time, p.postedDateTimestamp];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "number") { const d = new Date(c > 1e12 ? c : c * 1000); if (!isNaN(d.getTime())) return d; }
    const d = new Date(String(c));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Estimate posts-per-month from a handful of recent posts by measuring
 * the span between newest and oldest and extrapolating to 30 days.
 * Falls back to `posts.length` when we can't parse enough dates.
 */
export function computePostsPerMonth(posts: Array<Record<string, unknown>>): number {
  if (posts.length === 0) return 0;
  const dates = posts
    .map((p) => extractPostDate(p))
    .filter((d): d is Date => d !== null);
  if (dates.length < 2) return posts.length;
  const newest = Math.max(...dates.map((d) => d.getTime()));
  const oldest = Math.min(...dates.map((d) => d.getTime()));
  const spanDays = (newest - oldest) / (1000 * 60 * 60 * 24);
  return spanDays > 0 ? Math.round((dates.length / spanDays) * 30 * 10) / 10 : dates.length;
}

// Only match executive/leadership roles — exclude junior analysts, engineers, consultants
const TITLE_RE = /director|diretor|head of|head |gerente|manager|vp |vice.?president|chief|ceo|cto|cfo|coo|cmo|founder|fundador|sócio|partner|coordenador|lead\b|líder|executive|executiv|officer|strategy|strategist|innovation|country.?manager|general.?manager/i;

const COUNTRY_LANG: Record<string, string> = {
  br: "pt", pt: "pt", mx: "es", ar: "es", co: "es", cl: "es", es: "es",
};

const LANG_STOPWORDS: Record<string, string[]> = {
  pt: ["de", "que", "para", "com", "não", "uma", "são", "por", "mais", "como", "dos", "das", "nos", "nas", "também", "está", "essa", "esse", "você", "seu", "sua", "nosso", "nossa", "empresa", "sobre", "quando", "muito", "ainda"],
  es: ["que", "para", "con", "por", "más", "como", "los", "las", "una", "del", "sus", "también", "esta", "este", "pero", "son", "han", "puede", "entre", "todos", "empresa", "sobre", "cuando", "muy", "desde"],
};

function isTargetLanguage(text: string, targetLang: string): boolean {
  if (!text || text.length < 30) return true; // too short to detect, let it pass
  const words = text.toLowerCase().split(/\s+/);
  const stopwords = LANG_STOPWORDS[targetLang];
  if (!stopwords) return true; // no stopwords for this language, skip check
  const matches = words.filter((w) => stopwords.includes(w)).length;
  return matches >= 3;
}

const COUNTRY_SERP_LABEL: Record<string, string> = {
  br: "Brazil", us: "United States", pt: "Portugal", es: "Spain",
  mx: "Mexico", ar: "Argentina", co: "Colombia", cl: "Chile",
  uk: "United Kingdom", de: "Germany", fr: "France", it: "Italy",
  in: "India", ca: "Canada", au: "Australia",
};

const COUNTRY_LOCATIONS: Record<string, string[]> = {
  br: ["brazil", "brasil", "são paulo", "sao paulo", "rio de janeiro", "belo horizonte", "curitiba", "porto alegre", "brasília", "brasilia", "recife", "salvador", "florianópolis", "florianopolis", "campinas", "goiânia", "goiania", "fortaleza", ", sp", ", rj", ", mg", ", pr", ", rs", ", sc", ", ba", ", pe", ", df", ", go", ", ce"],
  us: ["united states", "usa", "new york", "san francisco", "los angeles", "chicago", "boston", "seattle", "austin", "denver", "miami", "dallas", "atlanta", ", ca", ", ny", ", tx", ", wa", ", ma", ", il", ", fl", ", co", ", ga"],
  pt: ["portugal", "lisboa", "porto", "braga"],
  es: ["spain", "españa", "madrid", "barcelona", "valencia", "sevilla"],
  mx: ["mexico", "méxico", "ciudad de méxico", "cdmx", "guadalajara", "monterrey"],
  ar: ["argentina", "buenos aires", "córdoba", "rosario"],
  co: ["colombia", "bogotá", "bogota", "medellín", "medellin", "cali"],
  cl: ["chile", "santiago"],
  uk: ["united kingdom", "uk", "london", "manchester", "birmingham", "edinburgh"],
  de: ["germany", "deutschland", "berlin", "munich", "münchen", "hamburg", "frankfurt"],
  fr: ["france", "paris", "lyon", "marseille"],
  it: ["italy", "italia", "milan", "milano", "rome", "roma"],
  in: ["india", "mumbai", "bangalore", "bengaluru", "delhi", "hyderabad", "pune"],
  ca: ["canada", "toronto", "vancouver", "montreal", "montréal", "calgary"],
  au: ["australia", "sydney", "melbourne", "brisbane", "perth"],
};

export async function findActiveEmployees(
  companySlug: string,
  companyName: string,
  userId: string,
  profileId: string,
  maxCandidates = 12,
  lite = false,
  country?: string,
): Promise<FindEmployeesResult> {
  const searchName = companyName || companySlug.replace(/-/g, " ");
  const countryLabel = country ? COUNTRY_SERP_LABEL[country] ?? "" : "";
  console.log(`[find-employees] Searching for ${searchName} (slug: ${companySlug}, max: ${maxCandidates}, lite: ${lite}, country: ${country ?? "none"})`);

  // SERP queries — include country name to prioritize local results for multinationals
  const serpQueries = lite
    ? [`site:linkedin.com/in "${searchName}" ${countryLabel} CEO OR CTO OR Director OR Head OR VP OR Founder OR manager OR gerente`]
    : [
        `site:linkedin.com/in "${searchName}" ${countryLabel} CEO OR CTO OR Director OR Diretor OR Head OR VP OR Founder`,
        `site:linkedin.com/in "${companySlug}" ${countryLabel}`,
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

    serpQueries.forEach(() => {
      logApiCost({ userId, source: "leads", searchId: profileId, provider: "apify", operation: "searchGoogleApify", estimatedCost: API_COSTS.apify.searchGoogleApify });
    });
  } catch (err) {
    console.error(`[find-employees] ${companyName}: SERP failed:`, err);
  }

  const activeEmployees: EmpCandidate[] = [];
  const inactiveEmployees: EmpCandidate[] = [];
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

        // Photo (extract early so inactive candidates also get it)
        const picCandidates = [d.profilePicture, d.picture, d.profile_photo, d.profile_pic_url];
        let pic = "";
        for (const c of picCandidates) {
          if (typeof c === "string" && c.startsWith("http")) { pic = c; break; }
        }

        // Fetch posts to check activity
        const empPosts = await fetchProfilePosts(`https://www.linkedin.com/in/${empSlug}/`, 3);

        if (empPosts.length === 0) {
          console.log(`[find-employees]   inactive ${empSlug}: no posts`);
          return { candidate: { name, slug: empSlug, headline, linkedinUrl: `https://www.linkedin.com/in/${empSlug}`, profilePicUrl: pic, postsPerMonth: 0 }, inactive: true };
        }

        // Check if most recent post is within last 90 days
        const now = Date.now();
        const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
        const recentPostDate = extractPostDate(empPosts[0] as Record<string, unknown>);
        const postsPerMonth = computePostsPerMonth(empPosts as Array<Record<string, unknown>>);

        if (recentPostDate && now - recentPostDate.getTime() > ninetyDaysMs) {
          console.log(`[find-employees]   inactive ${empSlug}: last post ${recentPostDate.toISOString().slice(0, 10)}`);
          return { candidate: { name, slug: empSlug, headline, linkedinUrl: `https://www.linkedin.com/in/${empSlug}`, profilePicUrl: pic, postsPerMonth }, inactive: true };
        }

        // Language check — at least one post must be in target language
        if (country && COUNTRY_LANG[country]) {
          const targetLang = COUNTRY_LANG[country];
          const hasTargetLangPost = empPosts.some((p) => {
            const text = String((p as Record<string, unknown>).text ?? (p as Record<string, unknown>).text_content ?? "");
            return isTargetLanguage(text, targetLang);
          });
          if (!hasTargetLangPost) {
            console.log(`[find-employees]   skip ${empSlug}: no posts in ${targetLang}`);
            return null;
          }
        }

        console.log(`[find-employees]   ✓ ${name} — ${headline.slice(0, 50)} — ${postsPerMonth}/mês`);
        return { candidate: { name, slug: empSlug, headline, linkedinUrl: `https://www.linkedin.com/in/${empSlug}`, profilePicUrl: pic, postsPerMonth }, inactive: false };
      } catch {
        return null;
      }
    }));
    for (const r of results) {
      if (!r) continue;
      if (r.inactive) {
        inactiveEmployees.push(r.candidate);
      } else {
        activeEmployees.push(r.candidate);
      }
    }
  }

  console.log(`[find-employees] ${companyName}: ${activeEmployees.length} active, ${inactiveEmployees.length} inactive employees found`);
  return { active: activeEmployees, inactive: inactiveEmployees };
}
