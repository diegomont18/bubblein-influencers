"use client";

import React, { useState, useEffect, useCallback } from "react";

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
  account_id?: number;
  account_label?: string;
}

interface ApifyAccount {
  id: number;
  label: string;
  env_key: string;
  enabled: boolean;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatCostBrl(cost: number): string {
  const brl = cost * 5;
  return `$${cost.toFixed(4)} (R$${brl.toFixed(2)})`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

const PROVIDERS = ["apify", "serper", "openrouter"];
const SOURCES = ["casting", "leads", "enrichment", "sol"];

export default function ApiCostsPage() {
  const [mainTab, setMainTab] = useState<"costs" | "budget">("costs");
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
  const [expandedGrouped, setExpandedGrouped] = useState<string | null>(null);
  const [groupedDetails, setGroupedDetails] = useState<Record<string, CostRow[]>>({});

  const [apifyUsage, setApifyUsage] = useState<ApifyUsageState | null>(null);
  const [apifyUsageAll, setApifyUsageAll] = useState<ApifyUsageState[]>([]);
  const [apifyRefreshing, setApifyRefreshing] = useState(false);
  const [apifyAccounts, setApifyAccounts] = useState<ApifyAccount[]>([]);
  const [togglingAccount, setTogglingAccount] = useState<number | null>(null);

  const fetchApifyAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/apify-accounts");
      if (res.ok) {
        const data = await res.json();
        setApifyAccounts(data.accounts ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const toggleAccount = useCallback(async (id: number, enabled: boolean) => {
    setTogglingAccount(id);
    try {
      const res = await fetch("/api/dashboard/apify-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (res.ok) {
        setApifyAccounts((prev) => prev.map((a) => a.id === id ? { ...a, enabled } : a));
      }
    } catch { /* ignore */ }
    finally { setTogglingAccount(null); }
  }, []);

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
        if (data.states) setApifyUsageAll(data.states);
      }
    } catch { /* ignore */ }
    finally { setApifyRefreshing(false); }
  }, []);

  useEffect(() => { fetchApifyUsage(false); fetchApifyAccounts(); }, [fetchApifyUsage, fetchApifyAccounts]);

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
    serper: "bg-green-100 text-green-800",
    openrouter: "bg-purple-100 text-purple-800",
  };

  const sourceColor: Record<string, string> = {
    casting: "bg-purple-100 text-purple-700",
    leads: "bg-green-100 text-green-700",
    enrichment: "bg-yellow-100 text-yellow-700",
    sol: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Costs</h1>
        <p className="text-sm text-gray-500 mt-1">Detalhamento de todas as chamadas de API com custos estimados.</p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setMainTab("costs")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${mainTab === "costs" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Custos
        </button>
        <button
          onClick={() => setMainTab("budget")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${mainTab === "budget" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Orçamento
        </button>
      </div>

      {mainTab === "costs" && (<>
      {/* Apify accounts toggles */}
      {apifyAccounts.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Contas Apify</p>
            <button
              onClick={() => fetchApifyUsage(true)}
              disabled={apifyRefreshing}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {apifyRefreshing ? "Atualizando…" : "Atualizar uso"}
            </button>
          </div>
          <div className="space-y-3">
            {apifyAccounts.map((account) => {
              const usage = apifyUsageAll.find((u) => u.account_id === account.id);
              const pct = usage?.pct ?? 0;
              const usd = usage?.monthly_usage_usd ?? 0;
              const max = usage?.max_monthly_usage_usd ?? 0;
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
              return (
                <div key={account.id} className={`rounded-lg border p-4 ${account.enabled ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-gray-50"}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-medium text-gray-900">{account.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${account.enabled ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                          {account.enabled ? "ATIVA" : "DESATIVADA"}
                        </span>
                        {account.enabled && pct >= 95 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">SEM CREDITOS</span>}
                      </div>
                      {usage && (
                        <div className="mt-1">
                          <div className="flex items-baseline gap-2 text-sm">
                            <span className={`font-semibold ${textColor}`}>${usd.toFixed(2)}</span>
                            <span className="text-gray-400">/ ${max.toFixed(2)}</span>
                            <span className={`text-xs font-semibold ${textColor}`}>({pct.toFixed(1)}%)</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                            <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <p className="mt-1 text-[10px] text-gray-400">
                            Ciclo: {fmtDate(usage.billing_cycle_start)} – {fmtDate(usage.billing_cycle_end)}
                          </p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleAccount(account.id, !account.enabled)}
                      disabled={togglingAccount === account.id}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 ${account.enabled ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${account.enabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Apify billing-cycle usage (legacy single-account fallback) */}
      {apifyAccounts.length === 0 && apifyUsage && (() => {
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
          <p className="text-xs text-gray-400 mt-0.5">R${(totals.total * 5).toFixed(2)}</p>
        </div>
        {PROVIDERS.map((p) => (
          <div key={p} className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500 capitalize">{p}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatCost(totals.byProvider[p] ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">R${((totals.byProvider[p] ?? 0) * 5).toFixed(2)}</p>
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
                {grouped.map((r, i) => {
                  const rowKey = `${r.provider}-${r.source}-${r.operation}-${r.user_email}`;
                  const isExpanded = expandedGrouped === rowKey;
                  const details = groupedDetails[rowKey];
                  return (
                    <React.Fragment key={i}>
                      <tr
                        className={`border-b border-gray-100 last:border-0 hover:bg-blue-50 cursor-pointer transition-colors ${isExpanded ? "bg-blue-50" : ""}`}
                        onClick={async () => {
                          if (isExpanded) {
                            setExpandedGrouped(null);
                            return;
                          }
                          setExpandedGrouped(rowKey);
                          if (!groupedDetails[rowKey]) {
                            try {
                              const params = new URLSearchParams({ page: "1", limit: "5", provider: r.provider, source: r.source });
                              const res = await fetch(`/api/dashboard/api-costs?${params}`);
                              if (res.ok) {
                                const data = await res.json();
                                const filtered = (data.costs as CostRow[]).filter((c) => c.operation === r.operation);
                                setGroupedDetails((prev) => ({ ...prev, [rowKey]: filtered.length > 0 ? filtered : data.costs.slice(0, 3) }));
                              }
                            } catch { /* ignore */ }
                          }
                        }}
                        title="Clique para expandir detalhes"
                      >
                        <td className="px-4 py-3 text-gray-700 text-xs">
                          <span className="flex items-center gap-1.5">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 text-gray-400 ${isExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
                            {r.user_email}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${providerColor[r.provider] ?? "bg-gray-100 text-gray-600"}`}>{r.provider}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sourceColor[r.source] ?? "bg-gray-100 text-gray-600"}`}>{r.source}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-xs font-mono">{r.operation}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{r.call_count}</td>
                        <td className="px-4 py-3 text-right font-medium text-orange-600">{r.total_credits > 0 ? r.total_credits : "—"}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCostBrl(r.total_cost)}</td>
                        <td className="px-4 py-3 text-right text-gray-500 text-xs">{formatCostBrl(r.call_count > 0 ? r.total_cost / r.call_count : 0)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(r.last_used)}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                            {!details ? (
                              <p className="text-xs text-gray-400">Carregando...</p>
                            ) : details.length === 0 ? (
                              <p className="text-xs text-gray-400">Sem detalhes disponíveis</p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Últimas chamadas</p>
                                {details.map((d) => (
                                  <div key={d.id} className="flex items-start gap-4 text-xs bg-white rounded-lg border border-gray-200 px-3 py-2">
                                    <span className="text-gray-400 whitespace-nowrap shrink-0">{formatDate(d.created_at)}</span>
                                    <span className="text-gray-700 font-mono">{formatCost(Number(d.estimated_cost))}</span>
                                    {d.metadata && (
                                      <span className="text-gray-500 break-all flex-1">
                                        {Object.entries(d.metadata).map(([k, v]) => (
                                          <span key={k} className="inline-block mr-3">
                                            <span className="text-gray-400">{k}:</span>{" "}
                                            <span className="text-gray-700">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                                          </span>
                                        ))}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCostBrl(Number(r.estimated_cost))}</td>
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
      </>)}

      {/* Budget tab */}
      {mainTab === "budget" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Estimativa de custo por relatório Share of LinkedIn</h2>
            <p className="text-sm text-gray-500 mt-1">Simulação de quanto custa gerar um relatório mensal completo como o exemplo TOTVS vs SAP vs Oracle</p>
          </div>

          {/* Tabela de operações */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">Operações necessárias por relatório</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Operação</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">API</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Custo unitário</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { op: "Buscar perfil LinkedIn", api: "Apify", cost: "$0.004", desc: "Para cada colaborador monitorado" },
                  { op: "Buscar posts do perfil", api: "Apify", cost: "$0.02", desc: "Posts recentes de cada colaborador" },
                  { op: "Buscar engajadores dos posts", api: "Apify", cost: "$0.0012/item", desc: "Reações + comentários (supreme_coder)" },
                  { op: "Buscar perfil de engajadores", api: "Apify", cost: "$0.004", desc: "Para identificar se é decisor (ICP match)" },
                  { op: "Buscar empresa LinkedIn", api: "Apify", cost: "$0.005", desc: "Para enriquecer dados de empresa" },
                  { op: "SERP Google", api: "Apify", cost: "$0.0035", desc: "Para encontrar slugs de empresas" },
                  { op: "SERP Share of Voice", api: "Apify", cost: "$0.0035", desc: "Buscar menções externas por keyword de cada empresa" },
                  { op: "Buscar perfil do mencionador", api: "Apify", cost: "$0.004", desc: "Perfil de quem mencionou a marca (identificar influenciadores)" },
                  { op: "Classificação ICP (IA)", api: "OpenRouter", cost: "$0.0002", desc: "Scoring de match com ICP por engajador" },
                  { op: "Análise temática (IA)", api: "OpenRouter", cost: "$0.001", desc: "Classificação de temas por post" },
                  { op: "Análise de sentimento (IA)", api: "OpenRouter", cost: "$0.0005", desc: "Classificar menções como positivo/neutro/negativo" },
                ].map((r) => (
                  <tr key={r.op}>
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{r.op}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${r.api === "Apify" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}>{r.api}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700">{r.cost}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cenários */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Cenários de custo mensal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  name: "Starter", badge: "Sua marca + 1 concorrente", highlight: false,
                  collabs: 4, postsPerCollab: 8, engagersPerPost: 50,
                  breakdown: [
                    { op: "Perfis LinkedIn", calc: "4 × $0.004", cost: 0.016 },
                    { op: "Posts dos perfis", calc: "4 × $0.02", cost: 0.08 },
                    { op: "Engajadores", calc: "32 posts × 50 × $0.0012", cost: 1.92 },
                    { op: "Perfil engajadores", calc: "32 × 50 × $0.004", cost: 6.40 },
                    { op: "ICP scoring", calc: "32 × 50 × $0.0002", cost: 0.32 },
                    { op: "Análise temática", calc: "32 posts × $0.001", cost: 0.032 },
                    { op: "SERP Share of Voice", calc: "4 kw × 2 empresas × $0.0035", cost: 0.028 },
                    { op: "Perfil mencionadores", calc: "~10 menções × $0.004", cost: 0.04 },
                    { op: "Sentimento (IA)", calc: "~10 menções × $0.0005", cost: 0.005 },
                  ],
                },
                {
                  name: "Professional", badge: "Sua marca + 3 concorrentes", highlight: true,
                  collabs: 16, postsPerCollab: 8, engagersPerPost: 50,
                  breakdown: [
                    { op: "Perfis LinkedIn", calc: "16 × $0.004", cost: 0.064 },
                    { op: "Posts dos perfis", calc: "16 × $0.02", cost: 0.32 },
                    { op: "Engajadores", calc: "128 posts × 50 × $0.0012", cost: 7.68 },
                    { op: "Perfil engajadores", calc: "128 × 50 × $0.004", cost: 25.60 },
                    { op: "ICP scoring", calc: "128 × 50 × $0.0002", cost: 1.28 },
                    { op: "Análise temática", calc: "128 posts × $0.001", cost: 0.128 },
                    { op: "SERP Share of Voice", calc: "5 kw × 4 empresas × $0.0035", cost: 0.07 },
                    { op: "Perfil mencionadores", calc: "~30 menções × $0.004", cost: 0.12 },
                    { op: "Sentimento (IA)", calc: "~30 menções × $0.0005", cost: 0.015 },
                  ],
                },
                {
                  name: "Business", badge: "Sua marca + 6 concorrentes", highlight: false,
                  collabs: 32, postsPerCollab: 8, engagersPerPost: 50,
                  breakdown: [
                    { op: "Perfis LinkedIn", calc: "32 × $0.004", cost: 0.128 },
                    { op: "Posts dos perfis", calc: "32 × $0.02", cost: 0.64 },
                    { op: "Engajadores", calc: "256 posts × 50 × $0.0012", cost: 15.36 },
                    { op: "Perfil engajadores", calc: "256 × 50 × $0.004", cost: 51.20 },
                    { op: "ICP scoring", calc: "256 × 50 × $0.0002", cost: 2.56 },
                    { op: "Análise temática", calc: "256 posts × $0.001", cost: 0.256 },
                    { op: "SERP Share of Voice", calc: "5 kw × 7 empresas × $0.0035", cost: 0.1225 },
                    { op: "Perfil mencionadores", calc: "~50 menções × $0.004", cost: 0.20 },
                    { op: "Sentimento (IA)", calc: "~50 menções × $0.0005", cost: 0.025 },
                  ],
                },
                {
                  name: "Enterprise", badge: "Alta atividade", highlight: false,
                  collabs: 32, postsPerCollab: 15, engagersPerPost: 100,
                  breakdown: [
                    { op: "Perfis LinkedIn", calc: "32 × $0.004", cost: 0.128 },
                    { op: "Posts dos perfis", calc: "32 × $0.02", cost: 0.64 },
                    { op: "Engajadores", calc: "480 posts × 100 × $0.0012", cost: 57.60 },
                    { op: "Perfil engajadores", calc: "480 × 100 × $0.004", cost: 192.00 },
                    { op: "ICP scoring", calc: "480 × 100 × $0.0002", cost: 9.60 },
                    { op: "Análise temática", calc: "480 posts × $0.001", cost: 0.48 },
                    { op: "SERP Share of Voice", calc: "5 kw × 7 empresas × $0.0035", cost: 0.1225 },
                    { op: "Perfil mencionadores", calc: "~100 menções × $0.004", cost: 0.40 },
                    { op: "Sentimento (IA)", calc: "~100 menções × $0.0005", cost: 0.05 },
                  ],
                },
              ].map((scenario) => {
                const totalCost = scenario.breakdown.reduce((sum, b) => sum + b.cost, 0);
                return (
                  <div key={scenario.name} className={`rounded-lg border bg-white p-5 ${scenario.highlight ? "border-blue-400 ring-1 ring-blue-100" : "border-gray-200"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-base font-bold text-gray-900">{scenario.name}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scenario.highlight ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{scenario.badge}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500 mb-4">
                      <span>{scenario.collabs} colaboradores</span>
                      <span>~{scenario.postsPerCollab} posts/mês cada</span>
                      <span>~{scenario.engagersPerPost} engajadores/post</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-2xl font-bold text-green-600">${totalCost.toFixed(2)}</span>
                      <span className="text-sm text-gray-400">(R${(totalCost * 5).toFixed(2)})</span>
                      <span className="text-sm text-gray-500">/mês</span>
                    </div>
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 select-none flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90"><path d="m9 18 6-6-6-6"/></svg>
                        Ver breakdown detalhado
                      </summary>
                      <div className="mt-3 space-y-1.5">
                        {scenario.breakdown.map((b) => (
                          <div key={b.op} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">{b.op} <span className="text-gray-400">({b.calc})</span></span>
                            <span className="font-mono text-gray-800">${b.cost.toFixed(3)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-xs font-bold pt-1.5 border-t border-gray-200">
                          <span className="text-gray-900">Total</span>
                          <span className="text-green-600">${totalCost.toFixed(2)} <span className="text-gray-400 font-normal">(R${(totalCost * 5).toFixed(2)})</span></span>
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Custos estimados baseados nos preços atuais dos provedores. Inclui: monitoramento de colaboradores, análise de engajamento (ICP), Share of Voice (menções externas), identificação de influenciadores e análise de sentimento. Engajadores e mencionadores verificados são cacheados por 48h, reduzindo custos em meses subsequentes.
          </p>
        </div>
      )}
    </div>
  );
}
