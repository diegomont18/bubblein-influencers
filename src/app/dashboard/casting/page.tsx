"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CastingResults,
  CastingProfile,
} from "@/components/casting/casting-results";
import {
  CastingPostResults,
  MatchedPost,
} from "@/components/casting/casting-post-results";

interface CastingList {
  id: string;
  name: string;
  query_theme: string;
  filters_applied: Record<string, unknown> | null;
  created_at: string;
  casting_list_profiles: [{ count: number }];
}

const LANGUAGES = [
  { label: "Portuguese (Brazil)", value: "lang_pt", country: "br", domain: "google.com.br" },
  { label: "English (US)", value: "lang_en", country: "us", domain: "google.com" },
  { label: "Spanish", value: "lang_es", country: "es", domain: "google.es" },
  { label: "French", value: "lang_fr", country: "fr", domain: "google.fr" },
];

export default function CastingPage() {
  const [searchMode, setSearchMode] = useState<"content" | "title" | "posts">("content");
  const [themes, setThemes] = useState("");
  const [languageIdx, setLanguageIdx] = useState(0);
  const [minFollowers, setMinFollowers] = useState(2500);
  const [maxFollowers, setMaxFollowers] = useState(100000);
  const [resultsCount, setResultsCount] = useState(20);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synonyms, setSynonyms] = useState<Record<string, string[]> | null>(null);
  const [generatingSynonyms, setGeneratingSynonyms] = useState(false);
  const [coverAllKeywords, setCoverAllKeywords] = useState(true);
  const [publico, setPublico] = useState("");
  const [useSynonyms, setUseSynonyms] = useState(false);

  const [minReactions, setMinReactions] = useState(10);
  const [datePosted, setDatePosted] = useState<"past-24h" | "past-week" | "past-month" | "past-year">("past-month");

  const abortControllerRef = useRef<AbortController | null>(null);

  const [profiles, setProfiles] = useState<CastingProfile[]>([]);
  const [postResults, setPostResults] = useState<MatchedPost[]>([]);
  const [viewingSearchMode, setViewingSearchMode] = useState<string | null>(null);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [keywordStats, setKeywordStats] = useState<Record<string, { googleResults: number; candidates: number; matched: number }> | null>(null);

  // "Load more" state for posts search
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsListId, setPostsListId] = useState<string | null>(null);

  const [pastLists, setPastLists] = useState<CastingList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [viewingListId, setViewingListId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  const fetchPastLists = useCallback(async () => {
    try {
      const res = await fetch("/api/casting/lists");
      if (res.ok) {
        const json = await res.json();
        setPastLists(json.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    fetchPastLists();
  }, [fetchPastLists]);

  async function handleGenerateSynonyms() {
    const themeLines = themes
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (themeLines.length === 0) {
      setError(searchMode === "title" ? "Enter at least one job title." : "Enter at least one keyword.");
      return;
    }

    setError(null);
    setGeneratingSynonyms(true);

    const lang = LANGUAGES[languageIdx];

    try {
      const res = await fetch("/api/casting/synonyms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themes: themeLines,
          language: lang.value,
          searchMode,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Failed to generate synonyms (${res.status})`);
      }

      const json = await res.json();
      setSynonyms(json.synonyms ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate synonyms");
    } finally {
      setGeneratingSynonyms(false);
    }
  }

  async function handleSearch(withSynonyms: boolean = true, continuation?: { existingListId: string }) {
    const themeLines = themes
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (themeLines.length === 0) {
      setError(searchMode === "title" ? "Enter at least one job title." : "Enter at least one keyword.");
      return;
    }

    setError(null);
    setSearching(true);
    if (!continuation) {
      setProfiles([]);
      setPostResults([]);
      setTotalCandidates(0);
      setKeywordStats(null);
      setPostsHasMore(false);
      setPostsListId(null);
    }
    setViewingListId(null);
    setViewingSearchMode(searchMode);

    const lang = LANGUAGES[languageIdx];
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const publicoTags = publico.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);

      const res = await fetch("/api/casting/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themes: themeLines,
          language: lang.value,
          country: lang.country,
          domain: lang.domain,
          minFollowers,
          maxFollowers,
          resultsCount,
          approvedSynonyms: withSynonyms && synonyms ? synonyms : undefined,
          coverAllKeywords,
          publico: publicoTags,
          searchMode,
          ...(searchMode === "posts" ? { minReactions, datePosted } : {}),
          ...(continuation ? { existingListId: continuation.existingListId } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Search failed (${res.status})`);
      }

      // Read NDJSON stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "profile") {
              setProfiles((prev) => [...prev, event.data]);
            } else if (event.type === "post") {
              setPostResults((prev) => [...prev, event.data]);
            } else if (event.type === "done") {
              setTotalCandidates((prev) => (continuation ? prev : 0) + (event.data.totalCandidates ?? 0));
              setKeywordStats(event.data.keywordStats ?? null);
              if (event.data.hasMore !== undefined) {
                setPostsHasMore(event.data.hasMore);
                setPostsListId(event.data.listId ?? null);
              }
            } else if (event.type === "error") {
              setError(event.data.message ?? "Search failed");
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          if (event.type === "done") {
            setTotalCandidates((prev) => (continuation ? prev : 0) + (event.data.totalCandidates ?? 0));
            setKeywordStats(event.data.keywordStats ?? null);
            if (event.data.hasMore !== undefined) {
              setPostsHasMore(event.data.hasMore);
              setPostsListId(event.data.listId ?? null);
            }
          }
        } catch {
          // ignore
        }
      }

      fetchPastLists();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped the search — partial results are already displayed and saved in DB
        fetchPastLists();
      } else {
        setError(err instanceof Error ? err.message : "Search failed");
      }
    } finally {
      setSearching(false);
      abortControllerRef.current = null;
    }
  }

  function handleStopSearch() {
    abortControllerRef.current?.abort();
  }

  async function handleDeleteList(listId: string) {
    if (!window.confirm("Are you sure you want to delete this casting list?")) return;

    try {
      const res = await fetch(`/api/casting/lists?id=${listId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to delete list");
      }
      setPastLists((prev) => prev.filter((l) => l.id !== listId));
      if (viewingListId === listId) {
        setViewingListId(null);
        setProfiles([]);
        setTotalCandidates(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete list");
    }
  }

  async function handleDeleteProfile(slug: string) {
    if (!viewingListId) return;

    // Optimistically remove from state
    setProfiles((prev) => prev.filter((p) => p.slug !== slug));
    setTotalCandidates((prev) => Math.max(0, prev - 1));

    try {
      const res = await fetch(
        `/api/casting/lists/profiles?listId=${viewingListId}&profileId=${slug}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to remove profile");
      }
      // Update the profile count in past lists
      setPastLists((prev) =>
        prev.map((l) =>
          l.id === viewingListId
            ? {
                ...l,
                casting_list_profiles: [
                  { count: Math.max(0, (l.casting_list_profiles?.[0]?.count ?? 1) - 1) },
                ],
              }
            : l
        )
      );
    } catch (err) {
      // Revert on failure — reload the list
      setError(err instanceof Error ? err.message : "Failed to remove profile");
      handleViewList(viewingListId);
    }
  }

  async function handleViewList(listId: string) {
    setViewingListId(listId);
    setError(null);
    setLoadingList(true);
    setProfiles([]);
    setPostResults([]);

    try {
      const res = await fetch(`/api/casting/lists?id=${listId}`);
      if (!res.ok) throw new Error("Failed to load list");
      const json = await res.json();

      // Detect search mode from filters_applied
      const listFilters = json.list?.filters_applied ?? json.filters_applied ?? {};
      const listSearchMode = listFilters.searchMode ?? "content";
      setViewingSearchMode(listSearchMode);

      console.log(`[casting] Loaded ${(json.profiles ?? []).length} items, searchMode=${listSearchMode}`, json.profiles?.[0]?.notes);

      if (listSearchMode === "posts") {
        const parsedPosts: MatchedPost[] = (json.profiles ?? []).map(
          (p: { notes: string; profile_id: string }) => {
            try {
              const notes = typeof p.notes === "string" ? JSON.parse(p.notes) : p.notes;
              return {
                post_url: notes?.post_url ?? "",
                activity_id: notes?.activity_id ?? p.profile_id,
                content_preview: notes?.content_preview ?? "",
                author_slug: notes?.author_slug ?? "",
                author_name: notes?.author_name ?? "Unknown",
                author_headline: notes?.author_headline ?? "",
                author_linkedin_url: notes?.author_linkedin_url ?? "",
                reactions: notes?.reactions ?? 0,
                comments: notes?.comments ?? 0,
                total_engagement: notes?.total_engagement ?? 0,
                engagement_rate: notes?.engagement_rate ?? 0,
                posted_at: notes?.posted_at ?? null,
                source_keyword: notes?.source_keyword ?? "",
              } as MatchedPost;
            } catch {
              return {
                post_url: "",
                activity_id: p.profile_id,
                content_preview: "",
                author_slug: "",
                author_name: "Unknown",
                author_headline: "",
                author_linkedin_url: "",
                reactions: 0,
                comments: 0,
                total_engagement: 0,
                engagement_rate: 0,
                posted_at: null,
                source_keyword: "",
              } as MatchedPost;
            }
          }
        );
        setPostResults(parsedPosts);
        setTotalCandidates(parsedPosts.length);
      } else {
        const parsed: CastingProfile[] = (json.profiles ?? []).map(
          (p: { notes: string; profile_id: string }) => {
            try {
              const notes = typeof p.notes === "string" ? JSON.parse(p.notes) : p.notes;
              return {
                slug: p.profile_id,
                name: notes?.name ?? "Unknown",
                headline: notes?.headline ?? "",
                job_title: notes?.job_title ?? "",
                company: notes?.company ?? "",
                location: notes?.location ?? "",
                followers: notes?.followers ?? 0,
                posts_per_month: notes?.posts_per_month ?? 0,
                avg_likes_per_post: notes?.avg_likes_per_post ?? null,
                avg_comments_per_post: notes?.avg_comments_per_post ?? null,
                creator_score: notes?.creator_score ?? null,
                topics: notes?.topics ?? [],
                topic_match: notes?.topic_match ?? undefined,
                matched_publico: notes?.matched_publico ?? undefined,
                final_score: notes?.final_score ?? undefined,
                linkedin_url: notes?.linkedin_url ?? `https://linkedin.com/in/${p.profile_id}`,
                focus: notes?.focus ?? null,
                source_keyword: notes?.source_keyword ?? undefined,
              };
            } catch (e) {
              console.warn(`[casting] Failed to parse notes for profile ${p.profile_id}`, e);
              return {
                slug: p.profile_id,
                name: "Unknown",
                headline: "",
                job_title: "",
                company: "",
                location: "",
                followers: 0,
                posts_per_month: 0,
                linkedin_url: `https://linkedin.com/in/${p.profile_id}`,
              };
            }
          }
        );

        console.log(`[casting] Parsed ${parsed.length} profiles`);

        setProfiles(parsed);
        setTotalCandidates(parsed.length);
      }

      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch {
      setError("Failed to load list details");
    } finally {
      setLoadingList(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Casting</h1>
        <p className="text-gray-500 mt-1">
          Discover LinkedIn influencers by content themes, job titles, and follower range.
        </p>
      </div>

      {/* Search Form */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Search Influencers</h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setSearchMode("content"); setSynonyms(null); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              searchMode === "content"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Topics Search
          </button>
          <button
            type="button"
            onClick={() => { setSearchMode("title"); setSynonyms(null); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              searchMode === "title"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Title Search
          </button>
          <button
            type="button"
            onClick={() => { setSearchMode("posts"); setSynonyms(null); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              searchMode === "posts"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Posts Search
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {searchMode === "title" ? "Job titles (one per line)" : "Keywords (one per line)"}
          </label>
          <textarea
            rows={4}
            value={themes}
            onChange={(e) => {
              setThemes(e.target.value);
              setSynonyms(null);
            }}
            placeholder={searchMode === "title"
              ? "CEO\nFounder\nDiretor Executivo"
              : searchMode === "posts"
              ? "marketing digital\nliderança\ninteligência artificial"
              : "marketing digital\ninfluenciador linkedin\ncriação de conteúdo"
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        {searchMode === "content" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publico (target audience)
            </label>
            <input
              type="text"
              value={publico}
              onChange={(e) => setPublico(e.target.value)}
              placeholder="marketing, AI, leadership, tech"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        )}

        {searchMode === "posts" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min. reactions
              </label>
              <input
                type="number"
                value={minReactions}
                onChange={(e) => setMinReactions(Number(e.target.value))}
                min={0}
                step={1}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date range
              </label>
              <select
                value={datePosted}
                onChange={(e) => setDatePosted(e.target.value as typeof datePosted)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="past-24h">Last 24 hours</option>
                <option value="past-week">Last week</option>
                <option value="past-month">Last month</option>
                <option value="past-year">Last year</option>
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              value={languageIdx}
              onChange={(e) => setLanguageIdx(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {LANGUAGES.map((l, i) => (
                <option key={l.value} value={i}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {searchMode !== "posts" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min followers
                </label>
                <input
                  type="number"
                  value={minFollowers}
                  onChange={(e) => setMinFollowers(Number(e.target.value))}
                  min={0}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max followers
                </label>
                <input
                  type="number"
                  value={maxFollowers}
                  onChange={(e) => setMaxFollowers(Number(e.target.value))}
                  min={0}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desired results
            </label>
            <input
              type="number"
              value={resultsCount}
              onChange={(e) => setResultsCount(Number(e.target.value))}
              min={1}
              max={100}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {searchMode !== "posts" && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={coverAllKeywords}
              onChange={(e) => setCoverAllKeywords(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Cover all keywords (may exceed desired results count)
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {searchMode !== "posts" && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={useSynonyms}
              onChange={(e) => {
                setUseSynonyms(e.target.checked);
                if (!e.target.checked) setSynonyms(null);
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Use synonyms (expand search with related terms)
          </label>
        )}

        <div className="flex items-center gap-3">
          {searchMode === "posts" || !useSynonyms ? (
            <button
              onClick={() => handleSearch(false)}
              disabled={searching || generatingSynonyms}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          ) : !synonyms ? (
            <button
              onClick={handleGenerateSynonyms}
              disabled={generatingSynonyms || searching}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generatingSynonyms ? "Generating Synonyms..." : "Generate Synonyms"}
            </button>
          ) : (
            <>
              <button
                onClick={() => handleSearch(true)}
                disabled={searching}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {searching ? "Searching..." : "Search"}
              </button>
              <button
                onClick={handleGenerateSynonyms}
                disabled={generatingSynonyms || searching}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {generatingSynonyms ? "Regenerating..." : "Regenerate"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Synonym Review Panel */}
      {synonyms && !searching && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Review Synonyms</h2>
          <p className="text-sm text-gray-500">
            Edit or remove synonyms before searching. These will be used as additional search queries.
          </p>
          <div className="space-y-4">
            {Object.entries(synonyms).map(([theme, syns]) => (
              <div key={theme}>
                <h3 className="text-sm font-medium text-gray-800 mb-2">{theme}</h3>
                <div className="flex flex-wrap gap-2">
                  {syns.map((syn, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 bg-gray-100 rounded-md px-2 py-1"
                    >
                      <input
                        type="text"
                        value={syn}
                        onChange={(e) => {
                          setSynonyms((prev) => {
                            if (!prev) return prev;
                            const updated = { ...prev };
                            updated[theme] = [...updated[theme]];
                            updated[theme][idx] = e.target.value;
                            return updated;
                          });
                        }}
                        className="bg-transparent text-sm text-gray-700 outline-none min-w-[100px]"
                        style={{ width: `${Math.max(syn.length, 10)}ch` }}
                      />
                      <button
                        onClick={() => {
                          setSynonyms((prev) => {
                            if (!prev) return prev;
                            const updated = { ...prev };
                            updated[theme] = updated[theme].filter((_, i) => i !== idx);
                            return updated;
                          });
                        }}
                        className="text-gray-400 hover:text-red-500 text-xs font-bold ml-1"
                        title="Remove synonym"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  {syns.length === 0 && (
                    <span className="text-xs text-gray-400 italic">No synonyms</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {(profiles.length > 0 || postResults.length > 0 || searching || loadingList || viewingListId !== null) && (
        <div ref={resultsRef} className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Results</h2>
            {totalCandidates > 0 && (
              <span className="text-sm text-gray-500">
                {viewingSearchMode === "posts"
                  ? `${postResults.length} posts found / ${totalCandidates} fetched`
                  : `${profiles.length} matched / ${totalCandidates} candidates scraped`
                }
              </span>
            )}
          </div>
          {keywordStats && Object.keys(keywordStats).length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
                Per-keyword breakdown
              </summary>
              <table className="w-full mt-2 text-xs">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-2">Keyword</th>
                    <th className="px-3 py-2 text-right">Google Results</th>
                    <th className="px-3 py-2 text-right">Candidates</th>
                    <th className="px-3 py-2 text-right">Matched</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(keywordStats).map(([keyword, stats]) => (
                    <tr key={keyword} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 text-gray-700 max-w-[300px] truncate" title={keyword}>
                        {keyword.length > 60 ? keyword.slice(0, 60) + "…" : keyword}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{stats.googleResults}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{stats.candidates}</td>
                      <td className="px-3 py-1.5 text-right text-gray-700 font-medium">{stats.matched}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          {searching && (
            <div className="py-4 text-center space-y-3">
              <p className="text-sm text-blue-600 animate-pulse">
                {viewingSearchMode === "posts"
                  ? `Searching LinkedIn posts...${postResults.length > 0 ? ` (${postResults.length} found so far)` : ""}`
                  : `Searching LinkedIn profiles... This may take a few minutes.${profiles.length > 0 ? ` (${profiles.length} found so far)` : ""}`
                }
              </p>
              <button
                onClick={handleStopSearch}
                className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Stop Search
              </button>
            </div>
          )}
          {loadingList && (
            <p className="text-sm text-blue-600 animate-pulse py-4 text-center">
              Loading casting list...
            </p>
          )}
          {/* Load More for posts search */}
          {!searching && !loadingList && viewingSearchMode === "posts" && postsHasMore && postsListId && postResults.length < resultsCount && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm space-y-2">
              <p className="text-amber-800">
                Found {postResults.length} post{postResults.length !== 1 ? "s" : ""} with reactions {"\u2265"} {minReactions}.
                {postResults.length < resultsCount && ` Need ${resultsCount - postResults.length} more to reach your target of ${resultsCount}.`}
              </p>
              <button
                onClick={() => handleSearch(false, { existingListId: postsListId! })}
                className="px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
              >
                Search for more posts
              </button>
            </div>
          )}
          {!loadingList && viewingSearchMode === "posts" ? (
            <CastingPostResults
              posts={postResults}
              listId={viewingListId}
              queryTheme={
                viewingListId
                  ? pastLists.find((l) => l.id === viewingListId)?.query_theme
                  : themes
              }
            />
          ) : !loadingList ? (
            <CastingResults
              profiles={profiles}
              listId={viewingListId}
              onDeleteProfile={handleDeleteProfile}
              queryTheme={
                viewingListId
                  ? pastLists.find((l) => l.id === viewingListId)?.query_theme
                  : themes
              }
            />
          ) : null}
        </div>
      )}

      {/* Past Lists */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Past Casting Lists</h2>
        {loadingLists ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : pastLists.length === 0 ? (
          <p className="text-sm text-gray-400">No casting lists yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Themes</th>
                  <th className="px-4 py-3">Profiles</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pastLists.map((list) => (
                  <tr
                    key={list.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      viewingListId === list.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {list.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[300px] truncate">
                      {list.query_theme.replace(/\n/g, ", ")}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {list.casting_list_profiles?.[0]?.count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(list.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewList(list.id)}
                          disabled={loadingList && viewingListId === list.id}
                          className="text-blue-600 hover:underline text-sm disabled:opacity-50"
                        >
                          {loadingList && viewingListId === list.id ? "Loading..." : "View"}
                        </button>
                        <button
                          onClick={() => handleDeleteList(list.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
