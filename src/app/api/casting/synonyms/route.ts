import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateSearchSynonyms, generateTitleSynonyms } from "@/lib/ai";

interface SynonymsBody {
  themes: string[];
  language: string;
  searchMode?: string;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: SynonymsBody = await request.json();
  const { themes, language, searchMode } = body;

  if (!themes || themes.length === 0) {
    return NextResponse.json(
      { error: "At least one theme is required" },
      { status: 400 }
    );
  }

  const isTitleMode = searchMode === "title";
  console.log(`[casting/synonyms] Generating ${isTitleMode ? "title" : "content"} synonyms for ${themes.length} themes…`);

  const results = await Promise.all(
    themes.map(async (theme) => {
      const synonyms = isTitleMode
        ? await generateTitleSynonyms(theme, language)
        : await generateSearchSynonyms(theme, language);
      return [theme, synonyms] as const;
    })
  );

  const synonyms: Record<string, string[]> = {};
  for (const [theme, syns] of results) {
    synonyms[theme] = syns;
  }

  console.log(`[casting/synonyms] Generated synonyms for ${Object.keys(synonyms).length} themes`);

  return NextResponse.json({ synonyms });
}
