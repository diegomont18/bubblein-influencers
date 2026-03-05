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
