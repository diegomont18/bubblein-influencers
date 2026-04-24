export async function classifyTopics(
  headline: string | null,
  about: string | null,
  roles: string[]
): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ai] OPENROUTER_API_KEY is not set — skipping topic classification");
    return [];
  }

  const text = [headline, about, ...roles].filter(Boolean).join("\n");
  if (!text.trim()) return [];

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You classify LinkedIn influencers into topics. Return ONLY a JSON array of 3-5 lowercase topic strings. Example: [\"ai\", \"marketing\", \"leadership\"]. No explanation.",
          },
          {
            role: "user",
            content: `Classify this person's topics:\n${text}`,
          },
        ],
        temperature: 0,
        max_tokens: 150,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[ai] classifyTopics failed: status=${res.status} body=${errText.slice(0, 300)}`);
      return [];
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    const result = Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    console.log(`[ai] classifyTopics result: ${JSON.stringify(result)}`);
    return result;
  } catch (err) {
    console.error(`[ai] classifyTopics exception: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

export async function checkRelevance(
  searchThemes: string[],
  headline: string | null,
  about: string | null,
  roles: string[]
): Promise<{ relevant: boolean; score: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ai] OPENROUTER_API_KEY is not set — skipping relevance check");
    return { relevant: true, score: 0 };
  }

  const profileText = [
    headline ? `Headline: ${headline}` : null,
    about ? `About: ${about}` : null,
    roles.length > 0 ? `Roles: ${roles.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (!profileText.trim()) return { relevant: true, score: 0 };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              'You evaluate whether a LinkedIn profile is relevant to specific search themes based on what the person TALKS ABOUT and POSTS ABOUT, not their job title or profession. A person is relevant if their content, posts, or areas of interest relate to the search themes — regardless of their formal profession. For example, an engineer who posts about marketing metrics IS relevant to marketing themes. Only mark as irrelevant if the person clearly does not discuss or create content related to the search themes at all. When in doubt, mark as relevant. Search themes may be in any language. Return JSON only: {"relevant": boolean, "score": 0.0-1.0, "reason": string}',
          },
          {
            role: "user",
            content: `Search themes: ${searchThemes.join(", ")}\n\nProfile:\n${profileText}`,
          },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[ai] checkRelevance failed: status=${res.status} body=${errText.slice(0, 300)}`);
      return { relevant: true, score: 0 };
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    const relevant = Boolean(parsed.relevant);
    const score = typeof parsed.score === "number" ? parsed.score : 0;
    console.log(`[ai] checkRelevance: relevant=${relevant}, score=${score}, reason=${parsed.reason ?? ""}`);
    return { relevant, score };
  } catch (err) {
    console.error(`[ai] checkRelevance exception: ${err instanceof Error ? err.message : err}`);
    return { relevant: true, score: 0 };
  }
}

const LANGUAGE_NAMES: Record<string, string> = {
  lang_pt: "Portuguese",
  lang_en: "English",
  lang_es: "Spanish",
  lang_fr: "French",
};

export async function generateSearchSynonyms(theme: string, language?: string): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ai] OPENROUTER_API_KEY is not set — skipping synonym generation");
    return [];
  }

  const languageName = language ? LANGUAGE_NAMES[language] : null;
  const languageInstruction = languageName
    ? `All synonyms MUST be in ${languageName}. Do NOT return synonyms in other languages.`
    : "";

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages: [
          {
            role: "user",
            content: `Generate 5 alternative search queries (synonyms, related terms) for finding LinkedIn posts about: ${theme}.\n${languageInstruction}\nReturn ONLY a JSON array of strings. No explanation.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[ai] generateSearchSynonyms failed: status=${res.status} body=${errText.slice(0, 300)}`);
      return [];
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    // Extract JSON array from response (may contain markdown fences)
    const match = content.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    const result = Array.isArray(parsed) ? parsed.slice(0, 5).map(String) : [];
    console.log(`[ai] generateSearchSynonyms for "${theme}": ${JSON.stringify(result)}`);
    return result;
  } catch (err) {
    console.error(`[ai] generateSearchSynonyms exception: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

export async function generateTitleSynonyms(title: string, language?: string): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ai] OPENROUTER_API_KEY is not set — skipping title synonym generation");
    return [];
  }

  const languageName = language ? LANGUAGE_NAMES[language] : null;
  const languageInstruction = languageName
    ? `Include variations in ${languageName} as well as English. All synonyms should be relevant for ${languageName}-speaking markets.`
    : "";

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages: [
          {
            role: "user",
            content: `Generate 5 alternative job titles and variations for: ${title}.\nInclude common abbreviations, full forms, and related titles.\nExample: for "CEO" → ["Chief Executive Officer", "Co-Founder & CEO", "Founder & CEO", "Diretor Executivo", "Managing Director"]\n${languageInstruction}\nReturn ONLY a JSON array of strings. No explanation.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[ai] generateTitleSynonyms failed: status=${res.status} body=${errText.slice(0, 300)}`);
      return [];
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    const result = Array.isArray(parsed) ? parsed.slice(0, 5).map(String) : [];
    console.log(`[ai] generateTitleSynonyms for "${title}": ${JSON.stringify(result)}`);
    return result;
  } catch (err) {
    console.error(`[ai] generateTitleSynonyms exception: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

export async function checkPublishLanguage(
  profileData: Record<string, unknown>,
  targetLanguage: string
): Promise<boolean> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ai] OPENROUTER_API_KEY is not set — skipping language check");
    return true;
  }

  const languageName = LANGUAGE_NAMES[targetLanguage];
  if (!languageName) return true;

  const parts: string[] = [];
  if (profileData.headline) parts.push(`Headline: ${profileData.headline}`);
  if (profileData.about) parts.push(`About: ${profileData.about}`);

  const activities = profileData.activities;
  if (Array.isArray(activities)) {
    const activityTexts = activities
      .slice(0, 10)
      .map((a: unknown) => {
        if (typeof a === "string") return a;
        if (a && typeof a === "object") {
          const obj = a as Record<string, unknown>;
          return obj.text ?? obj.title ?? obj.content ?? "";
        }
        return "";
      })
      .filter(Boolean);
    if (activityTexts.length > 0) {
      parts.push(`Recent posts:\n${activityTexts.join("\n")}`);
    }
  }

  if (parts.length === 0) return true;

  const profileText = parts.join("\n\n").slice(0, 3000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You determine if a LinkedIn user publishes content primarily in ${languageName}. Analyze their headline, about section, and recent posts. Return ONLY a JSON object: {"publishes_in_language": true/false}. No explanation.`,
          },
          {
            role: "user",
            content: profileText,
          },
        ],
        temperature: 0,
        max_tokens: 50,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[ai] checkPublishLanguage failed: status=${res.status} body=${errText.slice(0, 300)}`);
      return true;
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    const result = Boolean(parsed.publishes_in_language);
    console.log(`[ai] checkPublishLanguage: ${result} for language=${targetLanguage}`);
    return result;
  } catch (err) {
    console.error(`[ai] checkPublishLanguage exception: ${err instanceof Error ? err.message : err}`);
    return true;
  }
}

export async function generateEmbedding(
  text: string
): Promise<number[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ai] OPENROUTER_API_KEY is not set — skipping embedding generation");
    return null;
  }

  if (!text.trim()) return null;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[ai] generateEmbedding failed: status=${res.status} body=${errText.slice(0, 300)}`);
      return null;
    }

    const json = await res.json();
    const embedding = json.data?.[0]?.embedding ?? null;
    console.log(`[ai] generateEmbedding: ${embedding ? `${embedding.length} dimensions` : "no embedding returned"}`);
    return embedding;
  } catch (err) {
    console.error(`[ai] generateEmbedding exception: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * Batch ICP scoring: sends multiple lead headlines to AI for semantic matching against ICP criteria.
 * Returns a map of lead index → { score (0-100), matchedTitles, matchedDepartments, company }.
 */
export async function batchScoreIcpMatch(
  leads: Array<{ index: number; name: string; headline: string }>,
  icpJobTitles: string[],
  icpDepartments: string[],
): Promise<Map<number, { score: number; matchedTitles: string[]; matchedDepartments: string[]; company: string; jobTitle: string; roleLevel: "decisor" | "influenciador" | "observador" }>> {
  const results = new Map<number, { score: number; matchedTitles: string[]; matchedDepartments: string[]; company: string; jobTitle: string; roleLevel: "decisor" | "influenciador" | "observador" }>();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ai] OPENROUTER_API_KEY is not set — skipping ICP scoring");
    return results;
  }

  if (leads.length === 0) return results;

  const leadsText = leads.map((l) =>
    `[${l.index}] "${l.name}" — "${l.headline}"`
  ).join("\n");

  const prompt = `You are an ICP (Ideal Customer Profile) matching assistant. Analyze each lead's LinkedIn headline and determine how well they match the target ICP.

TARGET ICP:
- Job Titles: ${icpJobTitles.length > 0 ? icpJobTitles.join(", ") : "(any)"}
- Departments: ${icpDepartments.length > 0 ? icpDepartments.join(", ") : "(any)"}

LEADS TO SCORE:
${leadsText}

For each lead, determine:
1. score: 0-100 ICP match percentage (consider synonyms, translations PT/EN/ES, similar roles)
2. matchedTitles: which ICP job titles match (semantically, not just exact string)
3. matchedDepartments: which ICP departments match
4. company: extract the company name from the headline if present. Look for ALL these patterns:
   - "Title at Company" / "Title @ Company" / "Title na Company" / "Title em Company" / "Cargo na Empresa"
   - "Title - Company" / "Title | Company" / "Title · Company" / "Title em: Company"
   - "Company · Title" (company first, separator, title)
   - "Founder/CEO/CTO of Company" / "Co-founder at Company" / "Sócio na Company"
   - "Company (Title)" / "Title, Company"
   - Capitalized brand words appearing next to role keywords
   If no company is clearly extractable, return an empty string — DO NOT invent one. Ignore generic words like "LinkedIn", "Empresa", "Company".
5. jobTitle: the primary job title/role (first role mentioned, not the full headline)
6. roleLevel: classify the person's decision-making power:
   - "decisor": C-level, VP, Director, Head, Partner, Owner, Founder, Managing Director, General Manager, Country Manager, Sócio, Presidente, Diretor
   - "influenciador": Manager, Senior, Lead, Coordinator, Specialist, Principal, Consultant, Advisor, Gerente, Coordenador, Especialista Sênior
   - "observador": Junior, Trainee, Intern, Student, Assistant, Associate, entry-level Analyst, Estagiário, Assistente, Aprendiz

IMPORTANT: Match semantically! "VP Marketing" matches "Vice Presidente de Marketing". "Sales" matches "Vendas" or "Comercial". "CEO" matches "Chief Executive Officer" or "Diretor Executivo".

Respond ONLY with a JSON array, one object per lead:
[{"i":0,"s":85,"mt":["Marketing"],"md":["Sales"],"c":"Acme Corp","jt":"VP Marketing","rl":"decisor"}, ...]

Where: i=index, s=score, mt=matchedTitles, md=matchedDepartments, c=company, jt=jobTitle, rl=roleLevel`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-lite-001",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[ai] batchScoreIcpMatch failed: status=${res.status} body=${errText.slice(0, 300)}`);
      return results;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    console.log(`[ai] batchScoreIcpMatch raw response: ${content.slice(0, 500)}`);

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[ai] batchScoreIcpMatch: could not find JSON array in response");
      return results;
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      i: number; s: number; mt?: string[]; md?: string[]; c?: string; jt?: string; rl?: string;
    }>;

    for (const item of parsed) {
      const rl = item.rl as "decisor" | "influenciador" | "observador";
      results.set(item.i, {
        score: Math.max(0, Math.min(100, item.s ?? 0)),
        matchedTitles: item.mt ?? [],
        matchedDepartments: item.md ?? [],
        company: item.c ?? "",
        jobTitle: item.jt ?? "",
        roleLevel: ["decisor", "influenciador", "observador"].includes(rl) ? rl : "observador",
      });
    }

    console.log(`[ai] batchScoreIcpMatch: scored ${results.size}/${leads.length} leads`);
  } catch (err) {
    console.error(`[ai] batchScoreIcpMatch exception:`, err);
  }

  return results;
}

/**
 * Focused LLM pass to extract JUST the company name from richer bios
 * (headline + about + experience blurbs) when structured extraction failed.
 * Returns a Map index → company (empty string if none found).
 */
export async function extractCompaniesFromHeadlines(
  leads: Array<{ index: number; name: string; text: string }>,
): Promise<Map<number, string>> {
  const results = new Map<number, string>();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || leads.length === 0) return results;

  const leadsText = leads.map((l) =>
    `[${l.index}] "${l.name}" — "${l.text.slice(0, 400)}"`
  ).join("\n");

  const prompt = `Extract the CURRENT EMPLOYER / COMPANY from each LinkedIn bio text below.

BIOS:
${leadsText}

Look for ALL these patterns:
- "Title at Company" / "Title @ Company" / "Title na Company" / "Cargo na Empresa"
- "Title - Company" / "Title | Company" / "Title · Company"
- "Company · Title" (company first)
- "Founder/CEO/CTO of Company" / "Sócio na Company" / "Co-founder at Company"
- "Company (Title)" / "Title, Company"
- Prominent capitalized brand words next to role keywords

If you CANNOT find a clear company name, return "". DO NOT invent companies, DO NOT return generic words like "LinkedIn", "Empresa", "Company", "Freelancer".

Respond ONLY with a JSON array:
[{"i":0,"c":"Acme Corp"},{"i":1,"c":""},...]`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-lite-001",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error(`[ai] extractCompaniesFromHeadlines failed: status=${res.status}`);
      return results;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return results;
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ i: number; c?: string }>;
    for (const item of parsed) {
      if (item.c && item.c.trim()) results.set(item.i, item.c.trim());
    }
    console.log(`[ai] extractCompaniesFromHeadlines: extracted ${results.size}/${leads.length} companies`);
  } catch (err) {
    console.error(`[ai] extractCompaniesFromHeadlines exception:`, err);
  }

  return results;
}

/**
 * Analyze a company's LinkedIn presence to extract themes + ICP for the
 * Share of LinkedIn market mapping feature.
 */
export async function analyzeCompanyForShareOfLinkedin(
  companyName: string,
  description: string,
  specialties: string,
  industry: string,
  employeeTitles: string[],
  siteContent?: string,
  country?: string,
): Promise<{ themes: string; competitors: string[] } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const countryNames: Record<string, string> = { br: "Brazil", us: "USA", pt: "Portugal", es: "Spain", mx: "Mexico", ar: "Argentina", co: "Colombia", cl: "Chile", uk: "UK", de: "Germany", fr: "France", it: "Italy", in: "India", ca: "Canada", au: "Australia" };
  const countryName = country ? countryNames[country] ?? country.toUpperCase() : "";
  const countryCtx = countryName ? `\nCountry: ${countryName}` : "";

  const siteCtx = siteContent ? `\nWebsite: ${siteContent.slice(0, 600)}` : "";

  const prompt = `Identify DIRECT COMPETITORS of this company. Return COMPACT JSON only, no markdown.

${companyName} | ${industry} | ${specialties}${countryCtx}
${description.slice(0, 300)}${siteCtx}

CRITICAL RULES for competitors:
- MUST be companies of SIMILAR SIZE operating in the SAME COUNTRY (${countryName || "same region"})
- MUST offer the SAME type of service/product
- Do NOT list suppliers, cloud providers, or global technology platforms
- Do NOT list multinational giants if the company is a startup/SMB
- Prioritize LOCAL competitors from ${countryName || "the same country"} first
- If not enough local competitors exist, include regional ones

Return: {"themes":"5 short market themes comma-separated in Portuguese","competitors":["5-8 direct competitor company names"]}
Use official LinkedIn company names.`;

  try {
    let content = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-lite-001",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 1200,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) {
        const data = await res.json();
        content = data.choices?.[0]?.message?.content ?? "";
        break;
      }
      if ((res.status >= 500 || res.status === 429) && attempt < 3) {
        const delay = res.status === 429 ? 5000 : 3000;
        console.warn(`[ai] analyzeCompanyForShareOfLinkedin retry ${attempt}/2 after ${res.status} (wait ${delay}ms)`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      console.error(`[ai] analyzeCompanyForShareOfLinkedin failed: status=${res.status}`);
      return null;
    }
    console.log(`[ai] analyzeCompanyForShareOfLinkedin response: ${content.slice(0, 300)}`);
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { themes?: string; competitors?: string[] };
      return {
        themes: parsed.themes ?? "",
        competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
      };
    } catch {
      // Salvage truncated JSON
      console.warn(`[ai] analyzeCompanyForShareOfLinkedin JSON parse failed, salvaging...`);
      const raw = jsonMatch[0];
      const themesMatch = raw.match(/"themes"\s*:\s*"([^"]+)"/);
      const compArr: string[] = [];
      const compRegex = /"competitors"\s*:\s*\[([^\]]*)/;
      const cm = compRegex.exec(raw);
      if (cm) {
        const nameRegex = /"([^"]+)"/g;
        let nm;
        while ((nm = nameRegex.exec(cm[1])) !== null) compArr.push(nm[1]);
      }
      console.log(`[ai] analyzeCompanyForShareOfLinkedin salvaged: themes=${!!themesMatch}, competitors=${compArr.length}`);
      if (themesMatch || compArr.length > 0) {
        return { themes: themesMatch?.[1] ?? "", competitors: compArr };
      }
      return null;
    }
  } catch (err) {
    console.error(`[ai] analyzeCompanyForShareOfLinkedin exception:`, err);
    return null;
  }
}

export async function scoreCompetitorAdherence(
  companyName: string,
  companyDescription: string,
  companySiteContent: string,
  competitors: Array<{ name: string; siteContent: string }>,
  country?: string,
): Promise<{ enrichedThemes: string; scores: Array<{ name: string; score: number; reason: string }> } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const countryNames: Record<string, string> = { br: "Brazil", us: "USA", pt: "Portugal", es: "Spain", mx: "Mexico", ar: "Argentina", uk: "UK", de: "Germany", fr: "France" };
  const countryName = country ? countryNames[country] ?? "" : "";

  const compSummaries = competitors.map((c, i) => `${i + 1}. ${c.name}: ${c.siteContent.slice(0, 300)}`).join("\n");

  const prompt = `Score each competitor's alignment with the target company. ${countryName ? `Target operates in ${countryName}. Prioritize competitors with local presence in ${countryName}. Penalize companies without operations there.` : ""}

TARGET: ${companyName}. ${companyDescription.slice(0, 300)}
Site: ${companySiteContent.slice(0, 500)}

COMPETITORS:
${compSummaries}

Return COMPACT JSON. Keep reasons under 8 words each.
{"enriched_themes":"tema1,tema2,...","scores":[{"name":"X","score":8,"reason":"curto"}]}`;

  try {
    let content = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-lite-001",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 2500,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const data = await res.json();
        content = data.choices?.[0]?.message?.content ?? "";
        break;
      }
      if ((res.status >= 500 || res.status === 429) && attempt < 3) {
        const delay = res.status === 429 ? 5000 : 3000;
        console.warn(`[ai] scoreCompetitorAdherence retry ${attempt}/2 after ${res.status} (wait ${delay}ms)`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      console.error(`[ai] scoreCompetitorAdherence failed: status=${res.status}`);
      return null;
    }
    console.log(`[ai] scoreCompetitorAdherence response: ${content.slice(0, 500)}`);
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        enrichedThemes: parsed.enriched_themes ?? "",
        scores: Array.isArray(parsed.scores) ? parsed.scores : [],
      };
    } catch (parseErr) {
      // Try to salvage partial/truncated JSON
      console.warn(`[ai] scoreCompetitorAdherence JSON parse failed, trying salvage...`);
      const raw = jsonMatch[0];
      const themesMatch = raw.match(/"enriched_themes"\s*:\s*"([^"]+)"/);
      const scoresArr: Array<{ name: string; score: number; reason: string }> = [];
      // Regex that handles: complete entries, truncated reason, or missing reason
      const scoreRegex = /"name"\s*:\s*"([^"]+)"\s*,\s*"score"\s*:\s*(\d+)(?:\s*,\s*"reason"\s*:\s*"([^"]*?)(?:"|$))?/g;
      let m;
      while ((m = scoreRegex.exec(raw)) !== null) {
        scoresArr.push({ name: m[1], score: parseInt(m[2]), reason: m[3] ?? "" });
      }
      if (scoresArr.length > 0 || themesMatch) {
        console.log(`[ai] scoreCompetitorAdherence salvaged: ${scoresArr.length} scores, themes=${!!themesMatch}`);
        return { enrichedThemes: themesMatch?.[1] ?? "", scores: scoresArr };
      }
      console.error(`[ai] scoreCompetitorAdherence parse failed completely:`, parseErr);
      return null;
    }
  } catch (err) {
    console.error(`[ai] scoreCompetitorAdherence exception:`, err);
    return null;
  }
}

export async function analyzeProfileForLeads(
  profileName: string,
  profileHeadline: string,
  postTexts: string[],
): Promise<{ market_context: string; job_titles: string[]; departments: string[]; company_sizes: string[] } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ai] OPENROUTER_API_KEY is not set");
    return null;
  }

  const postsPreview = postTexts.slice(0, 10).map((t, i) => `Post ${i + 1}: "${t.slice(0, 300)}"`).join("\n");

  const prompt = `Analyze this LinkedIn profile and their recent posts to determine their market niche and suggest ideal target audience for B2B lead generation.

PROFILE:
Name: ${profileName}
Headline: ${profileHeadline}

RECENT POSTS:
${postsPreview}

Based on this profile's content and positioning, determine:

1. market_context: List the specific TOPICS and THEMES this person posts about, as comma-separated keywords in Portuguese (e.g., "Métricas de Marketing, Analytics de Marketing, Growth Marketing, Performance de Campanhas"). NOT a description of what the company does — instead list the actual content themes/topics they write about. Be specific with 5-8 topic keywords.

2. job_titles: Suggest 4-6 job titles (in Portuguese and English mix) of decision-makers who would be interested in this person's content/services. These are the people who engage with their posts and could become leads.

3. departments: Suggest 3-5 departments where these decision-makers work.

4. company_sizes: Suggest 2-3 company size ranges from these options: "1-10", "11-50", "51-200", "201-500", "501-1000", "1001+"

Respond ONLY with a JSON object:
{"market_context":"...","job_titles":["..."],"departments":["..."],"company_sizes":["..."]}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-lite-001",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error(`[ai] analyzeProfileForLeads failed: status=${res.status}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    console.log(`[ai] analyzeProfileForLeads response: ${content.slice(0, 500)}`);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[ai] analyzeProfileForLeads: no JSON found");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      market_context: parsed.market_context ?? "",
      job_titles: Array.isArray(parsed.job_titles) ? parsed.job_titles : [],
      departments: Array.isArray(parsed.departments) ? parsed.departments : [],
      company_sizes: Array.isArray(parsed.company_sizes) ? parsed.company_sizes : [],
    };
  } catch (err) {
    console.error("[ai] analyzeProfileForLeads exception:", err);
    return null;
  }
}

export async function rankPostsForLeadGeneration(
  posts: Array<{ id: string; text: string }>,
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || posts.length === 0) return results;

  const postsText = posts.map((p) => `[${p.id}] "${p.text.slice(0, 200)}"`).join("\n");

  const prompt = `Score each LinkedIn post for B2B lead generation relevance (0-100).

HIGH SCORE (70-100): Posts about business topics, industry insights, product/service expertise, market opinions, professional knowledge, case studies, results.
MEDIUM SCORE (30-69): General professional content, industry news sharing, thought leadership.
LOW SCORE (0-29): Job postings, hiring announcements, motivational quotes, team celebrations, birthdays, personal stories unrelated to business, "we are a family" type posts.

POSTS:
${postsText}

Respond ONLY with a JSON array: [{"id":"...","s":85}, ...]
Where id=post id, s=relevance score 0-100.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-lite-001",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return results;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return results;

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ id: string; s: number }>;
    for (const item of parsed) {
      results.set(String(item.id), Math.max(0, Math.min(100, item.s ?? 50)));
    }
    console.log(`[ai] rankPostsForLeadGeneration: scored ${results.size}/${posts.length} posts`);
  } catch (err) {
    console.error("[ai] rankPostsForLeadGeneration exception:", err);
  }

  return results;
}
