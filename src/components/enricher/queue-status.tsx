"use client";

import { useState, useEffect } from "react";

interface Stats {
  profiles: { pending: number; processing: number; done: number; failed: number };
  jobs: { queued: number; processing: number; done: number; failed: number };
}

interface JobResult {
  profileId: string;
  slug?: string;
  status: string;
  error?: string;
  scrapingdog_status?: number;
  topics?: string[];
  has_embedding?: boolean;
}

interface ProcessResponse {
  processed: number;
  results: JobResult[];
  errors: number;
}

export function QueueStatus() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [processing, setProcessing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [reEnriching, setReEnriching] = useState(false);
  const [lastRun, setLastRun] = useState<ProcessResponse | null>(null);

  async function fetchStats() {
    try {
      const res = await fetch("/api/profiles/stats");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleProcess() {
    setProcessing(true);
    setLastRun(null);
    try {
      const res = await fetch("/api/enrichment/process", { method: "POST" });
      const data: ProcessResponse = await res.json();
      setLastRun(data);
      await fetchStats();
    } catch (_err) {
      setLastRun({
        processed: 0,
        results: [],
        errors: 1,
      });
    } finally {
      setProcessing(false);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      await fetch("/api/enrichment/retry", { method: "POST" });
      await fetchStats();
    } finally {
      setRetrying(false);
    }
  }

  async function handleReEnrichAll() {
    setReEnriching(true);
    try {
      await fetch("/api/enrichment/re-enrich-all", { method: "POST" });
      await fetchStats();
    } finally {
      setReEnriching(false);
    }
  }

  if (!stats) return <div className="text-sm text-gray-400">Loading stats...</div>;

  const counters = [
    { label: "Queued", value: stats.jobs.queued, color: "text-yellow-600" },
    { label: "Processing", value: stats.jobs.processing, color: "text-blue-600" },
    { label: "Done", value: stats.profiles.done, color: "text-green-600" },
    { label: "Failed", value: stats.jobs.failed, color: "text-red-600" },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Queue Status</h3>
      <div className="flex items-center gap-6 mb-4">
        {counters.map((c) => (
          <div key={c.label} className="text-center">
            <p className={`text-2xl font-semibold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleProcess}
          disabled={processing}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {processing ? "Processing..." : "Process Queue"}
        </button>
        {stats.jobs.failed > 0 && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {retrying ? "Retrying..." : `Retry Failed (${stats.jobs.failed})`}
          </button>
        )}
        {stats.profiles.done > 0 && (
          <button
            onClick={handleReEnrichAll}
            disabled={reEnriching}
            className="rounded-md border border-orange-300 px-4 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50 transition-colors"
          >
            {reEnriching ? "Resetting..." : `Re-enrich All (${stats.profiles.done})`}
          </button>
        )}
      </div>

      {lastRun && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
            Last Run — {lastRun.processed} job(s), {lastRun.errors} error(s)
          </h4>
          {lastRun.results.length === 0 && (
            <p className="text-sm text-gray-400">No jobs to process</p>
          )}
          <ul className="space-y-1">
            {lastRun.results.map((r, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span
                  className={
                    r.status === "done"
                      ? "text-green-600"
                      : r.status === "retry"
                        ? "text-yellow-600"
                        : "text-red-600"
                  }
                >
                  {r.status === "done" ? "✓" : r.status === "retry" ? "↻" : "✗"}
                </span>
                <span className="text-gray-700 font-mono text-xs">
                  {r.slug ?? r.profileId.slice(0, 8)}
                </span>
                {r.status === "done" && (
                  <span className="text-gray-400 text-xs">
                    topics={r.topics?.join(", ") ?? "none"} embed={r.has_embedding ? "yes" : "no"}
                  </span>
                )}
                {r.error && (
                  <span className="text-red-500 text-xs">
                    {r.scrapingdog_status ? `[${r.scrapingdog_status}] ` : ""}
                    {r.error}
                  </span>
                )}
                {r.status === "retry" && !r.error && (
                  <span className="text-yellow-500 text-xs">
                    {r.scrapingdog_status === 202 ? "async processing — will retry" : "re-queued"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
