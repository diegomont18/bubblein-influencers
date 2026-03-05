"use client";

import { useState, useEffect, useCallback } from "react";

interface JobRow {
  id: string;
  profile_id: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  scrapingdog_status: number | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  profiles: { url: string; name: string | null } | null;
}

export function JobsTable() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const limit = 20;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/enrichment/jobs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.data);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const totalPages = Math.ceil(total / limit);

  function extractSlug(url: string | undefined) {
    if (!url) return "—";
    return url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? url;
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const statusColors: Record<string, string> = {
    queued: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    done: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Filter */}
      <div className="border-b border-gray-200 p-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="processing">Processing</option>
          <option value="done">Done</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Count */}
      <div className="px-4 py-2 text-sm text-gray-600">
        {total} job{total !== 1 ? "s" : ""}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-500">Profile</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">Attempt</th>
              <th className="px-4 py-3 font-medium text-gray-500">SD Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">Error</th>
              <th className="px-4 py-3 font-medium text-gray-500">Queued</th>
              <th className="px-4 py-3 font-medium text-gray-500">Completed</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No jobs found
                </td>
              </tr>
            ) : (
              jobs.map((j) => (
                <tr key={j.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                    {j.profiles?.name ?? extractSlug(j.profiles?.url)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[j.status] ?? "bg-gray-100 text-gray-800"}`}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{j.attempt_count}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {j.scrapingdog_status ?? "—"}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-red-500 text-xs">
                    {j.last_error ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(j.queued_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(j.completed_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end border-t border-gray-200 px-4 py-3">
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
