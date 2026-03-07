"use client";

import { useState } from "react";

interface CheckerEntry {
  id: string;
  name: string;
  headline: string;
  original_url: string;
  verified_url: string | null;
  status: string;
  search_results: unknown;
  created_at: string;
}

interface CheckerTableProps {
  entries: CheckerEntry[];
  onDelete: (ids: string[]) => void;
  deleting: boolean;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-gray-100 text-gray-700" },
  checking: { label: "Checking...", className: "bg-blue-100 text-blue-700 animate-pulse" },
  valid: { label: "Valid", className: "bg-green-100 text-green-700" },
  found: { label: "Found", className: "bg-amber-100 text-amber-700" },
  not_found: { label: "Not Found", className: "bg-red-100 text-red-700" },
};

export function CheckerTable({ entries, onDelete, deleting }: CheckerTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = entries.length > 0 && selected.size === entries.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
          <span className="text-sm text-gray-600">{selected.size} selected</span>
          <button
            onClick={() => {
              onDelete(Array.from(selected));
              setSelected(new Set());
            }}
            disabled={deleting}
            className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete selected"}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700">Headline</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700">Original URL</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700">Verified URL</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700 w-16">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No entries yet. Import a CSV to get started.
                </td>
              </tr>
            )}
            {entries.map((entry) => {
              const cfg = statusConfig[entry.status] ?? statusConfig.pending;
              return (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggleOne(entry.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-900 max-w-[160px] truncate">
                    {entry.name}
                  </td>
                  <td className="px-4 py-2 text-gray-600 max-w-[200px] truncate">
                    {entry.headline}
                  </td>
                  <td className="px-4 py-2 max-w-[220px] truncate">
                    <a
                      href={entry.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {entry.original_url.replace(/https?:\/\/(www\.)?/, "")}
                    </a>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
                    >
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-2 max-w-[220px] truncate">
                    {entry.verified_url ? (
                      <a
                        href={entry.verified_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`hover:underline ${
                          entry.status === "found" ? "text-amber-600 font-medium" : "text-green-600"
                        }`}
                      >
                        {entry.verified_url.replace(/https?:\/\/(www\.)?/, "")}
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => onDelete([entry.id])}
                      disabled={deleting}
                      className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition-colors"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
