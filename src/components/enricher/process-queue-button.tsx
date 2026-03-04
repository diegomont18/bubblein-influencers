"use client";

import { useState } from "react";

export function ProcessQueueButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleProcess() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/enrichment/process", { method: "POST" });
      const data = await res.json();
      setResult(`Processed ${data.processed} jobs`);
    } catch {
      setResult("Error processing queue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-sm text-gray-600">{result}</span>}
      <button
        onClick={handleProcess}
        disabled={loading}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Processing..." : "Process Queue"}
      </button>
    </div>
  );
}
