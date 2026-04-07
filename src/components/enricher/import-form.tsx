"use client";

import { useState, useEffect, useRef } from "react";

interface ImportFormProps {
  onFilterDuplicates?: (slugs: string[]) => void;
}

export function ImportForm({ onFilterDuplicates }: ImportFormProps) {
  const [text, setText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    queued: number;
    requeued?: number;
    duplicates: number;
    duplicate_urls: string[];
    invalid: number;
  } | null>(null);
  const [lastUrls, setLastUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tagContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/profiles/tags")
      .then((r) => r.json())
      .then((d) => setAllTags(d.tags ?? []));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        tagContainerRef.current &&
        !tagContainerRef.current.contains(e.target as Node)
      ) {
        setShowTagSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSuggestions = allTags.filter(
    (t) =>
      t.toLowerCase().includes(tagText.toLowerCase()) &&
      !selectedTags.includes(t)
  );

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
    }
    setTagText("");
  }

  function removeTag(tag: string) {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (tagText.trim()) {
        addTag(tagText);
        setShowTagSuggestions(false);
      }
    } else if (
      e.key === "Backspace" &&
      tagText === "" &&
      selectedTags.length > 0
    ) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  }

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
    setLastUrls(urls);

    try {
      const res = await fetch("/api/profiles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, tags: selectedTags }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Import failed");
        return;
      }

      const data = await res.json();
      setResult(data);
      if (data.queued > 0) {
        setText("");
        setSelectedTags([]);
        setTagText("");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleForceReimport() {
    if (lastUrls.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/profiles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: lastUrls, tags: selectedTags, force: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Import failed");
        return;
      }

      const data = await res.json();
      setResult(data);
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

      {/* Tag pill input */}
      <div className="relative mt-2" ref={tagContainerRef}>
        <div
          className="flex flex-wrap gap-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 cursor-text min-h-[36px] items-center"
          onClick={() => {
            const input = tagContainerRef.current?.querySelector("input");
            input?.focus();
          }}
        >
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="ml-0.5 text-green-600 hover:text-green-900"
              >
                &times;
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagText}
            onChange={(e) => {
              setTagText(e.target.value);
              setShowTagSuggestions(true);
            }}
            onFocus={() => setShowTagSuggestions(true)}
            onKeyDown={handleTagKeyDown}
            placeholder={selectedTags.length === 0 ? "Add tags..." : ""}
            className="flex-1 min-w-[80px] outline-none border-none bg-transparent text-sm py-0.5"
          />
        </div>

        {showTagSuggestions && tagText && filteredSuggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
            {filteredSuggestions.map((tag) => (
              <li
                key={tag}
                onClick={() => {
                  addTag(tag);
                  setShowTagSuggestions(false);
                }}
                className="cursor-pointer px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>

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
          {result.queued > 0 && result.duplicates === 0 && !result.requeued && (
            <p className="text-sm text-green-700">
              Queued {result.queued} profile(s) for enrichment.
            </p>
          )}
          {(result.requeued ?? 0) > 0 && (
            <p className="text-sm text-green-700">
              Re-queued {result.requeued} profile(s) for enrichment.
              {result.queued > 0 && ` Also queued ${result.queued} new profile(s).`}
            </p>
          )}
          {result.queued > 0 && result.duplicates > 0 && (
            <p className="text-sm text-green-700">
              Queued {result.queued} profile(s).{" "}
              <span className="text-amber-600 font-medium">
                {result.duplicates} already enriched.
              </span>
            </p>
          )}
          {result.duplicates > 0 && result.queued === 0 && (
            <div className="text-sm text-amber-600">
              <span className="font-medium">URLs already enriched</span>
              {" — Do you want to "}
              <button
                onClick={handleForceReimport}
                disabled={loading}
                className="font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                import again
              </button>
              {" or "}
              <button
                onClick={() => {
                  if (result.duplicate_urls?.length > 0 && onFilterDuplicates) {
                    onFilterDuplicates(result.duplicate_urls);
                  }
                }}
                className="font-medium text-blue-600 hover:underline"
              >
                see their data in table below
              </button>
              ?
            </div>
          )}
          {result.invalid > 0 && (
            <p className="text-sm text-gray-500">
              {result.invalid} invalid URL(s) ignored.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
