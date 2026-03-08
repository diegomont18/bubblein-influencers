"use client";

import { useState, useEffect } from "react";
import { CopyToEnricherModal } from "./copy-to-enricher-modal";

export interface CastingProfile {
  slug: string;
  name: string;
  headline: string;
  job_title: string;
  company: string;
  location: string;
  followers: number;
  posts_per_month: number;
  linkedin_url: string;
  focus?: number;
}

interface CastingResultsProps {
  profiles: CastingProfile[];
  listId?: string | null;
  onDeleteProfile?: (slug: string) => void;
}

export function CastingResults({ profiles, listId, onDeleteProfile }: CastingResultsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copyTargets, setCopyTargets] = useState<CastingProfile[] | null>(null);
  const [feedback, setFeedback] = useState<{ queued: number; duplicates: number } | null>(null);

  // Clear selection when profiles change
  useEffect(() => {
    setSelected(new Set());
  }, [profiles]);

  // Auto-dismiss feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  function toggleSelect(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === profiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(profiles.map((p) => p.slug)));
    }
  }

  async function handleCopyConfirm(tags: string[]) {
    if (!copyTargets) return;

    const urls = copyTargets.map((p) => p.linkedin_url);
    try {
      const res = await fetch("/api/profiles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, tags }),
      });
      if (res.ok) {
        const data = await res.json();
        setFeedback({ queued: data.queued, duplicates: data.duplicates });
      }
    } catch {
      // ignore
    }
    setCopyTargets(null);
    setSelected(new Set());
  }

  const headerRow = (
    <tr className="border-b border-gray-200 bg-gray-50 text-left">
      <th className="px-4 py-3">
        <input
          type="checkbox"
          checked={profiles.length > 0 && selected.size === profiles.length}
          onChange={toggleSelectAll}
          className="rounded border-gray-300"
        />
      </th>
      <th className="px-4 py-3 font-medium text-gray-500">Name</th>
      <th className="px-4 py-3 font-medium text-gray-500">Profile</th>
      <th className="px-4 py-3 font-medium text-gray-500">Headline</th>
      <th className="px-4 py-3 font-medium text-gray-500">Company</th>
      <th className="px-4 py-3 font-medium text-gray-500">Current Job</th>
      <th className="px-4 py-3 font-medium text-gray-500">Followers</th>
      <th className="px-4 py-3 font-medium text-gray-500">Topics</th>
      <th className="px-4 py-3 font-medium text-gray-500">Tags</th>
      <th className="px-4 py-3 font-medium text-gray-500">Posts /month</th>
      <th className="px-4 py-3 font-medium text-gray-500">Focus</th>
      <th className="px-4 py-3 font-medium text-gray-500">Extracted</th>
      <th className="px-4 py-3 font-medium text-gray-500">Status</th>
      <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
    </tr>
  );

  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>{headerRow}</thead>
            <tbody>
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-gray-400">
                  No profiles found matching your criteria.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Feedback banner */}
      {feedback && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm">
          {feedback.queued > 0 && (
            <span className="text-green-700">
              Queued {feedback.queued} profile{feedback.queued !== 1 ? "s" : ""} for enrichment.
            </span>
          )}
          {feedback.queued > 0 && feedback.duplicates > 0 && " "}
          {feedback.duplicates > 0 && (
            <span className="text-amber-600">
              {feedback.duplicates} duplicate{feedback.duplicates !== 1 ? "s" : ""} skipped.
            </span>
          )}
          {feedback.queued === 0 && feedback.duplicates > 0 && (
            <span className="text-amber-600 font-medium">
              All profiles already exist in enricher.
            </span>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-blue-50 border border-blue-200 px-4 py-2 text-sm">
          <span className="text-blue-700 font-medium">
            {selected.size} selected
          </span>
          <button
            onClick={() => {
              const targets = profiles.filter((p) => selected.has(p.slug));
              setCopyTargets(targets);
            }}
            className="rounded-md bg-blue-600 px-3 py-1 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            Copy to Enricher
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-blue-600 hover:underline text-xs"
          >
            Clear Selection
          </button>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>{headerRow}</thead>
            <tbody>
              {profiles.map((p) => {
                const slug = p.linkedin_url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? p.slug;
                return (
                  <tr
                    key={p.slug}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${selected.has(p.slug) ? "bg-blue-50/50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p.slug)}
                        onChange={() => toggleSelect(p.slug)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-blue-600">
                      {p.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.linkedin_url ? (
                        <a
                          href={p.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          /{slug}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-600">
                      {p.headline || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.company || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.job_title || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.followers != null ? p.followers.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400">—</td>
                    <td className="px-4 py-3 text-gray-400">—</td>
                    <td className={`px-4 py-3 ${(p.posts_per_month ?? 0) < 3 ? "text-red-600" : "text-gray-600"}`}>
                      {p.posts_per_month != null ? String(Math.round(p.posts_per_month)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.focus === 3 ? (
                        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">High</span>
                      ) : p.focus === 2 ? (
                        <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">Medium</span>
                      ) : p.focus === 1 ? (
                        <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Low</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">—</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        found
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCopyTargets([p])}
                          title="Copy to Enricher"
                          className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                        </button>
                        {listId && onDeleteProfile && (
                          <button
                            onClick={() => onDeleteProfile(p.slug)}
                            title="Remove from list"
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CopyToEnricherModal
        open={copyTargets !== null}
        profileCount={copyTargets?.length ?? 0}
        onConfirm={handleCopyConfirm}
        onCancel={() => setCopyTargets(null)}
      />
    </>
  );
}
