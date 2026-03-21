"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const CLAMP_HEIGHT = 48;

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

export interface MatchedPost {
  post_url: string;
  activity_id: string;
  content_preview: string;
  author_slug: string;
  author_name: string;
  author_headline: string;
  author_linkedin_url: string;
  reactions: number;
  comments: number;
  total_engagement: number;
  engagement_rate: number;
  posted_at: string | null;
  source_keyword: string;
}

interface CastingPostResultsProps {
  posts: MatchedPost[];
  listId?: string | null;
  queryTheme?: string;
}

type SortKey = "total_engagement" | "engagement_rate" | "reactions" | "comments" | "posted_at" | "author_name";
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

export function CastingPostResults({ posts, queryTheme }: CastingPostResultsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "author_name" ? "asc" : "desc");
    }
  }

  const sortedPosts = useMemo(() => {
    if (!sortKey) return posts;
    return [...posts].sort((a, b) => {
      if (sortKey === "author_name") {
        return sortDir === "asc"
          ? (a.author_name || "").localeCompare(b.author_name || "")
          : (b.author_name || "").localeCompare(a.author_name || "");
      }
      if (sortKey === "posted_at") {
        const aVal = a.posted_at ?? "";
        const bVal = b.posted_at ?? "";
        if (!aVal && !bVal) return 0;
        if (!aVal) return 1;
        if (!bVal) return -1;
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aVal = a[sortKey] as number;
      const bVal = b[sortKey] as number;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [posts, sortKey, sortDir]);

  useEffect(() => {
    setSelected(new Set());
  }, [posts]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === sortedPosts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedPosts.map((p) => p.activity_id)));
    }
  }

  function exportCsv() {
    const headers = ["Keyword", "Author", "Author LinkedIn", "Post URL", "Content Preview", "Reactions", "Comments", "Total Engagement", "Engagement Rate %", "Date"];
    const escapeField = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    };
    const rows = sortedPosts.map((p) => [
      p.source_keyword || (queryTheme ? queryTheme.replace(/\n/g, ", ") : ""),
      p.author_name || "",
      p.author_linkedin_url || "",
      p.post_url || "",
      p.content_preview || "",
      String(p.reactions),
      String(p.comments),
      String(p.total_engagement),
      String(p.engagement_rate ?? 0),
      p.posted_at || "",
    ].map(escapeField));
    const csv = [headers.map(escapeField).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `casting-posts-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopySelectedToEnricher() {
    const targets = sortedPosts.filter((p) => selected.has(p.activity_id));
    const urls = targets.map((p) => p.author_linkedin_url).filter(Boolean);
    const uniqueUrls = Array.from(new Set(urls));
    if (uniqueUrls.length === 0) return;

    try {
      const res = await fetch("/api/profiles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: uniqueUrls,
          tags: [],
          ...(queryTheme ? { casting_keywords: queryTheme.replace(/\n/g, ", ") } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Queued ${data.queued} author(s) for enrichment. ${data.duplicates} duplicate(s) skipped.`);
      }
    } catch {
      // ignore
    }
    setSelected(new Set());
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  }

  const headerRow = (
    <tr className="border-b border-gray-200 bg-gray-50 text-left">
      <th className="px-4 py-3">
        <input
          type="checkbox"
          checked={sortedPosts.length > 0 && selected.size === sortedPosts.length}
          onChange={toggleSelectAll}
          className="rounded border-gray-300"
        />
      </th>
      <th className="px-4 py-3 font-medium text-gray-500">#</th>
      <th className="px-4 py-3 font-medium text-gray-500">Keyword</th>
      <SortableHeader label="Author" sortKey="author_name" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <th className="px-4 py-3 font-medium text-gray-500">Post Preview</th>
      <SortableHeader label="Reactions" sortKey="reactions" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <SortableHeader label="Comments" sortKey="comments" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <SortableHeader label="Total" sortKey="total_engagement" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <SortableHeader label="Eng. Rate" sortKey="engagement_rate" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <SortableHeader label="Date" sortKey="posted_at" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
    </tr>
  );

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>{headerRow}</thead>
            <tbody>
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                  No posts found matching your criteria.
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
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-md bg-blue-50 border border-blue-200 px-4 py-2 text-sm">
            <span className="text-blue-700 font-medium">
              {selected.size} selected
            </span>
            <button
              onClick={handleCopySelectedToEnricher}
              className="rounded-md bg-blue-600 px-3 py-1 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              Copy Authors to Enricher
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
              {sortedPosts.map((p, idx) => (
                <tr
                  key={p.activity_id}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${selected.has(p.activity_id) ? "bg-blue-50/50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.activity_id)}
                      onChange={() => toggleSelect(p.activity_id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[150px]">
                    <CollapsibleCell>{p.source_keyword || "—"}</CollapsibleCell>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={p.author_linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {p.author_name || p.author_slug || "—"}
                    </a>
                    {p.author_headline && (
                      <div className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate" title={p.author_headline}>
                        {p.author_headline}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    <CollapsibleCell>{p.content_preview || "—"}</CollapsibleCell>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.reactions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{p.comments.toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.total_engagement.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{p.engagement_rate ? `${p.engagement_rate}%` : "—"}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(p.posted_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <a
                        href={p.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver post"
                        className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/profiles/import", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                urls: [p.author_linkedin_url],
                                tags: [],
                                ...(queryTheme ? { casting_keywords: queryTheme.replace(/\n/g, ", ") } : {}),
                              }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              alert(`Queued ${data.queued} author(s). ${data.duplicates} duplicate(s) skipped.`);
                            }
                          } catch { /* ignore */ }
                        }}
                        title="Copy author to Enricher"
                        className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
