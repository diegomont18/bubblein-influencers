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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalyzedProfile[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leads-generation/profiles")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.profiles) setHistory(d.profiles); })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));

    // Auto-analyze from content-sales redirect
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

  async function handleAnalyze() {
    if (!url.trim() || !url.includes("linkedin.com")) {
      setError("Insira uma URL válida do LinkedIn");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/leads-generation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrl: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao analisar perfil");
        return;
      }

      const data = await res.json();
      router.push(`/casting/leads-generation/${data.profile.id}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex flex-col items-center text-center pt-8 pb-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-6 font-[family-name:var(--font-lexend)]">
          Vamos encontrar leads através{" "}
          <br className="hidden md:block" />
          de seu <span className="bg-gradient-to-r from-[#ca98ff] to-[#e197fc] bg-clip-text text-transparent">LinkedIn</span>
        </h1>
        <div className="text-[#adaaaa] text-base leading-relaxed flex flex-col gap-2 font-medium mb-10">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ca98ff]/60" />
            <p>quem interagiu com seus posts</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ca98ff]/60" />
            <p>quem é importante você se relacionar</p>
          </div>
        </div>
      </div>

      {/* Input card */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-[2rem] p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
          <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block mb-3">
            LinkedIn Profile URL
          </label>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-1 mb-6 focus-within:border-[#ca98ff]/40 focus-within:bg-[#ca98ff]/[0.03] transition-all">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAnalyze(); }}
              placeholder="https://www.linkedin.com/in/seu-perfil"
              className="w-full bg-transparent border-none focus:ring-0 px-5 py-4 text-white text-sm font-medium placeholder-white/20 outline-none"
            />
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
                <span className="animate-pulse">Analisando perfil...</span>
              </>
            ) : (
              <>
                Iniciar Análise de Oportunidades
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
        <h3 className="text-xs font-black tracking-[0.2em] text-white/20 uppercase mb-3">Perfis analisados</h3>

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
                  onClick={() => router.push(`/casting/leads-generation/${p.id}`)}
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
