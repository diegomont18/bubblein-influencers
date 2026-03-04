export async function classifyTopics(
  headline: string | null,
  about: string | null,
  roles: string[]
): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return [];

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

    if (!res.ok) return [];

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export async function generateEmbedding(
  text: string
): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  if (!text.trim()) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
