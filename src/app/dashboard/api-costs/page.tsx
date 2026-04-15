"use client";

import { useState, useEffect, useCallback } from "react";

interface CostRow {
  id: string;
  user_id: string | null;
  user_email: string;
  source: string;
  search_id: string | null;
  provider: string;
  operation: string;
  estimated_cost: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface GroupedRow {
  provider: string;
  source: string;
  operation: string;
  user_email: string;
  total_cost: number;
  total_credits: number;
  call_count: number;
  last_used: string;
}

interface Totals {
  total: number;
  byProvider: Record<string, number>;
  bySource: Record<string, number>;
}

interface ApifyUsageState {
  monthly_usage_usd: number;
  max_monthly_usage_usd: number;
  billing_cycle_start: string | null;
  billing_cycle_end: string | null;
  checked_at: string;
  pct: number;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

const PROVIDERS = ["apify", "openrouter"];
const SOURCES = ["casting", "leads", "enrichment"];

export default function ApiCostsPage() {
  const [activeTab, setActiveTab] = useState<"grouped" | "detailed">("grouped");
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [grouped, setGrouped] = useState<GroupedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<Totals>({ total: 0, byProvider: {}, bySource: {} });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [filterProvider, setFilterProvider] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [apifyUsage, setApifyUsage] = useState<ApifyUsageState | null>(null);
  const [apifyRefreshing, setApifyRefreshing] = useState(false);

  const fetchApifyUsage = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setApifyRefreshing(true);
    try {
      const url = forceRefresh
        ? "/api/dashboard/apify-usage?refresh=1"
        : "/api/dashboard/apify-usage";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.state) setApifyUsage(data.state);
      }
    } catch { /* ignore */ }
    finally { setApifyRefreshing(false); }
  }, []);

  useEffect(() => { fetchApifyUsage(false); }, [fetchApifyUsage]);

  const limit = 50;

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filterProvider) params.set("provider", filterProvider);
    if (filterSource) params.set("source", filterSource);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    try {
      const res = await fetch(`/api/dashboard/api-costs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCosts(data.costs ?? []);
        setGrouped(data.grouped ?? []);
        setTotal(data.total ?? 0);
        setTotals(data.totals ?? { total: 0, byProvider: {}, bySource: {} });
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, filterProvider, filterSource, dateFrom, dateTo]);

  useEffect(() => { fetchCosts(); }, [fetchCosts]);

  function handleFilterChange() {
    setPage(1);
  }

  function exportCsv() {
    const headers = ["Data", "Usuário", "Source", "Provider", "Operação", "Custo (USD)", "Search ID", "Metadata"];
    const escape = (v: string) => v.includes(",") || v.includes('"') || v.includes("\n") ? '"' + v.replace(/"/g, '""') + '"' : v;
    const rows = costs.map((r) => [
      formatDate(r.created_at), r.user_email, r.source, r.provider, r.operation,
      r.estimated_cost.toFixed(6), r.search_id ?? "",
      r.metadata ? JSON.stringify(r.metadata) : "",
    ].map(escape));
    const csv = [headers.map(escape).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `api-costs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const totalPages = Math.ceil(total / limit);

  const providerColor: Record<string, string> = {
    apify: "bg-blue-100 text-blue-800",
    openrouter: "bg-purple-100 text-purple-800",
  };

  const sourceColor: Record<string, string> = {
    casting: "bg-purple-100 text-purple-700",
    leads: "bg-green-100 text-green-700",
    enrichment: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Costs</h1>
        <p className="text-sm text-gray-500 mt-1">Detalhamento de todas as chamadas de API com custos estimados.</p>
      </div>

      {/* Apify billing-cycle usage */}
      {apifyUsage && (() => {
        const pct = apifyUsage.pct ?? 0;
        const usd = apifyUsage.monthly_usage_usd ?? 0;
        const max = apifyUsage.max_monthly_usage_usd ?? 0;
        const barColor =
          pct >= 95 ? "bg-red-600"
          : pct >= 85 ? "bg-orange-500"
          : pct >= 70 ? "bg-yellow-500"
          : "bg-green-500";
        const textColor =
          pct >= 95 ? "text-red-700"
          : pct >= 85 ? "text-orange-700"
          : pct >= 70 ? "text-yellow-700"
          : "text-green-700";
        const fmtDate = (iso: string | null) =>
          iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";
        const ageMinutes = Math.round((Date.now() - new Date(apifyUsage.checked_at).getTime()) / 60000);
        return (
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-semibold text-gray-900">Apify — uso do ciclo mensal</p>
                  {pct >= 95 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">BUSCAS BLOQUEADAS</span>}
                  {pct >= 85 && pct < 95 && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">ATENÇÃO</span>}
                  {pct >= 70 && pct < 85 && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">AVISO</span>}
                </div>
                <div className="flex items-baseline gap-3">
                  <span className={`text-2xl font-bold ${textColor}`}>${usd.toFixed(2)}</span>
                  <span className="text-sm text-gray-500">/ ${max.toFixed(2)}</span>
                  <span className={`text-sm font-semibold ${textColor}`}>({pct.toFixed(1)}%)</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Ciclo: {fmtDate(apifyUsage.billing_cycle_start)} – {fmtDate(apifyUsage.billing_cycle_end)}
                  {" · "}
                  Atualizado há {ageMinutes < 1 ? "<1" : ageMinutes} min
                </p>
              </div>
              <button
                onClick={() => fetchApifyUsage(true)}
                disabled={apifyRefreshing}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {apifyRefreshing ? "Atualizando…" : "Atualizar agora"}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{formatCost(totals.total)}</p>
        </div>
        {PROVIDERS.map((p) => (
          <div key={p} className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500 capitalize">{p}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatCost(totals.byProvider[p] ?? 0)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Provider</label>
            <select value={filterProvider} onChange={(e) => { setFilterProvider(e.target.value); handleFilterChange(); }} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
              <option value="">Todos</option>
              {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Source</label>
            <select value={filterSource} onChange={(e) => { setFilterSource(e.target.value); handleFilterChange(); }} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
              <option value="">Todos</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">De</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); handleFilterChange(); }} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Até</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); handleFilterChange(); }} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <button onClick={exportCsv} className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("grouped")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "grouped" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Por Operação
        </button>
        <button
          onClick={() => setActiveTab("detailed")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "detailed" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Detalhado
        </button>
      </div>

      {/* Grouped Table */}
      {activeTab === "grouped" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {loading ? (
            <div className="px-6 py-12 text-center text-gray-400">Carregando...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Usuário</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Provider</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Operação</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Chamadas</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Créditos</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Custo Total</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Custo Médio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Último Uso</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-100 last:border-0 hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setFilterProvider(r.provider);
                      setFilterSource(r.source);
                      setActiveTab("detailed");
                      setPage(1);
                    }}
                    title="Clique para ver detalhes"
                  >
                    <td className="px-4 py-3 text-gray-700 text-xs">{r.user_email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${providerColor[r.provider] ?? "bg-gray-100 text-gray-600"}`}>{r.provider}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sourceColor[r.source] ?? "bg-gray-100 text-gray-600"}`}>{r.source}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs font-mono">{r.operation}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{r.call_count}</td>
                    <td className="px-4 py-3 text-right font-medium text-orange-600">{r.total_credits > 0 ? r.total_credits : "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCost(r.total_cost)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{formatCost(r.call_count > 0 ? r.total_cost / r.call_count : 0)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(r.last_used)}</td>
                  </tr>
                ))}
                {grouped.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Detailed Table */}
      {activeTab === "detailed" && (
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-700">Data</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Provider</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Operação</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Custo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{r.user_email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sourceColor[r.source] ?? "bg-gray-100 text-gray-600"}`}>{r.source}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${providerColor[r.provider] ?? "bg-gray-100 text-gray-600"}`}>{r.provider}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-mono">{r.operation}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCost(Number(r.estimated_cost))}</td>
                  <td className="px-4 py-3">
                    {r.metadata && (
                      <button
                        onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {expandedRow === r.id ? "Fechar" : "Ver"}
                      </button>
                    )}
                    {expandedRow === r.id && r.metadata && (
                      <pre className="mt-2 text-[10px] bg-gray-100 rounded p-2 max-w-xs overflow-x-auto text-gray-600">
                        {JSON.stringify(r.metadata, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
              {costs.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center border-t border-gray-200 px-4 py-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Previous</button>
              <span className="px-4 py-2 text-sm font-medium text-gray-600">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      )}

      <p className="text-center text-xs text-gray-400">{total} registros no total</p>
    </div>
  );
}
