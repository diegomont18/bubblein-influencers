"use client";

import { useState } from "react";

export function ImportForm() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    queued: number;
    duplicates: number;
    duplicate_urls: string[];
    invalid: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);

  function parseUrls(input: string): string[] {
    return input
      .split(/[\n,]/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.includes("linkedin.com"));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const content = await file.text();
    const lines = content.split(/\n/);

    // Detect header row
    const firstLine = lines[0]?.toLowerCase() ?? "";
    const startIdx =
      firstLine.includes("url") || firstLine.includes("linkedin") ? 1 : 0;

    const urls: string[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(",");
      // Find the column that contains a linkedin URL
      const linkedinCol = cols.find((c) => c.includes("linkedin.com"));
      if (linkedinCol) {
        urls.push(linkedinCol.trim().replace(/^["']|["']$/g, ""));
      }
    }

    setText((prev) => (prev ? prev + "\n" : "") + urls.join("\n"));
    e.target.value = "";
  }

  async function handleImport() {
    const urls = parseUrls(text);
    if (urls.length === 0) {
      setError("No LinkedIn URLs found");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setShowDuplicates(false);

    try {
      const res = await fetch("/api/profiles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Import failed");
        return;
      }

      const data = await res.json();
      setResult(data);
      if (data.queued > 0) setText("");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-medium text-gray-900 mb-3">
        Import LinkedIn Profiles
      </h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste LinkedIn profile URLs (one per line)..."
        rows={4}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="mt-3 flex items-center gap-3">
        <label className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
          Upload CSV
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        <button
          onClick={handleImport}
          disabled={loading || !text.trim()}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Importing..." : "Import"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {result && (
        <div className="mt-3 space-y-2">
          {result.queued > 0 && result.duplicates === 0 && (
            <p className="text-sm text-green-700">
              Queued {result.queued} profile(s) for enrichment.
            </p>
          )}
          {result.queued > 0 && result.duplicates > 0 && (
            <p className="text-sm text-green-700">
              Queued {result.queued} profile(s).{" "}
              <span className="text-amber-600 font-medium">
                {result.duplicates} duplicate(s) skipped.
              </span>
            </p>
          )}
          {result.duplicates > 0 && result.queued === 0 && (
            <p className="text-sm font-medium text-amber-600">
              All URLs already exist — nothing imported.
            </p>
          )}
          {result.invalid > 0 && (
            <p className="text-sm text-gray-500">
              {result.invalid} invalid URL(s) ignored.
            </p>
          )}
          {result.duplicates > 0 && result.duplicate_urls?.length > 0 && (
            <div>
              <button
                onClick={() => setShowDuplicates(!showDuplicates)}
                className="text-xs text-amber-600 hover:underline"
              >
                {showDuplicates ? "Hide" : "Show"} duplicate slugs ({result.duplicate_urls.length})
              </button>
              {showDuplicates && (
                <ul className="mt-1 max-h-32 overflow-y-auto rounded border border-amber-200 bg-amber-50 p-2">
                  {result.duplicate_urls.map((slug) => (
                    <li key={slug} className="text-xs text-amber-700 font-mono">
                      /{slug}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
