"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScopeFilter } from "@/components/share/scope-filter";
import { ShareButton } from "@/components/share/share-button";
import type { AccessRole, Scope } from "@/lib/resource-access";

interface AnalyzedProfile {
  id: string;
  name: string;
  headline: string;
  linkedin_url: string;
  created_at: string;
  latest_report: { status: string; period_start: string; period_end: string } | null;
  accessRole?: AccessRole;
  owner?: { id: string; email: string; name: string | null } | null;
}

export default function LeadsGenerationPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [country, setCountry] = useState("br");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalyzedProfile[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(["", ""]);
  const [showNoCompetitorModal, setShowNoCompetitorModal] = useState(false);
  const [scope, setScope] = useState<Scope>("all");
  const [formExpanded, setFormExpanded] = useState(false);

  useEffect(() => {
    setHistoryLoading(true);
    fetch(`/api/leads-generation/profiles?scope=${scope}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.profiles) {
          setHistory(d.profiles);
          if (d.profiles.length === 0) setFormExpanded(true);
        }
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [scope]);

  useEffect(() => {
    const pendingUrl = localStorage.getItem("pendingLinkedinUrl");
    if (pendingUrl) {
      localStorage.removeItem("pendingLinkedinUrl");
      setUrl(pendingUrl);
      setTimeout(() => {
        const analyzeBtn = document.getElementById("analyze-btn");
        if (analyzeBtn) analyzeBtn.click();
      }, 500);
    }
  }, []);

  async function handleDelete(profileId: string, profileName: string) {
    const confirmed = window.confirm(
      `Tem certeza que deseja apagar a análise de "${profileName || "este perfil"}"? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setDeletingId(profileId);
    try {
      const res = await fetch(`/api/leads-generation/profiles?id=${profileId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Erro ao apagar. Tente novamente.");
        return;
      }
      setHistory((prev) => prev.filter((p) => p.id !== profileId));
    } catch {
      alert("Erro de conexão. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  function validateCompanyUrl(u: string): string | null {
    if (/linkedin\.com\/in\//.test(u)) return "perfil pessoal";
    if (/linkedin\.com\/products\//.test(u)) return "produto";
    if (/linkedin\.com\/showcase\//.test(u)) return "showcase";
    if (!/linkedin\.com\/company\/[^/?#]+/.test(u)) return "formato inválido";
    return null;
  }

  async function handleAnalyze(skipCompetitorCheck = false) {
    const trimmed = url.trim();
    if (!trimmed || !trimmed.includes("linkedin.com")) {
      setError("Insira uma URL válida do LinkedIn");
      return;
    }
    const mainErr = validateCompanyUrl(trimmed);
    if (mainErr === "perfil pessoal") {
      setError("Esta é uma URL de perfil pessoal. O Share of LinkedIn analisa páginas de empresa. Use o formato: linkedin.com/company/nome-da-empresa");
      return;
    }
    if (mainErr) {
      setError(`URL ${mainErr}. Use uma URL de página de empresa no formato: linkedin.com/company/nome-da-empresa`);
      return;
    }

    // Validate competitor URLs
    const filledCompetitors = competitorUrls.map((u) => u.trim()).filter(Boolean);
    for (const cu of filledCompetitors) {
      if (!cu.includes("linkedin.com")) {
        setError(`Concorrente "${cu}" não é uma URL do LinkedIn. Use o formato: linkedin.com/company/nome-da-empresa`);
        return;
      }
      const cErr = validateCompanyUrl(cu);
      if (cErr) {
        setError(`Concorrente "${cu}" é uma URL de ${cErr}. Use: linkedin.com/company/nome-da-empresa`);
        return;
      }
    }

    // Warn if no competitors
    if (filledCompetitors.length === 0 && !skipCompetitorCheck) {
      setShowNoCompetitorModal(true);
      return;
    }

    setError(null);
    setShowNoCompetitorModal(false);
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300_000);

      const res = await fetch("/api/leads-generation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrl: url.trim(), country, competitorUrls: filledCompetitors }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao mapear empresa. Tente novamente.");
        return;
      }

      const data = await res.json();
      if (data.error && !data.profile) {
        setError(data.error);
        return;
      }
      if (data.error) {
        console.warn("[share-of-linkedin] Partial: ", data.error);
      }
      router.push(`/casting/share-of-linkedin/${data.profile.id}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("O mapeamento esta sendo processado em segundo plano. Voce pode sair desta pagina e voltar em alguns minutos — os dados serao salvos automaticamente.");
        // Try to reload profiles after a delay to see if it completed
        setTimeout(async () => {
          try {
            const res = await fetch("/api/leads-generation/profiles");
            if (res.ok) { const d = await res.json(); setHistory(d.profiles ?? []); }
          } catch { /* ignore */ }
        }, 15000);
      } else {
        setError("Erro de conexão. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Collapsed form button */}
      {!formExpanded && (
        <button
          onClick={() => setFormExpanded(true)}
          className="w-full max-w-2xl mx-auto group rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-[#ca98ff]/20 hover:border-[#ca98ff]/50 hover:bg-[#ca98ff]/[0.06] transition-all py-4 px-6 flex items-center justify-between font-[family-name:var(--font-lexend)]"
        >
          <span className="text-sm text-white/60">Mapear nova empresa</span>
          <span className="text-sm font-bold text-[#ca98ff] uppercase tracking-wider group-hover:translate-x-1 transition-transform">+ Nova análise →</span>
        </button>
      )}

      {/* Hero + Input card — collapsible */}
      {formExpanded && (<>
      <div className="flex flex-col items-center text-center pt-8 pb-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-6 font-[family-name:var(--font-lexend)]">
          Mapeie o <span className="bg-gradient-to-r from-[#ca98ff] to-[#e197fc] bg-clip-text text-transparent">Share of LinkedIn</span>
          <br className="hidden md:block" />
          da sua empresa
        </h1>
        <div className="text-[#adaaaa] text-base leading-relaxed flex flex-col gap-2 font-medium mb-10">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ca98ff]/60" />
            <p>concorrentes, colaboradores influentes e temas do seu nicho</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ca98ff]/60" />
            <p>recomendações estratégicas de conteúdo baseadas em dados reais</p>
          </div>
        </div>
      </div>

      {/* Input card */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-[2rem] p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.37)] relative">
          {history.length > 0 && (
            <button
              onClick={() => setFormExpanded(false)}
              aria-label="Fechar formulário"
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all text-lg leading-none"
            >&times;</button>
          )}
          <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block mb-3">
            LinkedIn da Empresa
          </label>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-1 mb-6 focus-within:border-[#ca98ff]/40 focus-within:bg-[#ca98ff]/[0.03] transition-all">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAnalyze(); }}
              placeholder="https://www.linkedin.com/company/sua-empresa"
              className="w-full bg-transparent border-none focus:ring-0 px-5 py-4 text-white text-sm font-medium placeholder-white/20 outline-none"
            />
          </div>

          {/* Competitor inputs */}
          <div className="mb-6">
            <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block mb-3">
              Concorrentes
            </label>
            <div className="space-y-2">
              {competitorUrls.map((cu, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl p-1 focus-within:border-[#ca98ff]/40 focus-within:bg-[#ca98ff]/[0.03] transition-all">
                    <input
                      type="text"
                      value={cu}
                      onChange={(e) => { const u = [...competitorUrls]; u[idx] = e.target.value; setCompetitorUrls(u); }}
                      placeholder={`linkedin.com/company/concorrente-${idx + 1}`}
                      className="w-full bg-transparent border-none focus:ring-0 px-4 py-2.5 text-white text-sm font-medium placeholder-white/15 outline-none"
                    />
                  </div>
                  {competitorUrls.length > 2 && (
                    <button onClick={() => setCompetitorUrls(competitorUrls.filter((_, i) => i !== idx))} className="w-9 h-9 rounded-xl bg-white/[0.02] border border-white/[0.06] text-white/30 hover:text-[#ff946e] hover:border-[#ff946e]/30 flex items-center justify-center text-lg transition-colors self-center">&times;</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setCompetitorUrls([...competitorUrls, ""])} className="text-[10px] text-[#ca98ff]/60 hover:text-[#ca98ff] mt-2 flex items-center gap-1">
              <span className="text-sm">+</span> Adicionar outro concorrente
            </button>
          </div>

          {error && <p className="text-[#ff6e84] text-sm mb-4">{error}</p>}

          <button
            id="analyze-btn"
            onClick={() => handleAnalyze()}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#ca98ff] to-[#9c48ea] text-[#1a0033] font-bold text-sm shadow-[0_10px_30px_-5px_rgba(204,151,255,0.4)] hover:shadow-[0_15px_40px_-5px_rgba(204,151,255,0.5)] hover:translate-y-[-2px] transition-all active:scale-[0.98] tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-pulse">Mapeando empresa... (pode levar ate 3 minutos)</span>
              </>
            ) : (
              <>
                Mapear Empresa
                <span className="text-lg">→</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 mt-4">
            <label className="text-xs text-white/40 shrink-0">País:</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#ca98ff]/40 transition-colors">
              <option value="br">Brasil</option>
              <option value="us">Estados Unidos</option>
              <option value="pt">Portugal</option>
              <option value="es">Espanha</option>
              <option value="mx">México</option>
              <option value="ar">Argentina</option>
              <option value="co">Colômbia</option>
              <option value="cl">Chile</option>
              <option value="uk">Reino Unido</option>
              <option value="de">Alemanha</option>
              <option value="fr">França</option>
              <option value="it">Itália</option>
              <option value="in">Índia</option>
              <option value="ca">Canadá</option>
              <option value="au">Austrália</option>
              <option value="">Global (sem filtro)</option>
            </select>
          </div>
        </div>

        <p className="text-center text-[10px] text-white/20 mt-4">
          Processamento seguro de dados via IA proprietária.
        </p>
      </div>
      </>)}

      {/* History */}
      <div className="max-w-2xl mx-auto pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black tracking-[0.2em] text-white/20 uppercase">Empresas mapeadas</h3>
          <ScopeFilter value={scope} onChange={setScope} />
        </div>

        {historyLoading ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 animate-pulse">
            <div className="h-8 bg-white/5 rounded" />
          </div>
        ) : history.length > 0 ? (
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[0.6rem] font-bold tracking-[0.15em] text-white/30 uppercase">
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Data</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => {
                  const canDelete = p.accessRole === undefined || p.accessRole === "owner";
                  const dateLabel = new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
                  const isProcessing = p.latest_report?.status === "processing";
                  const statusLabel = isProcessing ? "Processando" : p.latest_report?.status === "complete" ? "Completo" : "Mapeado";
                  const statusColor = isProcessing ? "text-[#f59e0b]" : p.latest_report?.status === "complete" ? "text-[#a2f31f]" : "text-white/40";

                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/casting/share-of-linkedin/${p.id}`)}
                      className="border-b border-white/[0.04] last:border-b-0 hover:bg-[#ca98ff]/[0.04] cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-white group-hover:text-[#ca98ff] transition-colors">
                            {p.name || "Perfil"}
                          </span>
                          {p.owner && (
                            <span className="text-[10px] text-white/30">
                              Compartilhado por {p.owner.name ?? p.owner.email}
                            </span>
                          )}
                          {p.accessRole && p.accessRole !== "owner" && (
                            <span className="text-[10px] text-[#ca98ff]/60">
                              {p.accessRole === "editor" ? "Editor" : "Visualizador"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/50 hidden sm:table-cell">{dateLabel}</td>
                      <td className={`px-4 py-3 text-xs font-medium hidden sm:table-cell ${statusColor}`}>
                        {isProcessing && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse mr-1.5 align-middle" />}
                        {statusLabel}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {p.accessRole && p.accessRole !== "viewer" && (
                            <ShareButton
                              resourceType="lg_profile"
                              resourceId={p.id}
                              resourceName={p.name || "Perfil"}
                              accessRole={p.accessRole}
                              variant="icon"
                              className="!text-white/30 hover:!text-[#ca98ff] hover:!bg-[#ca98ff]/10 !rounded-lg !p-1.5"
                            />
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(p.id, p.name)}
                              disabled={deletingId === p.id}
                              aria-label="Apagar análise"
                              title="Apagar análise"
                              className="text-white/30 hover:text-[#ff6e84] hover:bg-[#ff6e84]/10 p-1.5 rounded-lg transition-colors disabled:opacity-30"
                            >
                              {deletingId === p.id ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : scope === "shared" ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-6 text-center">
            <p className="text-sm text-white/60 mb-1">Nenhum relatório compartilhado com você</p>
            <p className="text-[11px] text-white/30">
              Verifique com quem compartilhou se ele concluiu o procedimento.
            </p>
          </div>
        ) : scope === "mine" ? (
          <p className="text-xs text-white/20">Você ainda não mapeou nenhum perfil.</p>
        ) : (
          <p className="text-xs text-white/20">Nenhum perfil analisado ainda.</p>
        )}
      </div>

      {/* No competitor confirmation modal */}
      {showNoCompetitorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowNoCompetitorModal(false)}>
          <div className="bg-[#1a1919] border border-[#ca98ff]/30 rounded-2xl p-8 max-w-md w-full mx-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white font-[family-name:var(--font-lexend)] mb-3">Continuar sem concorrentes?</h3>
            <p className="text-sm text-white/60 mb-6">
              Sem concorrentes, o relatório <span className="text-[#ca98ff] font-medium">Share of LinkedIn</span> perde seu principal valor: a comparação competitiva. Você poderá adicionar concorrentes depois, mas precisará reprocessar.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowNoCompetitorModal(false)} className="flex-1 py-3 rounded-xl bg-[#ca98ff]/10 border border-[#ca98ff]/20 text-[#ca98ff] font-medium text-sm hover:bg-[#ca98ff]/20 transition-colors">
                Voltar e adicionar
              </button>
              <button onClick={() => handleAnalyze(true)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-medium text-sm transition-colors">
                Continuar sem concorrentes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
