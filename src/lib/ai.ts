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
): Promise<Map<number, { score: number; matchedTitles: string[]; matchedDepartments: string[]; company: string; jobTitle: string }>> {
  const results = new Map<number, { score: number; matchedTitles: string[]; matchedDepartments: string[]; company: string; jobTitle: string }>();

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
4. company: extract the company name from the headline if present (look for "at Company", "em Empresa", "@ Company", or company names after role descriptions)
5. jobTitle: the primary job title/role (first role mentioned, not the full headline)

IMPORTANT: Match semantically! "VP Marketing" matches "Vice Presidente de Marketing". "Sales" matches "Vendas" or "Comercial". "CEO" matches "Chief Executive Officer" or "Diretor Executivo".

Respond ONLY with a JSON array, one object per lead:
[{"i":0,"s":85,"mt":["Marketing"],"md":["Sales"],"c":"Acme Corp","jt":"VP Marketing"}, ...]

Where: i=index, s=score, mt=matchedTitles, md=matchedDepartments, c=company, jt=jobTitle`;

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
      i: number; s: number; mt?: string[]; md?: string[]; c?: string; jt?: string;
    }>;

    for (const item of parsed) {
      results.set(item.i, {
        score: Math.max(0, Math.min(100, item.s ?? 0)),
        matchedTitles: item.mt ?? [],
        matchedDepartments: item.md ?? [],
        company: item.c ?? "",
        jobTitle: item.jt ?? "",
      });
    }

    console.log(`[ai] batchScoreIcpMatch: scored ${results.size}/${leads.length} leads`);
  } catch (err) {
    console.error(`[ai] batchScoreIcpMatch exception:`, err);
  }

  return results;
}
