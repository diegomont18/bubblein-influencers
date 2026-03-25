"use client";

import { useState, useEffect, useCallback } from "react";

interface Search {
  id: string;
  keywords: string;
  userEmail: string;
  createdAt: string;
  profilesFetched: number;
  resultsRequested: number | string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function BuscasPage() {
  const [searches, setSearches] = useState<Search[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSearches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/searches");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setSearches(data.searches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load searches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buscas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Todas as buscas realizadas por todos os usuários ({searches.length} buscas)
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Carregando...</div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Keywords</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">User Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Data / Hora</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Profiles Fetched</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Results Requested</th>
              </tr>
            </thead>
            <tbody>
              {searches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma busca encontrada.
                  </td>
                </tr>
              ) : (
                searches.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 max-w-[300px]">
                      <div className="truncate" title={s.keywords}>
                        {s.keywords || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.userEmail}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">{s.profilesFetched}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{s.resultsRequested}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
