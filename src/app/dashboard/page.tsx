"use client";

import { useState, useEffect, useCallback } from "react";

interface Stats {
  profiles: { pending: number; processing: number; done: number; failed: number; total: number };
  castingSearches: number;
  castingResults: number;
  leadsScans: number;
  leadsResults: number;
  totalUsers: number;
  newUsersLast7Days: number;
  costs: { today: number; week: number; month: number };
  dailyCosts: { date: string; cost: number }[];
}

interface SearchEntry {
  id: string;
  type: "casting" | "leads";
  userEmail: string;
  summary: string;
  resultsCount: number;
  estimatedCost: number;
  createdAt: string;
  status?: string;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [searches, setSearches] = useState<SearchEntry[]>([]);
  const [searchesTotal, setSearchesTotal] = useState(0);
  const [searchesPage, setSearchesPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const fetchSearches = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/searches?page=${searchesPage}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setSearches(data.searches ?? []);
        setSearchesTotal(data.total ?? 0);
      }
    } catch { /* ignore */ }
  }, [searchesPage]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (activeTab === "history") fetchSearches(); }, [activeTab, fetchSearches]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Loading...</p></div>;
  }

  const maxDailyCost = Math.max(...(stats?.dailyCosts ?? []).map((d) => d.cost), 0.01);
  const searchesTotalPages = Math.ceil(searchesTotal / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">Overview of your platform activity and API costs.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "overview" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Search History
        </button>
      </div>

      {activeTab === "overview" && stats && (
        <div className="space-y-6">
          {/* Row 1: Main stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Profiles" value={stats.profiles.total} sub={`${stats.profiles.done} enriched`} color="bg-blue-100 text-blue-800" />
            <StatCard label="Casting Searches" value={stats.castingSearches} sub={`${stats.castingResults} creators found`} color="bg-purple-100 text-purple-800" />
            <StatCard label="Leads Scans" value={stats.leadsScans} sub={`${stats.leadsResults} leads found`} color="bg-green-100 text-green-800" />
            <a href="/dashboard/users" className="block">
              <StatCard label="Total Users" value={stats.totalUsers} sub={`${stats.newUsersLast7Days} new in last 7 days`} color="bg-gray-100 text-gray-800" />
            </a>
          </div>

          {/* Row 2: Enrichment status */}
          <div className="grid grid-cols-4 gap-4">
            <MiniCard label="Pending" value={stats.profiles.pending} color="text-yellow-600" />
            <MiniCard label="Processing" value={stats.profiles.processing} color="text-blue-600" />
            <MiniCard label="Done" value={stats.profiles.done} color="text-green-600" />
            <MiniCard label="Failed" value={stats.profiles.failed} color="text-red-600" />
          </div>

          {/* Row 3: API costs */}
          <div className="grid grid-cols-3 gap-4">
            <CostCard label="Today" cost={stats.costs.today} />
            <CostCard label="This Week" cost={stats.costs.week} />
            <CostCard label="This Month" cost={stats.costs.month} />
          </div>

          {/* Row 4: 30-day cost graph */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-4">API Cost — Last 30 Days</h3>
            <div className="flex items-end gap-[2px] h-40">
              {stats.dailyCosts.map((d) => {
                const height = maxDailyCost > 0 ? (d.cost / maxDailyCost) * 100 : 0;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div
                      className="w-full bg-blue-500 rounded-t-sm min-h-[2px] transition-all hover:bg-blue-600"
                      style={{ height: `${Math.max(height, 1)}%` }}
                    />
                    <div className="pointer-events-none absolute bottom-full mb-1 rounded bg-gray-800 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {d.date.slice(5)}: {formatCost(d.cost)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>{stats.dailyCosts[0]?.date.slice(5)}</span>
              <span>{stats.dailyCosts[stats.dailyCosts.length - 1]?.date.slice(5)}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Search</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Results</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {searches.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.type === "casting" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                      {s.type === "casting" ? "Casting" : "Leads"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{s.userEmail}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[250px] truncate">{s.summary}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">{s.resultsCount}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">{formatCost(s.estimatedCost)}</td>
                </tr>
              ))}
              {searches.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No searches found</td></tr>
              )}
            </tbody>
          </table>

          {searchesTotalPages > 1 && (
            <div className="flex items-center justify-center border-t border-gray-200 px-4 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSearchesPage((p) => Math.max(1, p - 1))}
                  disabled={searchesPage === 1}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm font-medium text-gray-600">
                  Page {searchesPage} of {searchesTotalPages}
                </span>
                <button
                  onClick={() => setSearchesPage((p) => Math.min(searchesTotalPages, p + 1))}
                  disabled={searchesPage === searchesTotalPages}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>
    </div>
  );
}

function MiniCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function CostCard({ label, cost }: { label: string; cost: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">API Cost — {label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{formatCost(cost)}</p>
    </div>
  );
}
