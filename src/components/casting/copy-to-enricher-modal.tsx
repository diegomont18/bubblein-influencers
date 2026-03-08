"use client";

import { useState, useEffect, useRef } from "react";

interface CopyToEnricherModalProps {
  open: boolean;
  profileCount: number;
  onConfirm: (tags: string[]) => void;
  onCancel: () => void;
}

export function CopyToEnricherModal({
  open,
  profileCount,
  onConfirm,
  onCancel,
}: CopyToEnricherModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/profiles/tags")
        .then((r) => r.json())
        .then((d) => setAllTags(d.tags ?? []));
      setSelectedTags([]);
      setTagText("");
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!open) return null;

  const filtered = allTags.filter(
    (t) => t.toLowerCase().includes(tagText.toLowerCase()) && !selectedTags.includes(t)
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (tagText.trim()) {
        addTag(tagText);
        setShowSuggestions(false);
      }
    } else if (e.key === "Backspace" && tagText === "" && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          Copy to Enricher
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {profileCount} profile{profileCount !== 1 ? "s" : ""} will be queued for enrichment.
        </p>

        <div className="relative mt-4" ref={containerRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags (optional)
          </label>
          <div
            className="flex flex-wrap gap-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 cursor-text min-h-[36px] items-center"
            onClick={() => containerRef.current?.querySelector("input")?.focus()}
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
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder={selectedTags.length === 0 ? "Add tags..." : ""}
              className="flex-1 min-w-[80px] outline-none border-none bg-transparent text-sm py-0.5"
            />
          </div>

          {showSuggestions && tagText && filtered.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
              {filtered.map((tag) => (
                <li
                  key={tag}
                  onClick={() => {
                    addTag(tag);
                    setShowSuggestions(false);
                  }}
                  className="cursor-pointer px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedTags)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
