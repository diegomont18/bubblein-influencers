"use client";

import { useState } from "react";

interface JobResult {
  profileId: string;
  slug?: string;
  status: string;
  error?: string;
  scrapingdog_status?: number;
}

interface ProcessResponse {
  processed: number;
  results: JobResult[];
  errors: number;
}

export function ProcessQueueButton() {
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<ProcessResponse | null>(null);

  async function handleProcess() {
    setLoading(true);
    setLastRun(null);
    try {
      const res = await fetch("/api/enrichment/process", { method: "POST" });
      const data: ProcessResponse = await res.json();
      setLastRun(data);
    } catch {
      setLastRun({ processed: 0, results: [], errors: 1 });
    } finally {
      setLoading(false);
    }
  }

  const summary = lastRun
    ? lastRun.processed === 0
      ? "No jobs to process"
      : `Processed ${lastRun.processed} — ${lastRun.results.filter((r) => r.status === "done").length} done, ${lastRun.results.filter((r) => r.status === "retry").length} retry, ${lastRun.errors} errors`
    : null;

  return (
    <div>
      <div className="flex items-center gap-3">
        {summary && (
          <span
            className={`text-sm ${lastRun && lastRun.errors > 0 ? "text-red-600" : "text-gray-600"}`}
          >
            {summary}
          </span>
        )}
        <button
          onClick={handleProcess}
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Processing..." : "Process Queue"}
        </button>
      </div>
      {lastRun && lastRun.results.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {lastRun.results.map((r, i) => (
            <li key={i} className="text-xs flex items-center gap-1.5">
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
              <span className="font-mono text-gray-600">
                {r.slug ?? r.profileId.slice(0, 8)}
              </span>
              {r.error && <span className="text-red-500">{r.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
