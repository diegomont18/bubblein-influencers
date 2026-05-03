// ---------------------------------------------------------------------------
// Shared OpenRouter caller with multi-model fallback
// ---------------------------------------------------------------------------

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface CallOpenRouterOpts {
  models: string[];
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  timeoutMs?: number;
  label: string;
}

/**
 * Call OpenRouter with automatic model fallback. For each model in the list:
 * - Tries up to 2 retries on 429/5xx (5s delay for 429, 3s for 5xx)
 * - On persistent failure, moves to the next model
 * Returns the response content string, or null if all models fail.
 */
async function callOpenRouter(opts: CallOpenRouterOpts): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(`[ai] ${opts.label}: OPENROUTER_API_KEY not set`);
    return null;
  }

  for (const model of opts.models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const fetchOpts: RequestInit & { signal?: AbortSignal } = {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: opts.messages,
            temperature: opts.temperature ?? 0,
            max_tokens: opts.max_tokens ?? 500,
          }),
        };
        if (opts.timeoutMs) {
          fetchOpts.signal = AbortSignal.timeout(opts.timeoutMs);
        }

        const res = await fetch(OPENROUTER_URL, fetchOpts);

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content ?? "";
          if (content.trim()) return content;
          console.warn(`[ai] ${opts.label}: ${model} returned empty content`);
          break; // try next model
        }

        if ((res.status === 429 || res.status >= 500) && attempt < 3) {
          const delay = res.status === 429 ? 5000 : 3000;
          console.warn(`[ai] ${opts.label}: ${model} returned ${res.status}, retry ${attempt}/2 (wait ${delay}ms)`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        console.error(`[ai] ${opts.label}: ${model} failed with status ${res.status}`);
        break; // try next model
      } catch (err) {
        console.error(`[ai] ${opts.label}: ${model} exception: ${err instanceof Error ? err.message : err}`);
        break; // try next model
      }
    }
    console.warn(`[ai] ${opts.label}: ${model} exhausted, trying next model...`);
  }

  console.error(`[ai] ${opts.label}: all models failed`);
  return null;
}

// ---------------------------------------------------------------------------
// AI functions
// ---------------------------------------------------------------------------

export async function classifyTopics(
  headline: string | null,
  about: string | null,
  roles: string[]
): Promise<string[]> {
  const text = [headline, about, ...roles].filter(Boolean).join("\n");
  if (!text.trim()) return [];

  try {
    const content = await callOpenRouter({
      models: ["openai/gpt-4o-mini", "deepseek/deepseek-v4-flash"],
      messages: [
        { role: "system", content: "You classify LinkedIn influencers into topics. Return ONLY a JSON array of 3-5 lowercase topic strings. Example: [\"ai\", \"marketing\", \"leadership\"]. No explanation." },
        { role: "user", content: `Classify this person's topics:\n${text}` },
      ],
      temperature: 0,
      max_tokens: 150,
      label: "classifyTopics",
    });
    if (!content) return [];
    const parsed = JSON.parse(content);
    const result = Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    console.log(`[ai] classifyTopics result: ${JSON.stringify(result)}`);
    return result;
  } catch (err) {
    console.error(`[ai] classifyTopics exception: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

export async function classifyPost(
  textContent: string,
  marketThemes: string
): Promise<{ theme: string; content_type: string; summary: string }> {
  const fallback = { theme: "outros", content_type: "outros", summary: "" };
  if (!textContent.trim()) return fallback;

  try {
    const content = await callOpenRouter({
      models: ["openai/gpt-4o-mini", "deepseek/deepseek-v4-flash"],
      messages: [
        { role: "system", content: `Classifique este post de LinkedIn. Responda APENAS com JSON válido, sem markdown:\n{"theme":"tema principal","content_type":"produto|institucional|vagas|outros","summary":"resumo de 1 frase"}\n\nRegras:\n- theme: escolha o tema mais relevante da lista fornecida\n- content_type: "produto" para cases, teses, insights de negócio; "institucional" para eventos, prêmios, anúncios; "vagas" para recrutamento/RH; "outros" para motivacional, pessoal\n- summary: resumo objetivo de 1 frase em português` },
        { role: "user", content: `Temas disponíveis: ${marketThemes}\n\nPost:\n${textContent.slice(0, 500)}` },
      ],
      temperature: 0,
      max_tokens: 200,
      label: "classifyPost",
    });
    if (!content) return fallback;
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      theme: String(parsed.theme ?? "outros"),
      content_type: String(parsed.content_type ?? "outros"),
      summary: String(parsed.summary ?? ""),
    };
  } catch (err) {
    console.error(`[ai] classifyPost exception: ${err instanceof Error ? err.message : err}`);
    return fallback;
  }
}

export async function checkRelevance(
  searchThemes: string[],
  headline: string | null,
  about: string | null,
  roles: string[]
): Promise<{ relevant: boolean; score: number }> {
  const profileText = [
    headline ? `Headline: ${headline}` : null,
    about ? `About: ${about}` : null,
    roles.length > 0 ? `Roles: ${roles.join(", ")}` : null,
  ].filter(Boolean).join("\n");
  if (!profileText.trim()) return { relevant: true, score: 0 };

  try {
    const content = await callOpenRouter({
      models: ["openai/gpt-4o-mini", "google/gemini-2.0-flash-001"],
      messages: [
        { role: "system", content: 'You evaluate whether a LinkedIn profile is relevant to specific search themes based on what the person TALKS ABOUT and POSTS ABOUT, not their job title or profession. A person is relevant if their content, posts, or areas of interest relate to the search themes — regardless of their formal profession. For example, an engineer who posts about marketing metrics IS relevant to marketing themes. Only mark as irrelevant if the person clearly does not discuss or create content related to the search themes at all. When in doubt, mark as relevant. Search themes may be in any language. Return JSON only: {"relevant": boolean, "score": 0.0-1.0, "reason": string}' },
        { role: "user", content: `Search themes: ${searchThemes.join(", ")}\n\nProfile:\n${profileText}` },
      ],
      temperature: 0,
      max_tokens: 200,
      label: "checkRelevance",
    });
    if (!content) return { relevant: true, score: 0 };
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
  const languageName = language ? LANGUAGE_NAMES[language] : null;
  const languageInstruction = languageName ? `All synonyms MUST be in ${languageName}. Do NOT return synonyms in other languages.` : "";

  try {
    const content = await callOpenRouter({
      models: ["meta-llama/llama-3-8b-instruct", "deepseek/deepseek-v4-flash"],
      messages: [{ role: "user", content: `Generate 5 alternative search queries (synonyms, related terms) for finding LinkedIn posts about: ${theme}.\n${languageInstruction}\nReturn ONLY a JSON array of strings. No explanation.` }],
      temperature: 0.7,
      max_tokens: 200,
      label: "generateSearchSynonyms",
    });
    if (!content) return [];
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
  const languageName = language ? LANGUAGE_NAMES[language] : null;
  const languageInstruction = languageName ? `Include variations in ${languageName} as well as English. All synonyms should be relevant for ${languageName}-speaking markets.` : "";

  try {
    const content = await callOpenRouter({
      models: ["meta-llama/llama-3-8b-instruct", "deepseek/deepseek-v4-flash"],
      messages: [{ role: "user", content: `Generate 5 alternative job titles and variations for: ${title}.\nInclude common abbreviations, full forms, and related titles.\nExample: for "CEO" → ["Chief Executive Officer", "Co-Founder & CEO", "Founder & CEO", "Diretor Executivo", "Managing Director"]\n${languageInstruction}\nReturn ONLY a JSON array of strings. No explanation.` }],
      temperature: 0.7,
      max_tokens: 200,
      label: "generateTitleSynonyms",
    });
    if (!content) return [];
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
  const languageName = LANGUAGE_NAMES[targetLanguage];
  if (!languageName) return true;

  const parts: string[] = [];
  if (profileData.headline) parts.push(`Headline: ${profileData.headline}`);
  if (profileData.about) parts.push(`About: ${profileData.about}`);
  const activities = profileData.activities;
  if (Array.isArray(activities)) {
    const activityTexts = activities.slice(0, 10).map((a: unknown) => {
      if (typeof a === "string") return a;
      if (a && typeof a === "object") { const obj = a as Record<string, unknown>; return obj.text ?? obj.title ?? obj.content ?? ""; }
      return "";
    }).filter(Boolean);
    if (activityTexts.length > 0) parts.push(`Recent posts:\n${activityTexts.join("\n")}`);
  }
  if (parts.length === 0) return true;

  try {
    const content = await callOpenRouter({
      models: ["openai/gpt-4o-mini", "deepseek/deepseek-v4-flash"],
      messages: [
        { role: "system", content: `You determine if a LinkedIn user publishes content primarily in ${languageName}. Analyze their headline, about section, and recent posts. Return ONLY a JSON object: {"publishes_in_language": true/false}. No explanation.` },
        { role: "user", content: parts.join("\n\n").slice(0, 3000) },
      ],
      temperature: 0,
      max_tokens: 50,
      label: "checkPublishLanguage",
    });
    if (!content) return true;
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
    const content = await callOpenRouter({
      models: ["google/gemini-2.0-flash-001", "openai/gpt-4o-mini"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
      timeoutMs: 30_000,
      label: "batchScoreIcpMatch",
    });
    if (!content) return results;
    console.log(`[ai] batchScoreIcpMatch raw response: ${content.slice(0, 500)}`);

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
    const content = await callOpenRouter({
      models: ["google/gemini-2.0-flash-001", "openai/gpt-4o-mini"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1500,
      timeoutMs: 30_000,
      label: "extractCompaniesFromHeadlines",
    });
    if (!content) return results;
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
): Promise<{ themes: string; brands: string[] } | null> {
  const countryNames: Record<string, string> = { br: "Brazil", us: "USA", pt: "Portugal", es: "Spain", mx: "Mexico", ar: "Argentina", co: "Colombia", cl: "Chile", uk: "UK", de: "Germany", fr: "France", it: "Italy", in: "India", ca: "Canada", au: "Australia" };
  const countryName = country ? countryNames[country] ?? country.toUpperCase() : "";
  const countryCtx = countryName ? `\nCountry: ${countryName}` : "";
  const siteCtx = siteContent ? `\nWebsite: ${siteContent.slice(0, 600)}` : "";

  const prompt = `Identify market themes AND proprietary product/brand names for this company. Return JSON only, no markdown.

Company: ${companyName} | ${industry} | ${specialties}${countryCtx}
${description.slice(0, 300)}${siteCtx}

1) "themes": 10-15 B2B market themes this company discusses on LinkedIn. Comma-separated. Include BOTH the English term AND the local language term for each theme (e.g. for Brazil: "Marketing Automation, Automação de Marketing, CRM, Gestão de Relacionamento, Sales Enablement, Capacitação de Vendas"). This ensures we capture posts written in either language.
IMPORTANT: Never use broad single-word generic terms. Always qualify with the company's specific market/industry context. BAD: "distribution", "logistics", "technology", "management", "innovation", "distribuição", "logística", "tecnologia". GOOD: "healthcare distribution", "pharmaceutical logistics", "HR technology", "supply chain management in FMCG", "distribuição na saúde", "logística farmacêutica". Each theme should be specific enough to filter LinkedIn posts relevant ONLY to this company's niche.
2) "brands": array of proprietary product/brand names owned by this company (e.g. for HubSpot: ["HubSpot Marketing Hub","HubSpot CRM","HubSpot Service Hub"]). Keep the original product names even for Brazilian companies. Empty array if the company has no distinct product lines.

{"themes":"English Theme 1, Tema em Português 1, English Theme 2, Tema em Português 2","brands":["Produto A","Produto B"]}`;

  try {
    const content = await callOpenRouter({
      models: ["google/gemini-2.0-flash-001", "openai/gpt-4o-mini", "deepseek/deepseek-v4-flash"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1200,
      timeoutMs: 45_000,
      label: "analyzeCompanyForShareOfLinkedin",
    });
    if (!content) return null;

    console.log(`[ai] analyzeCompanyForShareOfLinkedin response: ${content.slice(0, 300)}`);
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { themes?: string; brands?: unknown };
      const brands = Array.isArray(parsed.brands)
        ? parsed.brands.filter((b): b is string => typeof b === "string" && b.trim().length > 0).map((b) => b.trim())
        : [];
      return { themes: parsed.themes ?? "", brands };
    } catch {
      const raw = jsonMatch[0];
      const themesMatch = raw.match(/"themes"\s*:\s*"([^"]+)"/);
      const brandsMatch = raw.match(/"brands"\s*:\s*\[([^\]]*)\]/);
      const brands: string[] = brandsMatch
        ? (brandsMatch[1].match(/"([^"]+)"/g) ?? []).map((s) => s.replace(/^"|"$/g, "").trim()).filter(Boolean)
        : [];
      if (themesMatch) return { themes: themesMatch[1], brands };
      return null;
    }
  } catch (err) {
    console.error(`[ai] analyzeCompanyForShareOfLinkedin exception:`, err);
    return null;
  }
}

/**
 * Extract proprietary product/brand names from a company's website + LinkedIn data.
 * Uses DeepSeek (cheapest model) since this is a straightforward extraction task.
 */
export async function extractBrands(
  companyName: string,
  siteContent: string,
  linkedinDescription: string,
): Promise<string[]> {
  const prompt = `Extract proprietary product/brand names owned by "${companyName}". The company name itself is ALWAYS the first brand. Return ONLY a JSON array. No explanation, no markdown.

Website content:
${siteContent.slice(0, 2000)}

LinkedIn: ${linkedinDescription.slice(0, 300)}

Examples: for "RD Station" → ["RD Station","RD Station Marketing","RD Station CRM","RD Station Conversas"]
For "HubSpot" → ["HubSpot","HubSpot Marketing Hub","HubSpot CRM","HubSpot Service Hub"]
For "Agendor" → ["Agendor"]
ALWAYS include "${companyName}" as the first element.`;

  try {
    const content = await callOpenRouter({
      models: ["deepseek/deepseek-v4-flash", "google/gemini-2.5-flash-lite", "openai/gpt-4o-mini"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
      timeoutMs: 30_000,
      label: `extractBrands(${companyName})`,
    });
    if (!content) return [];
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrMatch) return [];
    const parsed = JSON.parse(arrMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    return parsed.filter((b): b is string => typeof b === "string" && b.trim().length > 0).map((b) => b.trim());
  } catch (err) {
    console.error(`[ai] extractBrands(${companyName}) exception:`, err);
    return [];
  }
}

export async function scoreCompetitorAdherence(
  companyName: string,
  companyDescription: string,
  companySiteContent: string,
  competitors: Array<{ name: string; siteContent: string }>,
  country?: string,
): Promise<{ enrichedThemes: string; scores: Array<{ name: string; score: number; reason: string }> } | null> {
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
    const content = await callOpenRouter({
      models: ["google/gemini-2.0-flash-001", "openai/gpt-4o-mini"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2500,
      timeoutMs: 60_000,
      label: "scoreCompetitorAdherence",
    });
    if (!content) return null;

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
      console.warn(`[ai] scoreCompetitorAdherence JSON parse failed, trying salvage...`);
      const raw = jsonMatch[0];
      const themesMatch = raw.match(/"enriched_themes"\s*:\s*"([^"]+)"/);
      const scoresArr: Array<{ name: string; score: number; reason: string }> = [];
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
    const content = await callOpenRouter({
      models: ["google/gemini-2.0-flash-001", "openai/gpt-4o-mini"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
      timeoutMs: 30_000,
      label: "analyzeProfileForLeads",
    });
    if (!content) return null;

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
    const content = await callOpenRouter({
      models: ["google/gemini-2.0-flash-001", "openai/gpt-4o-mini"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1000,
      timeoutMs: 30_000,
      label: "rankPostsForLeadGeneration",
    });
    if (!content) return results;
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

export async function classifySentiment(
  textContent: string,
  brand: string,
): Promise<{ sentiment: "positivo" | "neutro" | "negativo"; summary: string }> {
  const fallback = { sentiment: "neutro" as const, summary: "" };
  if (!textContent.trim()) return fallback;

  try {
    const content = await callOpenRouter({
      models: ["openai/gpt-4o-mini", "deepseek/deepseek-v4-flash"],
      messages: [
        { role: "system", content: `Classifique o sentimento de um post de LinkedIn em relação à marca mencionada. Responda APENAS com JSON válido, sem markdown:\n{"sentiment":"positivo|neutro|negativo","summary":"resumo de 1 frase"}\n\nRegras:\n- "positivo": elogia, recomenda, celebra resultado, defende a marca\n- "negativo": critica, reclama, alerta sobre problemas, frustração\n- "neutro": comparativo equilibrado, observação factual, análise sem julgamento\n- summary: resumo objetivo de 1 frase em português, focado no que o autor diz da marca` },
        { role: "user", content: `Marca: ${brand}\n\nPost:\n${textContent.slice(0, 800)}` },
      ],
      temperature: 0,
      max_tokens: 200,
      label: "classifySentiment",
    });
    if (!content) return fallback;
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const raw = String(parsed.sentiment ?? "neutro").toLowerCase();
    const sentiment: "positivo" | "neutro" | "negativo" =
      raw === "positivo" ? "positivo" : raw === "negativo" ? "negativo" : "neutro";
    return { sentiment, summary: String(parsed.summary ?? "") };
  } catch (err) {
    console.error(`[ai] classifySentiment exception: ${err instanceof Error ? err.message : err}`);
    return fallback;
  }
}

interface SolRecBundle {
  period: string;
  mainCompany: string;
  mainBrands: string[];
  marketContext: string;
  companies: Record<
    string,
    {
      brand_owner: "main" | "competitor";
      posts_count: number;
      engagement_total: number;
      sol_score: number;
      top_themes: string[];
      content_composition: Record<string, number>;
      top_posts: Array<{ summary: string; engagement: number; author: string }>;
    }
  >;
  sov_totals: Record<string, { brand_owner: "main" | "competitor"; positivo: number; neutro: number; negativo: number }>;
  top_influencers: Array<{
    name: string;
    company: string;
    followers: number;
    posts_about: number;
    sentiment: string;
    brands_mentioned: Array<{ brand: string; brand_owner: "main" | "competitor" }>;
  }>;
  collaborators?: Array<{
    name: string;
    slug: string;
    headline: string;
    posts: number;
    engagement: number;
    main_category: string;
  }>;
}

export interface SolRecommendation {
  id: number;
  title: string;
  tag: "DEFENSIVA" | "CONTEÚDO" | "OFENSIVA" | "CONSOLIDACAO" | "RELACIONAMENTO";
  urgency: "alta" | "média" | "baixa";
  desc: string;
  who?: string;
  baseline?: string;
  expected_impact?: string;
  details: string;
}

export interface SolSuggestedPost {
  id: number;
  title: string;
  topics: string[];
  suggested_executives: Array<{
    name: string;
    slug: string;
    headline: string;
    reason: string;
  }>;
  expected_outcome: string;
  justification: string;
  confidence: number;
}

export interface SolRecommendationsOutput {
  insights: {
    positives: Array<{ title: string; description: string }>;
    concerns: Array<{ title: string; description: string }>;
  };
  recommendations: SolRecommendation[];
  movements: Array<{ company: string; text: string }>;
  suggested_posts?: SolSuggestedPost[];
}

export async function generateSolRecommendations(
  bundle: SolRecBundle,
): Promise<SolRecommendationsOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const fallback: SolRecommendationsOutput = {
    insights: { positives: [], concerns: [] },
    recommendations: [],
    movements: [],
  };
  if (!apiKey) {
    console.error("[ai] OPENROUTER_API_KEY is not set — skipping SOL recommendations");
    return fallback;
  }

  const systemPrompt = `Você é um estrategista de presença digital no LinkedIn. Analise os dados comparativos e gere recomendações ESPECÍFICAS e EMBASADAS para melhorar o posicionamento da empresa principal.

Responda APENAS com JSON válido (sem markdown), no formato:
{
  "insights": {
    "positives": [{"title":"...","description":"..."}],
    "concerns":  [{"title":"...","description":"..."}]
  },
  "recommendations": [
    {
      "id": 1,
      "title": "...",
      "tag": "DEFENSIVA|CONTEÚDO|OFENSIVA|CONSOLIDACAO|RELACIONAMENTO",
      "urgency": "alta|média|baixa",
      "desc": "...",
      "baseline": "...",
      "expected_impact": "...",
      "details": "..."
    }
  ],
  "movements": [{"company":"...","text":"..."}]
}

REGRAS OBRIGATÓRIAS:
- Tudo em português
- 3 positives + 3 concerns nos insights — cada um DEVE citar números do bundle
- 5 a 8 recommendations priorizadas:
  - "title": ação estratégica concreta (não genérica)
  - "desc": diagnóstico com NÚMEROS comparativos do bundle (posts, engajamento, SOL, temas, composição de conteúdo)
    Exemplo BOM: "Concorrente X lidera o tema 'Logística Farmacêutica' com 15 posts e 4.200 engaj. vs. seus 3 posts e 310 engaj. Publicar 2 posts/semana com cases de operação."
    Exemplo RUIM: "Aumentar frequência de posts para melhorar visibilidade."
  - "baseline": situação atual da empresa nos indicadores relevantes (números exatos do bundle)
  - "expected_impact": resultado esperado com estimativa de melhoria nos indicadores (SOL, engajamento, share of voice)
  - "details": justificativa detalhada + temas específicos a abordar + formato recomendado (artigo, carrossel, case, vídeo) + frequência sugerida (separados por \\n)
  - NÃO inclua campo "who" — isso já está em outra seção (Posts Sugeridos)
- 3 a 5 movements — observações sobre movimentos competitivos COM números
- Tags:
  - DEFENSIVA: tema onde a empresa está perdendo posição para concorrente
  - CONTEÚDO: tema novo ou sub-explorado com oportunidade
  - OFENSIVA: tema onde pode atacar posição de concorrente
  - CONSOLIDACAO: tema onde já lidera e deve reforçar
  - RELACIONAMENTO: ativar influenciadores ou parcerias para amplificação
- CADA recomendação deve referenciar dados específicos: números de posts, engajamento, scores SOL, temas, composição de conteúdo
- NUNCA recomende: monitoramento (a plataforma já faz), decisões de negócio genéricas, estratégias de produto/vendas/operações, ferramentas externas
- Foque em: temas específicos a abordar, frequência concreta, formato, posicionamento em relação aos concorrentes`;

  try {
    const content = await callOpenRouter({
      models: ["openai/gpt-4o-mini", "google/gemini-2.0-flash-001"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Dados do período:\n${JSON.stringify(bundle, null, 2)}` },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      label: "generateSolRecommendations",
    });
    if (!content) return fallback;

    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<SolRecommendationsOutput>;

    const positives = Array.isArray(parsed.insights?.positives) ? parsed.insights!.positives : [];
    const concerns = Array.isArray(parsed.insights?.concerns) ? parsed.insights!.concerns : [];
    const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    const movements = Array.isArray(parsed.movements) ? parsed.movements : [];

    const allowedTags: SolRecommendation["tag"][] = [
      "DEFENSIVA",
      "CONTEÚDO",
      "OFENSIVA",
      "CONSOLIDACAO",
      "RELACIONAMENTO",
    ];
    const allowedUrg: SolRecommendation["urgency"][] = ["alta", "média", "baixa"];

    const recommendations: SolRecommendation[] = rawRecs.map((r, i) => {
      const tagRaw = String(r.tag ?? "CONTEÚDO").toUpperCase();
      const tag = (allowedTags.includes(tagRaw as SolRecommendation["tag"]) ? tagRaw : "CONTEÚDO") as SolRecommendation["tag"];
      const urgRaw = String(r.urgency ?? "média").toLowerCase();
      const urgency = (allowedUrg.includes(urgRaw as SolRecommendation["urgency"]) ? urgRaw : "média") as SolRecommendation["urgency"];
      return {
        id: typeof r.id === "number" ? r.id : i + 1,
        title: String(r.title ?? ""),
        tag,
        urgency,
        desc: String(r.desc ?? ""),
        who: r.who ? String(r.who) : undefined,
        baseline: r.baseline ? String(r.baseline) : undefined,
        expected_impact: r.expected_impact ? String(r.expected_impact) : undefined,
        details: String(r.details ?? ""),
      };
    });

    return {
      insights: {
        positives: positives.map((p) => ({ title: String(p.title ?? ""), description: String(p.description ?? "") })),
        concerns: concerns.map((c) => ({ title: String(c.title ?? ""), description: String(c.description ?? "") })),
      },
      recommendations,
      movements: movements.map((m) => ({ company: String(m.company ?? ""), text: String(m.text ?? "") })),
    };
  } catch (err) {
    console.error(`[ai] generateSolRecommendations exception: ${err instanceof Error ? err.message : err}`);
    return fallback;
  }
}

export async function generateSolSuggestedPosts(
  bundle: SolRecBundle,
  analyses: SolRecommendationsOutput,
): Promise<SolSuggestedPost[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ai] OPENROUTER_API_KEY is not set — skipping SOL suggested posts");
    return [];
  }

  const systemPrompt = `Você é um estrategista de conteúdo para LinkedIn. Recebe métricas competitivas de uma empresa, menções externas, influenciadores, lista de executivos/colaboradores, e as análises estratégicas já geradas (insights, recomendações, movimentos competitivos).

Com base em TODOS esses dados, gere exatamente 10 sugestões de posts para o LinkedIn, ordenados por grau de confiança (maior primeiro).

Responda APENAS com JSON válido (sem markdown), no formato exato:
{
  "suggested_posts": [
    {
      "id": 1,
      "title": "Tema / título do post",
      "topics": ["Tópico 1", "Tópico 2", "Tópico 3"],
      "suggested_executives": [{"name":"...","slug":"...","headline":"...","reason":"Por que esta pessoa deve publicar"}],
      "expected_outcome": "Expectativa de resultado",
      "justification": "Justificativa baseada nos dados",
      "confidence": 85
    }
  ]
}

Regras:
- Tudo em português
- Exatamente 10 posts sugeridos, ordenados por confidence (maior primeiro)
- Cada post DEVE referenciar executivos reais da lista de colaboradores fornecida — use o name, slug e headline exatos
- "topics": 3 a 5 bullet points concisos e acionáveis que o executivo pode usar como roteiro do post
- "suggested_executives": 1 a 3 executivos por post, escolhidos com base no cargo, histórico de conteúdo e adequação ao tema. O campo "reason" deve explicar por que essa pessoa é ideal para esse post
- "expected_outcome": resultado esperado — mencionar faixa de engajamento estimada (baseado na média do executivo e do tema), impacto estratégico (ex: "fortalece SOL em tema X", "responde a movimento do concorrente Y"), e público-alvo
- "justification": embasamento com dados concretos do bundle — citar números específicos (% de SOL, engajamento médio, gaps competitivos, temas sub-explorados, insights e recomendações das análises)
- "confidence": 0-100, baseado na força dos dados e alinhamento estratégico. Quanto mais dados suportam a sugestão, maior a confiança
- Os posts devem cobrir um mix de: responder a temas de concorrentes, amplificar temas fortes, preencher lacunas de conteúdo, reagir a movimentos competitivos e alavancar tendências identificadas
- ESCOPO: apenas conteúdo de Relações Públicas, Marketing e Conteúdo para LinkedIn
- NUNCA sugira posts sobre monitoramento de concorrentes ou funcionalidades da plataforma`;

  try {
    const userContent = JSON.stringify({
      dados_do_periodo: bundle,
      analises_estrategicas: analyses,
    }, null, 2);

    const content = await callOpenRouter({
      models: ["openai/gpt-4o-mini", "google/gemini-2.0-flash-001"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      label: "generateSolSuggestedPosts",
    });
    if (!content) return [];

    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as { suggested_posts?: unknown[] };
    const rawPosts = Array.isArray(parsed.suggested_posts) ? parsed.suggested_posts : [];

    const collabSlugs = new Set((bundle.collaborators ?? []).map((c) => c.slug));

    const suggestedPosts: SolSuggestedPost[] = (rawPosts as Array<Record<string, unknown>>).map((p, i) => {
      const rawExecs = Array.isArray(p.suggested_executives) ? p.suggested_executives : [];
      const executives = (rawExecs as Array<Record<string, unknown>>)
        .filter((e) => typeof e.slug === "string" && collabSlugs.has(e.slug as string))
        .map((e) => ({
          name: String(e.name ?? ""),
          slug: String(e.slug ?? ""),
          headline: String(e.headline ?? ""),
          reason: String(e.reason ?? ""),
        }));

      const confidence = typeof p.confidence === "number"
        ? Math.max(0, Math.min(100, Math.round(p.confidence)))
        : 50;

      return {
        id: typeof p.id === "number" ? p.id : i + 1,
        title: String(p.title ?? ""),
        topics: Array.isArray(p.topics) ? (p.topics as unknown[]).map((t) => String(t)) : [],
        suggested_executives: executives,
        expected_outcome: String(p.expected_outcome ?? ""),
        justification: String(p.justification ?? ""),
        confidence,
      };
    });

    suggestedPosts.sort((a, b) => b.confidence - a.confidence);
    console.log(`[ai] generateSolSuggestedPosts: ${suggestedPosts.length} posts generated`);
    return suggestedPosts;
  } catch (err) {
    console.error(`[ai] generateSolSuggestedPosts exception: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}
