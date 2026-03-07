"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckerTable } from "@/components/checker/checker-table";

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

export default function CheckerPage() {
  const [entries, setEntries] = useState<CheckerEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limit = 50;

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/checker?page=${page}&limit=${limit}`);
      const data = await res.json();
      if (res.ok) {
        setEntries(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // silent
    }
  }, [page]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Polling while verification is running
  useEffect(() => {
    if (verifying) {
      pollingRef.current = setInterval(fetchEntries, 2000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [verifying, fetchEntries]);

  function parseCSV(input: string): { name: string; headline: string; url: string }[] {
    const lines = input.split(/\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];

    // Detect header
    const firstLine = lines[0].toLowerCase();
    const hasHeader =
      firstLine.includes("name") || firstLine.includes("url") || firstLine.includes("headline");
    const startIdx = hasHeader ? 1 : 0;

    // Detect column order from header
    let nameIdx = 0;
    let headlineIdx = 1;
    let urlIdx = 2;

    if (hasHeader) {
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
      headers.forEach((h, i) => {
        if (h.includes("name")) nameIdx = i;
        else if (h.includes("headline") || h.includes("title")) headlineIdx = i;
        else if (h.includes("url") || h.includes("linkedin")) urlIdx = i;
      });
    }

    const rows: { name: string; headline: string; url: string }[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      const name = cols[nameIdx] ?? "";
      const headline = cols[headlineIdx] ?? "";
      const url = cols[urlIdx] ?? "";
      if (name || url) {
        rows.push({ name, headline, url });
      }
    }
    return rows;
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setCsvText((prev) => (prev ? prev + "\n" : "") + content.trim());
    e.target.value = "";
  }

  async function handleImport() {
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      setError("No valid rows found. Expected columns: name, headline, url");
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const res = await fetch("/api/checker/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setImportResult(`Imported ${data.imported} entries.`);
      setCsvText("");
      fetchEntries();
    } catch {
      setError("Network error");
    } finally {
      setImporting(false);
    }
  }

  async function handleVerifyAll() {
    setVerifying(true);
    setError(null);

    try {
      let remaining = 1;
      while (remaining > 0) {
        const res = await fetch("/api/checker/verify", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Verification failed");
          break;
        }
        remaining = data.remaining ?? 0;
        await fetchEntries();
        if (data.processed === 0) break;
      }
    } catch {
      setError("Network error during verification");
    } finally {
      setVerifying(false);
      fetchEntries();
    }
  }

  async function handleDelete(ids: string[]) {
    setDeleting(true);
    try {
      await fetch("/api/checker", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      fetchEntries();
    } catch {
      setError("Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteAll() {
    if (!confirm("Delete all checker entries?")) return;
    setDeleting(true);
    try {
      await fetch("/api/checker", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      fetchEntries();
    } catch {
      setError("Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handleExportCSV() {
    try {
      const res = await fetch(`/api/checker?page=1&limit=10000`);
      const data = await res.json();
      if (!res.ok) return;
      const rows: CheckerEntry[] = data.data ?? [];
      const header = "name,headline,original_url,status,verified_url";
      const csvRows = rows.map((r) =>
        [r.name, r.headline, r.original_url, r.status, r.verified_url ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
      const csv = [header, ...csvRows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "checker-export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed");
    }
  }

  const hasPending = entries.some((e) => e.status === "pending");
  const hasChecking = entries.some((e) => e.status === "checking");
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">LinkedIn URL Checker</h1>
        <p className="text-sm text-gray-500 mt-1">
          Import a CSV with name, headline, and LinkedIn URL to verify and fix URLs.
        </p>
      </div>

      {/* Import form */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Import CSV</h3>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"name,headline,url\nJohn Doe,Software Engineer,https://linkedin.com/in/johndoe"}
          rows={5}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            disabled={importing || !csvText.trim()}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {importing ? "Importing..." : "Import"}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
          {importResult && <span className="text-sm text-green-700">{importResult}</span>}
        </div>
      </div>

      {/* Action bar */}
      {entries.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleVerifyAll}
            disabled={verifying || (!hasPending && !hasChecking)}
            className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {verifying ? "Checking..." : "Check All"}
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={deleting}
            className="rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            Delete All
          </button>
          <button
            onClick={handleExportCSV}
            className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Export CSV
          </button>
          <span className="text-sm text-gray-500">
            {total} entries total
            {verifying && " — verification in progress..."}
          </span>
        </div>
      )}

      {/* Results table */}
      <CheckerTable entries={entries} onDelete={handleDelete} deleting={deleting} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
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
      )}
    </div>
  );
}
