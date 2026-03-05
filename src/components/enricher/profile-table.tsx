"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Filters {
  topic: string;
  company: string;
  role: string;
  followers_min: string;
  followers_max: string;
  status: string;
}

export function ProfileTable() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    topic: "",
    company: "",
    role: "",
    followers_min: "",
    followers_max: "",
    status: "",
  });

  const limit = 20;

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters.topic) params.set("topic", filters.topic);
    if (filters.company) params.set("company", filters.company);
    if (filters.role) params.set("role", filters.role);
    if (filters.followers_min) params.set("followers_min", filters.followers_min);
    if (filters.followers_max) params.set("followers_max", filters.followers_max);
    if (filters.status) params.set("status", filters.status);

    try {
      const res = await fetch(`/api/profiles?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.data);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  async function handleReEnrich(id: string) {
    await fetch(`/api/profiles/${id}/re-enrich`, { method: "POST" });
    fetchProfiles();
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Filters */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            placeholder="Topic"
            value={filters.topic}
            onChange={(e) => updateFilter("topic", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-32"
          />
          <input
            placeholder="Company"
            value={filters.company}
            onChange={(e) => updateFilter("company", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-32"
          />
          <input
            placeholder="Role"
            value={filters.role}
            onChange={(e) => updateFilter("role", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-32"
          />
          <input
            type="number"
            placeholder="Min followers"
            value={filters.followers_min}
            onChange={(e) => updateFilter("followers_min", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-32"
          />
          <input
            type="number"
            placeholder="Max followers"
            value={filters.followers_max}
            onChange={(e) => updateFilter("followers_max", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-32"
          />
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 font-medium text-gray-500">Profile</th>
              <th className="px-4 py-3 font-medium text-gray-500">Headline</th>
              <th className="px-4 py-3 font-medium text-gray-500">Company</th>
              <th className="px-4 py-3 font-medium text-gray-500">Followers</th>
              <th className="px-4 py-3 font-medium text-gray-500">Topics</th>
              <th className="px-4 py-3 font-medium text-gray-500">Frequency</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : profiles.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  No profiles found
                </td>
              </tr>
            ) : (
              profiles.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/enricher/${p.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {p.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        /{p.url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? "—"}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-gray-600">
                    {p.headline ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.company_current ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.followers_count?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.topics ?? []).map((t) => (
                        <span
                          key={t}
                          className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${(p.posting_frequency_score ?? 0) < 3 ? "text-red-600" : "text-gray-600"}`}>
                    {p.posting_frequency_score != null ? p.posting_frequency_score : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.enrichment_status} />
                  </td>
                  <td className="px-4 py-3">
                    {(p.enrichment_status === "done" ||
                      p.enrichment_status === "failed") && (
                      <button
                        onClick={() => handleReEnrich(p.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Re-enrich
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-500">
            {total} profiles total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    done: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}
