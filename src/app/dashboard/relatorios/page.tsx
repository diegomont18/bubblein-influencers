"use client";

import { useState, useEffect, useCallback } from "react";

interface Mapeamento { id: string; name: string; linkedin_url: string; user_email: string; created_at: string; confirmed_at: string | null; competitors_count: number }
interface Relatorio { id: string; profile_name: string; user_email: string; period_start: string; period_end: string; status: string; posts_count: number; created_at: string }
interface Influencer { id: string; name: string; query_theme: string; user_email: string; profiles_count: number; created_at: string }
interface Lead { id: string; name: string; linkedin_url: string; user_email: string; leads_count: number; created_at: string }

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    complete: "bg-green-100 text-green-700",
    processing: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] ?? "bg-gray-100 text-gray-500"}`}>{status}</span>;
}

function DeleteButton({ onDelete, label }: { onDelete: () => void; label?: string }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <button
      onClick={async () => {
        if (!window.confirm(`Tem certeza que deseja deletar ${label ?? "este item"}?`)) return;
        setDeleting(true);
        await onDelete();
        setDeleting(false);
      }}
      disabled={deleting}
      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
    >
      {deleting ? "..." : "Deletar"}
    </button>
  );
}

const TABS = ["Mapeamento", "Relatórios", "Influencers", "Leads"] as const;

export default function RelatoriosPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Mapeamento");
  const [loading, setLoading] = useState(true);
  const [mapeamentos, setMapeamentos] = useState<Mapeamento[]>([]);
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/relatorios");
      if (res.ok) {
        const data = await res.json();
        setMapeamentos(data.mapeamentos ?? []);
        setRelatorios(data.relatorios ?? []);
        setInfluencers(data.influencers ?? []);
        setLeads(data.leads ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete(type: string, id: string) {
    console.log(`[relatorios-page] handleDelete called with type=${type} id=${id}`);
    try {
      const res = await fetch("/api/dashboard/relatorios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao deletar: ${err.error ?? res.statusText}`);
      }
    } catch (err) {
      alert(`Erro ao deletar: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios & Conteúdo Gerado</h1>
        <p className="mt-1 text-sm text-gray-600">Todos os dados gerados pela plataforma.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const count = t === "Mapeamento" ? mapeamentos.length : t === "Relatórios" ? relatorios.length : t === "Influencers" ? influencers.length : leads.length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {t} <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Mapeamento */}
      {tab === "Mapeamento" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 pr-4 font-semibold text-gray-600">Data</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Usuário</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Empresa</th>
                <th className="py-3 pr-4 font-semibold text-gray-600 text-center">Concorrentes</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Status</th>
                <th className="py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mapeamentos.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                  <td className="py-3 pr-4 text-gray-600 truncate max-w-[180px]">{m.user_email}</td>
                  <td className="py-3 pr-4 font-medium text-gray-900">{m.name || "—"}</td>
                  <td className="py-3 pr-4 text-center text-gray-500">{m.competitors_count}</td>
                  <td className="py-3 pr-4">
                    {m.confirmed_at ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Confirmado</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Pendente</span>
                    )}
                  </td>
                  <td className="py-3"><DeleteButton onDelete={() => handleDelete("mapeamento", m.id)} label={`MAPEAMENTO "${m.name}" (e todos os relatórios associados)`} /></td>
                </tr>
              ))}
              {mapeamentos.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-gray-400">Nenhum mapeamento encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Relatórios */}
      {tab === "Relatórios" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 pr-4 font-semibold text-gray-600">Data</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Usuário</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Empresa</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Período</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Status</th>
                <th className="py-3 pr-4 font-semibold text-gray-600 text-center">Posts</th>
                <th className="py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {relatorios.map((r) => {
                const period = new Date(r.period_start + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                    <td className="py-3 pr-4 text-gray-600 truncate max-w-[180px]">{r.user_email}</td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{r.profile_name}</td>
                    <td className="py-3 pr-4 text-gray-500 capitalize">{period}</td>
                    <td className="py-3 pr-4"><StatusBadge status={r.status} /></td>
                    <td className="py-3 pr-4 text-center text-gray-500">{r.posts_count}</td>
                    <td className="py-3"><DeleteButton onDelete={() => handleDelete("relatorio", r.id)} label={`RELATÓRIO "${r.profile_name} — ${period}" (mapeamento será mantido)`} /></td>
                  </tr>
                );
              })}
              {relatorios.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-400">Nenhum relatório encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Influencers */}
      {tab === "Influencers" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 pr-4 font-semibold text-gray-600">Data</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Usuário</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Busca</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Tema</th>
                <th className="py-3 pr-4 font-semibold text-gray-600 text-center">Perfis</th>
                <th className="py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {influencers.map((inf) => (
                <tr key={inf.id} className="hover:bg-gray-50">
                  <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{formatDateTime(inf.created_at)}</td>
                  <td className="py-3 pr-4 text-gray-600 truncate max-w-[180px]">{inf.user_email}</td>
                  <td className="py-3 pr-4 font-medium text-gray-900 truncate max-w-[200px]">{inf.name || "—"}</td>
                  <td className="py-3 pr-4 text-gray-500 truncate max-w-[150px]">{inf.query_theme || "—"}</td>
                  <td className="py-3 pr-4 text-center text-gray-500">{inf.profiles_count}</td>
                  <td className="py-3"><DeleteButton onDelete={() => handleDelete("influencer", inf.id)} label={inf.name} /></td>
                </tr>
              ))}
              {influencers.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-gray-400">Nenhuma busca de influencers encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Leads */}
      {tab === "Leads" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 pr-4 font-semibold text-gray-600">Data</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Usuário</th>
                <th className="py-3 pr-4 font-semibold text-gray-600">Perfil</th>
                <th className="py-3 pr-4 font-semibold text-gray-600 text-center">Leads</th>
                <th className="py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                  <td className="py-3 pr-4 text-gray-600 truncate max-w-[180px]">{l.user_email}</td>
                  <td className="py-3 pr-4 font-medium text-gray-900">{l.name || "—"}</td>
                  <td className="py-3 pr-4 text-center text-gray-500">{l.leads_count}</td>
                  <td className="py-3"><DeleteButton onDelete={() => handleDelete("lead", l.id)} label={l.name} /></td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-400">Nenhum lead encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
