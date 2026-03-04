"use client";

import { useState, useEffect } from "react";

interface Stats {
  profiles: { pending: number; processing: number; done: number; failed: number };
  jobs: { queued: number; processing: number; done: number; failed: number };
}

export function QueueStatus() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [processing, setProcessing] = useState(false);
  const [retrying, setRetrying] = useState(false);

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
    try {
      await fetch("/api/enrichment/process", { method: "POST" });
      await fetchStats();
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
      </div>
    </div>
  );
}
