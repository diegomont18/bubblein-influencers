"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CastingResults,
  CastingProfile,
} from "@/components/casting/casting-results";

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
  const [themes, setThemes] = useState("");
  const [languageIdx, setLanguageIdx] = useState(0);
  const [minFollowers, setMinFollowers] = useState(1000);
  const [maxFollowers, setMaxFollowers] = useState(100000);
  const [resultsCount, setResultsCount] = useState(20);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<CastingProfile[]>([]);
  const [totalCandidates, setTotalCandidates] = useState(0);

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

  async function handleSearch() {
    const themeLines = themes
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (themeLines.length === 0) {
      setError("Enter at least one content theme.");
      return;
    }

    setError(null);
    setSearching(true);
    setProfiles([]);
    setTotalCandidates(0);

    const lang = LANGUAGES[languageIdx];

    try {
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
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Search failed (${res.status})`);
      }

      const json = await res.json();
      setProfiles(json.profiles ?? []);
      setTotalCandidates(json.totalCandidates ?? 0);
      setViewingListId(null);
      fetchPastLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
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

    try {
      const res = await fetch(`/api/casting/lists?id=${listId}`);
      if (!res.ok) throw new Error("Failed to load list");
      const json = await res.json();

      console.log(`[casting] Loaded ${(json.profiles ?? []).length} profiles`, json.profiles?.[0]?.notes);

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
              linkedin_url: notes?.linkedin_url ?? `https://linkedin.com/in/${p.profile_id}`,
              focus: notes?.focus ?? null,
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
          Discover LinkedIn influencers by content themes and follower range.
        </p>
      </div>

      {/* Search Form */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Search Influencers</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content themes (one per line)
          </label>
          <textarea
            rows={4}
            value={themes}
            onChange={(e) => setThemes(e.target.value)}
            placeholder={"marketing digital\ninfluenciador linkedin\ncriação de conteúdo"}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Results */}
      {(profiles.length > 0 || searching || loadingList || viewingListId !== null) && (
        <div ref={resultsRef} className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Results</h2>
            {totalCandidates > 0 && (
              <span className="text-sm text-gray-500">
                {profiles.length} matched / {totalCandidates} candidates scraped
              </span>
            )}
          </div>
          {searching ? (
            <p className="text-sm text-blue-600 animate-pulse py-4 text-center">
              Searching LinkedIn profiles... This may take a few minutes.
            </p>
          ) : loadingList ? (
            <p className="text-sm text-blue-600 animate-pulse py-4 text-center">
              Loading casting list...
            </p>
          ) : (
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
          )}
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
