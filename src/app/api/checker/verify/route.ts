import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { searchGoogle } from "@/lib/serper";
import { isApifyBlocked } from "@/lib/apify-usage";

function extractSlug(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function scoreName(candidateText: string, expectedName: string): number {
  const normalizedCandidate = normalize(candidateText);
  const tokens = normalize(expectedName)
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return 0;
  const matched = tokens.filter((t) => normalizedCandidate.includes(t)).length;
  return matched / tokens.length;
}

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

function findBestMatch(
  results: SearchResult[],
  expectedName: string
): string | null {
  const linkedInResults = results.filter((r) =>
    /linkedin\.com\/in\//.test(r.link)
  );

  let bestUrl: string | null = null;
  let bestScore = 0;

  for (const r of linkedInResults) {
    const titleScore = scoreName(r.title, expectedName);
    const snippetScore = scoreName(r.snippet ?? "", expectedName);
    const score = Math.max(titleScore, snippetScore);
    if (score > bestScore) {
      bestScore = score;
      bestUrl = r.link;
    }
  }

  return bestScore >= 0.5 ? bestUrl : null;
}

export async function POST() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isApifyBlocked()) {
    return NextResponse.json(
      { error: "Limite mensal de créditos Apify atingido. Contate o admin." },
      { status: 503 }
    );
  }

  const service = createServiceClient();

  // Fetch pending entries (batch of 5)
  const { data: entries, error: fetchErr } = await service
    .from("checker_entries")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({ processed: 0, remaining: 0 });
  }

  // Mark as checking
  await service
    .from("checker_entries")
    .update({ status: "checking" })
    .in(
      "id",
      entries.map((e) => e.id)
    );

  let processed = 0;

  for (const entry of entries) {
    const slug = extractSlug(entry.original_url);

    // Step 1: Verify the original URL exists
    if (slug) {
      const verifyQuery = `site:linkedin.com/in/ "${slug}"`;
      const verifyResult = await searchGoogle(verifyQuery);

      const matchUrl = (verifyResult.results as SearchResult[]).find((r) =>
        r.link.includes(`linkedin.com/in/${slug}`)
      )?.link;
      if (matchUrl) {
        await service
          .from("checker_entries")
          .update({
            status: "valid",
            verified_url: entry.original_url,
            search_results: verifyResult.results as unknown as Record<string, unknown>,
          })
          .eq("id", entry.id);
        processed++;
        continue;
      }
    }

    // Step 2: Multi-strategy search with name validation
    const strategies = [
      `site:linkedin.com/in/ "${entry.name}"`,
      `site:linkedin.com/in/ ${entry.name}${entry.headline ? " " + entry.headline.split(/[\s,|·•–-]+/).filter((w: string) => w.length > 2)[0] : ""}`,
      `linkedin.com ${entry.name}`,
    ];

    let foundUrl: string | null = null;
    let lastResults: SearchResult[] = [];

    for (const query of strategies) {
      const searchResult = await searchGoogle(query);
      lastResults = searchResult.results as SearchResult[];
      foundUrl = findBestMatch(lastResults, entry.name);
      if (foundUrl) break;
    }

    if (foundUrl) {
      await service
        .from("checker_entries")
        .update({
          status: "found",
          verified_url: foundUrl,
          search_results: lastResults as unknown as Record<string, unknown>,
        })
        .eq("id", entry.id);
    } else {
      await service
        .from("checker_entries")
        .update({
          status: "not_found",
          search_results: lastResults as unknown as Record<string, unknown>,
        })
        .eq("id", entry.id);
    }

    processed++;
  }

  // Count remaining
  const { count } = await service
    .from("checker_entries")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return NextResponse.json({ processed, remaining: count ?? 0 });
}
