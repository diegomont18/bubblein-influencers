"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CopyToEnricherModal } from "./copy-to-enricher-modal";

const CLAMP_HEIGHT = 48; // ~2 lines at text-sm

function CollapsibleCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [clamped, setClamped] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const check = useCallback(() => {
    if (ref.current) {
      setClamped(ref.current.scrollHeight > CLAMP_HEIGHT + 4);
    }
  }, []);

  useEffect(() => {
    check();
  }, [children, check]);

  return (
    <div className={className}>
      <div
        ref={ref}
        style={!expanded && clamped ? { maxHeight: CLAMP_HEIGHT, overflow: "hidden" } : undefined}
        className="break-words whitespace-normal"
      >
        {children}
      </div>
      {clamped && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-blue-600 hover:underline text-xs mt-0.5 whitespace-nowrap"
        >
          {expanded ? "ver menos" : "ver tudo"}
        </button>
      )}
    </div>
  );
}

export interface CastingProfile {
  slug: string;
  name: string;
  headline: string;
  job_title: string;
  company: string;
  location: string;
  followers: number;
  followers_range?: string;
  posts_per_month: number;
  avg_likes_per_post?: number | null;
  avg_comments_per_post?: number | null;
  median_likes_per_post?: number | null;
  median_comments_per_post?: number | null;
  creator_score?: number | null;
  topics?: string[];
  topic_match?: number;
  matched_publico?: string[];
  final_score?: number | null;
  linkedin_url: string;
  focus?: number;
  source_keyword?: string;
  profile_photo?: string;
  found_at?: string;
}

interface CastingResultsProps {
  profiles: CastingProfile[];
  listId?: string | null;
  onDeleteProfile?: (slug: string) => void;
  queryTheme?: string;
}

type SortKey = "name" | "followers" | "posts_per_month" | "avg_likes_per_post" | "avg_comments_per_post" | "median_likes_per_post" | "median_comments_per_post" | "creator_score" | "topic_match" | "focus";
type SortDir = "asc" | "desc";

function SortableHeader({ label, sortKey: key, activeSortKey, sortDir, onSort }: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = activeSortKey === key;
  return (
    <th
      className="px-4 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          <span className="text-gray-700">{sortDir === "asc" ? "▲" : "▼"}</span>
        ) : (
          <span className="text-gray-300">▲</span>
        )}
      </span>
    </th>
  );
}

export function CastingResults({ profiles, listId, onDeleteProfile, queryTheme }: CastingResultsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copyTargets, setCopyTargets] = useState<CastingProfile[] | null>(null);
  const [feedback, setFeedback] = useState<{ queued: number; duplicates: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sortedProfiles = useMemo(() => {
    if (!sortKey) return profiles;
    const sorted = [...profiles].sort((a, b) => {
      if (sortKey === "name") {
        const aVal = a.name || "";
        const bVal = b.name || "";
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      // numeric sort
      const getVal = (p: CastingProfile): number | null | undefined => {
        if (sortKey === "creator_score") return p.final_score ?? p.creator_score;
        return p[sortKey] as number | null | undefined;
      };
      const aVal = getVal(a);
      const bVal = getVal(b);
      // nulls last regardless of direction
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [profiles, sortKey, sortDir]);

  function exportCsv() {
    const headers = ["Name", "LinkedIn URL", "Headline", "Company", "Job Title", "Location", "Followers", "Posts/Month", "Avg Likes", "Avg Comments", "Med Likes", "Med Comments", "Creator Score", "Topic Match %", "Topics", "Focus", "Keywords"];
    const escapeField = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    };
    const focusLabel = (f?: number) => f === 3 ? "High" : f === 2 ? "Medium" : f === 1 ? "Low" : "";
    const rows = sortedProfiles.map((p) => [
      p.name || "",
      p.linkedin_url || "",
      p.headline || "",
      p.company || "",
      p.job_title || "",
      p.location || "",
      p.followers != null ? String(p.followers) : "",
      p.posts_per_month != null ? String(Math.round(p.posts_per_month)) : "",
      p.avg_likes_per_post != null ? String(Math.round(p.avg_likes_per_post)) : "",
      p.avg_comments_per_post != null ? String(Math.round(p.avg_comments_per_post)) : "",
      p.median_likes_per_post != null ? String(Math.round(p.median_likes_per_post)) : "",
      p.median_comments_per_post != null ? String(Math.round(p.median_comments_per_post)) : "",
      (() => { const s = p.final_score ?? p.creator_score; return s != null ? String(Math.round(s)) : ""; })(),
      p.topic_match != null ? String(p.topic_match) : "",
      (p.topics || []).join("; "),
      focusLabel(p.focus),
      p.source_keyword || (queryTheme ? queryTheme.replace(/\n/g, ", ") : ""),
    ].map(escapeField));
    const csv = [headers.map(escapeField).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `casting-results-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
    if (selected.size === sortedProfiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedProfiles.map((p) => p.slug)));
    }
  }

  async function handleCopyConfirm(tags: string[]) {
    if (!copyTargets) return;

    const urls = copyTargets.map((p) => p.linkedin_url);
    try {
      const res = await fetch("/api/profiles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, tags, ...(queryTheme ? { casting_keywords: queryTheme.replace(/\n/g, ", ") } : {}) }),
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
          checked={sortedProfiles.length > 0 && selected.size === sortedProfiles.length}
          onChange={toggleSelectAll}
          className="rounded border-gray-300"
        />
      </th>
      <SortableHeader label="Name" sortKey="name" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <th className="px-4 py-3 font-medium text-gray-500">Profile</th>
      <th className="px-4 py-3 font-medium text-gray-500">Headline</th>
      <th className="px-4 py-3 font-medium text-gray-500">Company</th>
      <th className="px-4 py-3 font-medium text-gray-500">Current Job</th>
      <SortableHeader label="Followers" sortKey="followers" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <SortableHeader label="Posts /month" sortKey="posts_per_month" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <SortableHeader label="Avg Likes" sortKey="avg_likes_per_post" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <SortableHeader label="Avg Comments" sortKey="avg_comments_per_post" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <SortableHeader label="Med Likes" sortKey="median_likes_per_post" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <SortableHeader label="Med Comments" sortKey="median_comments_per_post" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <SortableHeader label="Creator Score" sortKey="creator_score" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <SortableHeader label="Match" sortKey="topic_match" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <th className="px-4 py-3 font-medium text-gray-500">Topics</th>
      <SortableHeader label="Focus" sortKey="focus" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <th className="px-4 py-3 font-medium text-gray-500">Keywords</th>
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
                <td colSpan={18} className="px-4 py-8 text-center text-gray-400">
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

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-md bg-blue-50 border border-blue-200 px-4 py-2 text-sm">
            <span className="text-blue-700 font-medium">
              {selected.size} selected
            </span>
            <button
              onClick={() => {
                const targets = sortedProfiles.filter((p) => selected.has(p.slug));
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
        <button
          onClick={exportCsv}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors ml-auto"
        >
          Export CSV
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>{headerRow}</thead>
            <tbody>
              {sortedProfiles.map((p) => {
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
                      <CollapsibleCell>{p.name || "—"}</CollapsibleCell>
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
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <CollapsibleCell>{p.headline || "—"}</CollapsibleCell>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <CollapsibleCell>{p.company || "—"}</CollapsibleCell>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <CollapsibleCell>{p.job_title || "—"}</CollapsibleCell>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.followers != null ? p.followers.toLocaleString() : "—"}
                    </td>
                    <td className={`px-4 py-3 ${(p.posts_per_month ?? 0) < 3 ? "text-red-600" : "text-gray-600"}`}>
                      {p.posts_per_month != null ? String(Math.round(p.posts_per_month)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.avg_likes_per_post != null ? String(Math.round(p.avg_likes_per_post)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.avg_comments_per_post != null ? String(Math.round(p.avg_comments_per_post)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.median_likes_per_post != null ? String(Math.round(p.median_likes_per_post)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.median_comments_per_post != null ? String(Math.round(p.median_comments_per_post)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {(() => {
                        const score = p.final_score ?? p.creator_score;
                        return score != null ? String(Math.round(score)) : "—";
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const tm = p.topic_match;
                        if (tm == null || (tm === 0 && (!p.matched_publico || p.matched_publico.length === 0) && p.final_score == null)) {
                          return <span className="text-gray-400">—</span>;
                        }
                        const color = tm >= 80
                          ? "bg-green-100 text-green-800"
                          : tm >= 50
                          ? "bg-yellow-100 text-yellow-800"
                          : tm > 0
                          ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800";
                        return (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
                            {tm}%
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {p.topics && p.topics.length > 0 ? (
                        <CollapsibleCell>
                          <div className="flex flex-wrap gap-1">
                            {p.topics.map((topic, i) => {
                              const isMatched = p.matched_publico?.some(
                                (mp) => mp.toLowerCase() === topic.toLowerCase()
                              );
                              return (
                                <span
                                  key={i}
                                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                    isMatched
                                      ? "bg-green-100 text-green-800"
                                      : "bg-blue-50 text-blue-700"
                                  }`}
                                >
                                  {topic}
                                </span>
                              );
                            })}
                          </div>
                        </CollapsibleCell>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
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
                    <td className="px-4 py-3 text-gray-500 max-w-xs">
                      <CollapsibleCell>{p.source_keyword || (queryTheme ? queryTheme.replace(/\n/g, ", ") : "—")}</CollapsibleCell>
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
