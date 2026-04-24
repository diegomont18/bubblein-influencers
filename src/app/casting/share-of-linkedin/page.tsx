"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface AnalyzedProfile {
  id: string;
  name: string;
  headline: string;
  linkedin_url: string;
  created_at: string;
  leads_count: number;
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

  useEffect(() => {
    fetch("/api/leads-generation/profiles")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.profiles) setHistory(d.profiles); })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));

    // Auto-analyze from share-of-linkedin redirect
    const pendingUrl = localStorage.getItem("pendingLinkedinUrl");
    if (pendingUrl) {
      localStorage.removeItem("pendingLinkedinUrl");
      setUrl(pendingUrl);
      // Trigger analysis after a short delay to let state settle
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

  async function handleAnalyze() {
    if (!url.trim() || !url.includes("linkedin.com")) {
      setError("Insira uma URL válida do LinkedIn");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      // 2-minute timeout — if the API takes longer, show error instead of hanging
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180_000);

      const res = await fetch("/api/leads-generation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrl: url.trim(), country }),
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
        setError("O mapeamento demorou demais. Tente novamente — a segunda tentativa costuma ser mais rápida.");
      } else {
        setError("Erro de conexão. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
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
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-[2rem] p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
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

          <div className="flex items-center gap-2 mb-4">
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

          {error && <p className="text-[#ff6e84] text-sm mb-4">{error}</p>}

          <button
            id="analyze-btn"
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#ca98ff] to-[#9c48ea] text-[#1a0033] font-bold text-sm shadow-[0_10px_30px_-5px_rgba(204,151,255,0.4)] hover:shadow-[0_15px_40px_-5px_rgba(204,151,255,0.5)] hover:translate-y-[-2px] transition-all active:scale-[0.98] tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-pulse">Mapeando empresa...</span>
              </>
            ) : (
              <>
                Mapear Empresa
                <span className="text-lg">→</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-[10px] text-white/20 mt-4">
          Processamento seguro de dados via IA proprietária.
        </p>
      </div>

      {/* History */}
      <div className="max-w-2xl mx-auto pt-4">
        <h3 className="text-xs font-black tracking-[0.2em] text-white/20 uppercase mb-3">Empresas mapeadas</h3>

        {historyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-4 bg-white/5 rounded w-40 mb-2" />
                    <div className="h-3 bg-white/5 rounded w-60" />
                  </div>
                  <div className="h-3 bg-white/5 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-2">
            {history.map((p) => (
              <div
                key={p.id}
                className="w-full flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 hover:border-[#ca98ff]/20 hover:bg-[#ca98ff]/[0.02] transition-all"
              >
                <button
                  onClick={() => router.push(`/casting/share-of-linkedin/${p.id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium truncate">{p.name || "Perfil"}</p>
                    <a
                      href={p.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#ca98ff] hover:text-[#e197fc] transition-colors shrink-0"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    </a>
                  </div>
                  {p.headline && <p className="text-[10px] text-white/40 truncate">{p.headline}</p>}
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-medium text-[#ca98ff] bg-[#ca98ff]/10 px-2 py-0.5 rounded-full">
                    {p.leads_count} leads
                  </span>
                  <span className="text-[10px] text-white/20">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    disabled={deletingId === p.id}
                    aria-label="Apagar análise"
                    title="Apagar análise"
                    className="text-white/30 hover:text-[#ff6e84] hover:bg-[#ff6e84]/10 p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/20">Nenhum perfil analisado ainda.</p>
        )}
      </div>
    </div>
  );
}
