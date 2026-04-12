"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001+"];

interface Options {
  market_context: string;
  job_titles: string[];
  departments: string[];
  company_sizes: string[];
}

interface Profile {
  id: string;
  name: string;
  headline: string;
  linkedin_url: string;
}

export default function LeadsGenerationOptionsPage() {
  const params = useParams();
  const profileId = params.profileId as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [influencerExpanded, setInfluencerExpanded] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads-generation/options?profileId=${profileId}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setOptions(data.options ? {
          market_context: data.options.market_context ?? "",
          job_titles: data.options.job_titles ?? [],
          departments: data.options.departments ?? [],
          company_sizes: data.options.company_sizes ?? [],
        } : null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [profileId]);

  useEffect(() => { loadData(); }, [loadData]);

  function autoSave(updated: Options) {
    setOptions(updated);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch("/api/leads-generation/options", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, ...updated }),
      });
    }, 1000);
  }

  function updateField(field: keyof Options, value: string | string[]) {
    if (!options) return;
    autoSave({ ...options, [field]: value });
  }

  function toggleCompanySize(size: string) {
    if (!options) return;
    const sizes = options.company_sizes.includes(size)
      ? options.company_sizes.filter((s) => s !== size)
      : [...options.company_sizes, size];
    autoSave({ ...options, company_sizes: sizes });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[#adaaaa] animate-pulse">Carregando...</span>
      </div>
    );
  }

  if (!options) {
    return (
      <div className="text-center py-20">
        <p className="text-[#adaaaa]">Análise não encontrada.</p>
        <Link href="/casting/leads-generation" className="text-[#ca98ff] text-sm mt-2 inline-block hover:underline">
          ← Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link href="/casting/leads-generation" className="text-xs text-[#adaaaa] hover:text-[#ca98ff] transition-colors">
        ← Nova análise
      </Link>

      {/* Header */}
      <header className="mb-6">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4 leading-tight font-[family-name:var(--font-lexend)] text-white">
          Vamos encontrar leads através{" "}
          <br className="hidden md:block" />
          de seu <span className="bg-gradient-to-r from-[#ca98ff] to-[#e197fc] bg-clip-text text-transparent">LinkedIn</span>
        </h2>
        {profile && (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-lg font-semibold text-white">{profile.name}</span>
            {profile.headline && <span className="text-sm text-white/40">— {profile.headline}</span>}
            <a
              href={profile.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#ca98ff] hover:text-[#e197fc] transition-colors"
              title="Ver perfil no LinkedIn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        )}
      </header>

      {/* Two paths — Decisores LEFT (expanded), Influenciadores RIGHT (collapsed) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Path A: Prospecção de Decisores — EXPANDED (LEFT) */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-[2rem] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.37)] relative overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(204,151,255,0.15)]">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#ca98ff]/20 blur-[60px] rounded-full pointer-events-none" />

          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#ca98ff]/10 border border-[#ca98ff]/20 flex items-center justify-center shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ca98ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              </svg>
            </div>
            <div>
              <h4 className="text-xl font-bold font-[family-name:var(--font-lexend)]">Prospecção de Decisores</h4>
              <p className="text-[#adaaaa] text-xs mt-1">Identifique decisores que já demonstraram interesse.</p>
            </div>
          </div>

          <div className="space-y-5 relative z-10">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block">Cargos</label>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-0.5 focus-within:border-[#ca98ff]/40 transition-all">
                  <textarea
                    rows={3}
                    value={options.job_titles.join(", ")}
                    onChange={(e) => updateField("job_titles", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                    className="w-full bg-transparent border-none focus:ring-0 px-3 py-2.5 text-white text-xs font-medium outline-none placeholder-white/20 resize-none"
                    placeholder="CEO, CTO, VP Marketing..."
                  />
                </div>
                <p className="text-[10px] text-white/20">Separe por vírgula</p>
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block">Departamentos</label>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-0.5 focus-within:border-[#ca98ff]/40 transition-all">
                  <textarea
                    rows={3}
                    value={options.departments.join(", ")}
                    onChange={(e) => updateField("departments", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                    className="w-full bg-transparent border-none focus:ring-0 px-3 py-2.5 text-white text-xs font-medium outline-none placeholder-white/20 resize-none"
                    placeholder="Marketing, Sales..."
                  />
                </div>
                <p className="text-[10px] text-white/20">Separe por vírgula</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block">Tamanho da Empresa</label>
              <div className="flex flex-wrap gap-2">
                {COMPANY_SIZES.map((size) => {
                  const isSelected = options.company_sizes.includes(size);
                  return (
                    <button
                      key={size}
                      onClick={() => toggleCompanySize(size)}
                      className={`px-4 py-2 rounded-full text-[11px] font-bold transition-all ${
                        isSelected
                          ? "border-2 border-[#ca98ff]/40 bg-[#ca98ff]/10 text-[#ca98ff] shadow-[0_0_15px_rgba(204,151,255,0.1)]"
                          : "border border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-white/20">Selecione um ou mais</p>
            </div>
          </div>

          <button
            disabled
            className="mt-6 w-full py-4 rounded-2xl bg-gradient-to-r from-[#ca98ff] to-[#9c48ea] text-[#1a0033] font-bold text-sm shadow-[0_10px_30px_-5px_rgba(204,151,255,0.4)] tracking-wide relative z-10 opacity-50 cursor-not-allowed"
          >
            VER DECISORES INTERESSADOS
          </button>
          <p className="text-[10px] text-white/20 text-center mt-2 relative z-10">Em breve</p>
        </div>

        {/* Path B: Prospecção de Influenciadores — COLLAPSED (RIGHT) */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-[2rem] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.37)] transition-all hover:shadow-[0_0_20px_rgba(204,151,255,0.08)]">
          <button
            onClick={() => setInfluencerExpanded(!influencerExpanded)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h4 className="text-lg font-bold font-[family-name:var(--font-lexend)] text-left">Prospecção de Influenciadores</h4>
            </div>
            <span className={`text-white/30 text-xl transition-transform ${influencerExpanded ? "rotate-180" : ""}`}>▾</span>
          </button>

          {influencerExpanded && (
            <div className="mt-6 space-y-4">
              <p className="text-[#adaaaa] text-sm leading-relaxed">
                Crie conexões e autoridade interagindo com grandes players do seu nicho.
              </p>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block">
                  Temas de Atuação
                </label>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-1 focus-within:border-[#ca98ff]/40 transition-all">
                  <textarea
                    rows={3}
                    value={options.market_context}
                    onChange={(e) => updateField("market_context", e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 px-4 py-3 text-white text-sm font-medium outline-none placeholder-white/20 resize-none"
                    placeholder="Ex: Métricas de Marketing, Analytics, Growth..."
                  />
                </div>
                <p className="text-[10px] text-white/20">Temas separados por vírgula</p>
              </div>
              <button
                disabled
                className="w-full py-3.5 rounded-2xl border border-white/15 text-white/50 font-bold text-sm tracking-wide cursor-not-allowed"
              >
                SEGUIR ESTE CAMINHO
              </button>
              <p className="text-[10px] text-white/20 text-center">Em breve</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
