"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/navbar";
import { NAV_ANALYSIS, NAV_CONTENT, NAV_SECTIONS, HIGHLIGHT_POSTS, COLLAB_DATA } from "./data";
import InfluencersTab from "./influencers-tab";
import PostsTab from "./posts-tab";

/* ========== SHARED COMPONENTS ========== */

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-3.5 h-3.5 rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white flex items-center justify-center text-[9px] font-bold leading-none"
        aria-label="Mais informações"
      >
        i
      </button>
      {open && (
        <span role="tooltip" className="absolute z-50 left-5 top-1/2 -translate-y-1/2 w-64 rounded-lg bg-[#1a1919] border border-[#ca98ff]/30 px-3 py-2 text-[11px] text-white/80 font-normal normal-case tracking-normal shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          {text}
        </span>
      )}
    </span>
  );
}

function AlertIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2L1 21h22L12 2z" fill="currentColor" opacity="0.15" />
      <path d="M12 2L1 21h22L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function InactiveAlert({ tooltipText }: { tooltipText: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="text-amber-400 hover:text-amber-300 transition-colors"
        aria-label="Alerta"
      >
        <AlertIcon size={16} />
      </button>
      {open && (
        <span role="tooltip" className="absolute z-50 left-6 top-1/2 -translate-y-1/2 w-56 rounded-lg bg-[#1a1919] border border-amber-500/30 px-3 py-2 text-[11px] text-white/80 font-normal shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          {tooltipText}
        </span>
      )}
    </span>
  );
}

function CompanyTabs({ active, onChange }: { active: string; onChange: (v: string) => void }) {
  const tabs = ["TOTVS", "SAP Brasil", "Oracle"];
  return (
    <div className="flex gap-1 bg-[#0B0B1A] border border-[#1E1E3A] rounded-full p-0.5 w-fit mb-4">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${active === t ? "bg-[#E91E8C]/20 text-[#E91E8C]" : "text-gray-500 hover:text-gray-300"}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Collapsible({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs text-[#E91E8C]/70 hover:text-[#E91E8C] transition-colors select-none flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90 shrink-0"><path d="m9 18 6-6-6-6"/></svg>
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function ContentBar({ label, segments }: { label: string; segments: { name: string; pct: number; color: string }[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-gray-300">{label}</p>
      <div className="flex h-6 rounded-full overflow-hidden">
        {segments.map((s) => (
          <div key={s.name} className={`${s.color} flex items-center justify-center`} style={{ width: `${s.pct}%` }}>
            {s.pct >= 15 && <span className="text-[9px] font-bold text-white/90">{s.pct}%</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
        {segments.map((s) => (
          <span key={s.name} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${s.color}`} />
            {s.name} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

/* ========== REPORT NAV ========== */


function ReportNav({ activeId, sections }: { activeId: string; sections: Array<{ id: string; label: string }> }) {
  return (
    <nav className="hidden lg:block sticky top-24 self-start space-y-1 pr-4">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`block text-xs py-1.5 px-3 rounded-lg transition-colors ${activeId === s.id ? "text-[#E91E8C] bg-[#E91E8C]/10 font-medium" : "text-gray-500 hover:text-gray-300"}`}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}


function LikeDislike({ id, votes, setVotes }: { id: number; votes: Record<number, "like" | "dislike" | null>; setVotes: React.Dispatch<React.SetStateAction<Record<number, "like" | "dislike" | null>>> }) {
  const v = votes[id] ?? null;
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setVotes((prev) => ({ ...prev, [id]: prev[id] === "like" ? null : "like" })); }}
        className={`p-1.5 rounded-lg transition-colors ${v === "like" ? "text-green-400 bg-green-400/10" : "text-gray-600 hover:text-gray-400"}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setVotes((prev) => ({ ...prev, [id]: prev[id] === "dislike" ? null : "dislike" })); }}
        className={`p-1.5 rounded-lg transition-colors ${v === "dislike" ? "text-red-400 bg-red-400/10" : "text-gray-600 hover:text-gray-400"}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
      </button>
    </div>
  );
}


/* ========== NEW REPORT ========== */
function NewReport() {
  const [reportTab, setReportTab] = useState<"analysis" | "content" | "posts" | "influencers">("analysis");
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [highlightTab, setHighlightTab] = useState("TOTVS");
  const [collabTab, setCollabTab] = useState("TOTVS");
  const [activeSection, setActiveSection] = useState("insights");
  const [chartTab, setChartTab] = useState<"share" | "sov" | "engagement" | "posts">("share");
  const [recVotes, setRecVotes] = useState<Record<number, "like" | "dislike" | null>>({});

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    for (const id of NAV_SECTIONS.map((s) => s.id)) {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const setRef = (id: string) => (el: HTMLElement | null) => { sectionRefs.current[id] = el; };

  const posts = HIGHLIGHT_POSTS[highlightTab];
  const collabs = COLLAB_DATA[collabTab];

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-[#0B0B1A] pb-0 -mx-6 px-6 pt-2">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-xl md:text-2xl font-extrabold text-white">Relatório Mensal — Share of LinkedIn</h1>
          <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full shrink-0">exemplo</span>
        </div>
        <div className="flex border-b border-[#1E1E3A]">
          {([["analysis", "Análise"], ["content", "Conteúdo"], ["influencers", "Influencers"], ["posts", "Posts"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setReportTab(key)} className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${reportTab === key ? "border-[#E91E8C] text-[#E91E8C]" : "border-transparent text-gray-500 hover:text-gray-300"}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Header card */}
      <div className="mt-4 mb-6 space-y-4">

        <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] text-gray-500 uppercase mb-1">Sua Marca</p>
              <p className="text-xl font-bold text-white">TOTVS</p>
              <p className="text-xs text-gray-500 mt-0.5">1 perfil da empresa + 5 colaboradores</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] text-gray-500 uppercase mb-1">Concorrentes</p>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-lg font-bold text-white">SAP Brasil</p>
                  <p className="text-xs text-gray-500">1 perfil + 5 colaboradores</p>
                </div>
                <span className="text-gray-600">·</span>
                <div>
                  <p className="text-lg font-bold text-white">Oracle</p>
                  <p className="text-xs text-gray-500">1 perfil + 3 colaboradores</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] text-gray-500 uppercase mb-1">Período</p>
              <p className="text-lg font-bold text-white">Março de 2026</p>
              <p className="text-xs text-gray-500">Relatório mensal</p>
            </div>
          </div>

          {/* Expandable collaborators */}
          <div className="mt-4 pt-3 border-t border-[#1E1E3A]">
            <button
              onClick={() => setHeaderExpanded((v) => !v)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-[#E91E8C] transition-colors w-full"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 ${headerExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
              <span className="font-medium">16 perfis monitorados (3 empresas + 13 colaboradores)</span>
            </button>

            {headerExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                {(["TOTVS", "SAP Brasil", "Oracle"] as const).map((company) => (
                  <div key={company}>
                    <p className="text-xs font-semibold text-white mb-2">{company} ({COLLAB_DATA[company].length})</p>
                    <div className="space-y-1">
                      {COLLAB_DATA[company].map((c) => (
                        <p key={c.name} className="text-xs text-gray-400 flex items-center gap-1.5">
                          {c.role === "Página oficial" && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#E91E8C] shrink-0"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>
                          )}
                          <span className={c.role === "Página oficial" ? "text-[#E91E8C]" : "text-gray-300"}>{c.name}</span>
                          <span className="text-gray-600"> — {c.role}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {reportTab === "posts" ? <PostsTab /> : reportTab === "influencers" ? <InfluencersTab /> : (
      <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-8">
        <ReportNav activeId={activeSection} sections={reportTab === "content" ? NAV_CONTENT : NAV_ANALYSIS} />
        <div className="space-y-8 min-w-0">

        {reportTab === "analysis" && (<>
        {/* 2. Insights Estratégicos */}
        <section id="insights" ref={setRef("insights")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 scroll-mt-20">
          {/* Gráfico comparativo */}
          {(() => {
            const chartData: Record<string, Array<{ name: string; value: number; highlight: boolean }>> = {
              share: [
                { name: "SAP Brasil", value: 2900000, highlight: false },
                { name: "TOTVS", value: 1100000, highlight: true },
                { name: "Oracle", value: 600000, highlight: false },
              ],
              sov: [
                { name: "SAP Brasil", value: 6, highlight: false },
                { name: "TOTVS", value: 5, highlight: true },
                { name: "Oracle", value: 4, highlight: false },
              ],
              engagement: [
                { name: "SAP Brasil", value: 44970, highlight: false },
                { name: "TOTVS", value: 29376, highlight: true },
                { name: "Oracle", value: 18408, highlight: false },
              ],
              posts: [
                { name: "SAP Brasil", value: 142, highlight: false },
                { name: "TOTVS", value: 87, highlight: true },
                { name: "Oracle", value: 58, highlight: false },
              ],
            };
            const tabs: Array<{ key: "share" | "sov" | "engagement" | "posts"; label: string; tip: string }> = [
              { key: "share", label: "Share of LinkedIn", tip: "Índice composto que mede a presença qualificada da marca. Calculado como: Posts engajados × RER (% de decisores) × Engajamentos totais. Quanto maior, mais a marca está dominando as conversas relevantes." },
              { key: "sov", label: "Share of Voice", tip: "Posts de terceiros mencionando a marca." },
              { key: "engagement", label: "Engajamento", tip: "Volume total de engajamento (curtidas, comentários, compartilhamentos) gerado pelos perfis monitorados de cada empresa. Não filtra por decisores — mede alcance bruto." },
              { key: "posts", label: "Número de Posts", tip: "Total de posts publicados no período pelos perfis monitorados (oficial + colaboradores). Exclui reposts sem comentário." },
            ];
            const bars = chartData[chartTab];
            const maxVal = Math.max(...bars.map((b) => b.value));

            return (
              <div className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl p-5 mb-6">
                {/* Tabs */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {tabs.map((t) => (
                    <span key={t.key} className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setChartTab(t.key)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${chartTab === t.key ? "bg-gradient-to-r from-[#E91E8C] to-[#C724D1] text-white" : "text-gray-500 hover:text-gray-300 border border-[#1E1E3A]"}`}
                      >
                        {t.label}
                      </button>
                      <InfoTooltip text={t.tip} />
                    </span>
                  ))}
                </div>

                {chartTab !== "sov" && (
                <div className="space-y-4">
                  {bars.map((bar) => (
                    <div key={bar.name} className="flex items-center gap-3">
                      <span className={`text-sm w-24 shrink-0 text-right ${bar.highlight ? "text-[#E91E8C] font-bold" : "text-gray-400"}`}>{bar.name}</span>
                      <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${bar.highlight ? "bg-gradient-to-r from-[#E91E8C] to-[#C724D1]" : "bg-gray-600/60"}`}
                          style={{ width: `${Math.max((bar.value / maxVal) * 100, 3)}%` }}
                        />
                      </div>
                      <span className={`text-sm w-28 shrink-0 tabular-nums ${bar.highlight ? "text-white font-bold" : "text-gray-400"}`}>
                        {maxVal >= 1000000
                          ? (bar.value / 1000000).toFixed(1)
                          : maxVal >= 1000
                            ? (bar.value / 1000).toFixed(1)
                            : bar.value.toString()}
                      </span>
                    </div>
                  ))}
                </div>
                )}
                {chartTab === "sov" && (
                  <div className="space-y-4">
                    {[{n:"SAP Brasil",p:3,ne:1,ng:2,hl:false},{n:"TOTVS",p:3,ne:1,ng:1,hl:true},{n:"Oracle",p:2,ne:1,ng:1,hl:false}].map((s) => (
                      <div key={s.n} className="flex items-center gap-3">
                        <span className={`text-sm w-24 shrink-0 text-right ${s.hl ? "text-[#E91E8C] font-bold" : "text-gray-400"}`}>{s.n}</span>
                        <div className="flex-1 flex h-8 rounded-full overflow-hidden bg-white/5">
                          <div className="bg-green-500 flex items-center justify-center" style={{width:`${(s.p/(s.p+s.ne+s.ng))*100}%`}}><span className="text-[10px] font-bold text-white">{s.p}</span></div>
                          <div className="bg-yellow-500 flex items-center justify-center" style={{width:`${(s.ne/(s.p+s.ne+s.ng))*100}%`}}><span className="text-[10px] font-bold text-white">{s.ne}</span></div>
                          <div className="bg-red-500 flex items-center justify-center" style={{width:`${(s.ng/(s.p+s.ne+s.ng))*100}%`}}><span className="text-[10px] font-bold text-white">{s.ng}</span></div>
                        </div>
                        <span className={`text-sm w-28 shrink-0 tabular-nums ${s.hl ? "text-white font-bold" : "text-gray-400"}`}>{s.p+s.ne+s.ng} menções</span>
                      </div>
                    ))}
                    <div className="flex gap-4 text-[10px] text-gray-500 pt-1 pl-28">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Positivo</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Neutro</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Negativo</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <h3 className="text-lg font-bold text-white mb-4">Insights Estratégicos</h3>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Positivos */}
            <div className="bg-green-400/5 border border-green-400/15 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>
                Positivos
              </p>
              <div className="space-y-2.5">
                <div>
                  <p className="text-sm text-white font-semibold">Liderança em Reforma Tributária mantida</p>
                  <p className="text-xs text-gray-400">Post do Dennis Herszkowicz sobre os 3 erros da reforma tributária foi o post com maior RER do mês em todo o set competitivo (51%, 2.347 reações, 89 comentários de decisores). Nenhum concorrente publicou sobre o tema com engajamento comparável. A TOTVS é a referência percebida neste território.</p>
                </div>
                <div>
                  <p className="text-sm text-white font-semibold">Dominio no buyer financeiro (CFO/Controller)</p>
                  <p className="text-xs text-gray-400">6 dos 8 decisores engajados sao financeiros. Gerdau, Ambev, Raizen e Vale ativos.</p>
                </div>
                <div>
                  <p className="text-sm text-white font-semibold">Share of Voice positivo (8 de 15)</p>
                  <p className="text-xs text-gray-400">8 de 15 menções externas positivas. TOTVS citada por tributaristas. 4 influenciadores com alto potencial.</p>
                </div>
              </div>
            </div>

            {/* Pontos de atenção */}
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertIcon size={14} />
                Pontos de Atenção
              </p>
              <div className="space-y-2.5">
                <div>
                  <p className="text-sm text-white font-semibold">SAP assumiu liderança no tema IA+ERP (−3% SoL)</p>
                  <p className="text-xs text-gray-400">SAP publicou 42 posts sobre IA aplicada a ERP no mês (3,2x a média), ativou 8 colaboradores no tema e atraiu 47 decisores de TI que não interagiram com TOTVS no mesmo período. A associação &ldquo;IA em ERP = SAP&rdquo; está se consolidando. Se não for contestada em 30 dias, pode virar permanente.</p>
                </div>
                <div>
                  <p className="text-sm text-white font-semibold">Oracle construindo autoridade em ERP Cloud sem resposta</p>
                  <p className="text-xs text-gray-400">Oracle: 18 posts ERP Cloud, RER acima de 35%. TOTVS sem colaborador ativo em cloud.</p>
                </div>
                <div>
                  <p className="text-sm text-white font-semibold">SAP acumula menções negativas</p>
                  <p className="text-xs text-gray-400">2 menções negativas (custo e complexidade). Monitorar padrao.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recomendações Estratégicas (unificadas) */}
        <section id="recomendacoes" ref={setRef("recomendacoes")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-white mb-4">Recomendações Estratégicas</h3>
          <div className="space-y-3">
            {[
              { id: 1, title: "Defender território IA+ERP", tag: "DEFENSIVA", tagColor: "text-red-400 bg-red-400/10 border-red-400/20", urgency: "alta urgência", desc: "Dennis publica tese sobre 'IA brasileira para gestão brasileira' + ativar Izabel Branco (Head de IA) como voz técnica complementar.", who: "Dennis + Izabel Branco + Marcelo Cosentino", details: "Tese: SAP está construindo a associação de que 'IA em ERP é coisa de plataforma global'. Se não respondermos em 30 dias, vira permanente.\n\nJustificativa: SAP cresceu 5% de SoL puxada por esse tema. 47 decisores de TI engajaram com eles, 0 conosco.\n\nTópicos sugeridos:\n• Casos reais de IA preditiva em clientes do varejo e indústria\n• Diferença entre 'IA como chatbot' e 'IA como inteligência de processo'\n• Limites honestos da IA em ERP — hype vs realidade\n• Soberania de dados: IA em servidor brasileiro" },
              { id: 2, title: "Case de IA preditiva em cliente do varejo", tag: "CONTEÚDO", tagColor: "text-blue-400 bg-blue-400/10 border-blue-400/20", urgency: "alta urgência", desc: "Como um cliente reduziu ruptura de estoque em X% usando IA preditiva da TOTVS. Case real com número fura narrativa abstrata da SAP.", who: "Diretor de Produto + cliente marcado no post", details: "Justificativa: SAP está todo discurso e nenhum case concreto no mês. Case real com número específico é a melhor resposta. Formato que gera confiança com buyers enterprise." },
              { id: 3, title: "Reforma tributária: 5 decisões que sua empresa precisa tomar", tag: "CONTEÚDO", tagColor: "text-blue-400 bg-blue-400/10 border-blue-400/20", urgency: "média urgência", desc: "Checklist de decisões fiscais-tributárias com prazo curto. Formato 'N coisas com prazo' converte bem em comentários.", who: "Ricardo Oliveira (Head Fiscal) + Dennis amplifica", details: "Justificativa: Duplicar aposta em pauta que já ganhamos (Dennis RER 51%). Formato de checklist com prazo gera urgência e engajamento de decisores financeiros." },
              { id: 4, title: "Responder Oracle em ERP Cloud Enterprise", tag: "OFENSIVA", tagColor: "text-amber-400 bg-amber-400/10 border-amber-400/20", urgency: "média urgência", desc: "Publicar cases reais de migração cloud em clientes enterprise brasileiros. Contestar narrativa da Oracle com dados concretos.", who: "Marcelo Cosentino (VP Tech) + cliente enterprise", details: "Tópicos sugeridos:\n• Diferenças estruturais entre ERP on-premise e cloud enterprise\n• Custos escondidos na migração com vendor lock-in\n• Cases reais de migração cloud em clientes brasileiros\n• Compliance e soberania de dados em ERP cloud" },
              { id: 5, title: "ERP para PME ≠ ERP enterprise menor", tag: "CONTEÚDO", tagColor: "text-blue-400 bg-blue-400/10 border-blue-400/20", urgency: "média urgência", desc: "Diferenças estruturais de produto, operação e custo. Entrar no território que Oracle construiu sem resposta.", who: "Ana Paula Motta (Dir. PMEs) + líder de cliente PME", details: "Justificativa: Oracle construiu 6 meses de autoridade no tema sem resposta nossa. Entrar agora corta crescimento deles e recupera território." },
              { id: 6, title: "IA em ERP: o que é real e o que é marketing", tag: "CONTEÚDO", tagColor: "text-blue-400 bg-blue-400/10 border-blue-400/20", urgency: "média urgência", desc: "Tese provocativa — ceticismo maduro que funciona com CIO/CTO. Responde ao aumento de 3,2x nos posts de IA da SAP.", who: "Marcelo Cosentino (VP Tech — reativação)", details: "Justificativa: Responde diretamente ao aumento de 3,2x nos posts de IA da SAP. Posicionamento de ceticismo maduro funciona com buyer técnico (CIO/CTO — público que não estamos capturando)." },
              { id: 7, title: "Manter cadencia Reforma Tributaria", tag: "CONSOLIDACAO", tagColor: "text-green-400 bg-green-400/10 border-green-400/20", urgency: "baixa", desc: "Atualizacoes mensais + checklists.", who: "Ricardo Oliveira + Dennis", details: "Topicos: regulamentacao, checklists, serie por setor" },
              { id: 8, title: "Ativar influenciadores-chave", tag: "RELACIONAMENTO", tagColor: "text-purple-400 bg-purple-400/10 border-purple-400/20", urgency: "media", desc: "Ricardo Amorim (85k) e Fernando Gomes (18k) mencionam TOTVS.", who: "Marketing + Parcerias", details: "Top: R.Amorim 85k, F.Gomes 18k, J.Santos 20k, P.Andrade 28k" },
            ].map((rec) => (
              <div key={rec.id} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl font-black text-[#E91E8C]/20 leading-none shrink-0 w-6 text-center">{rec.id}</span>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white">{rec.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rec.tagColor}`}>{rec.tag} · {rec.urgency}</span>
                    </div>
                    <p className="text-xs text-gray-400">{rec.desc}</p>
                    <p className="text-xs text-gray-500"><strong className="text-gray-400">Quem publica:</strong> {rec.who}</p>
                    <Collapsible summary="Ver detalhes">
                      <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans">{rec.details}</pre>
                    </Collapsible>
                  </div>
                  <LikeDislike id={rec.id} votes={recVotes} setVotes={setRecVotes} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 italic mt-3">Lacunas não cobertas: ESG em gestão, Open Finance para ERP, IA para compliance. Monitorando para meses seguintes.</p>
        </section>

        {/* 3. Movimentos Estratégicos */}
        <section id="alerta" ref={setRef("alerta")} className="rounded-2xl bg-amber-500/5 border border-amber-500/30 p-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
            <AlertIcon size={22} className="text-amber-400" />
            Movimentos estratégicos observados
          </h3>
          <div className="space-y-4">
            {[
              { company: "SAP Brasil", text: "42 posts sobre IA Generativa aplicada a ERP no mês — 3,2x a média histórica. 8 colaboradores diferentes publicaram sobre o tema, incluindo 3 que raramente postam. Padrão típico de coordenação pré-lançamento." },
              { company: "SAP Brasil", text: "Ativação massiva de employee advocacy: 12 colaboradores além da C-suite publicaram no mês, o dobro do trimestre anterior. Indica programa estruturado em expansão." },
              { company: "SAP Brasil", text: "3 posts com menção direta a TOTVS em tom comparativo (\"diferente de ERPs locais...\"). Posicionamento agressivo que antes não existia — sinal de que nos veem como ameaça real." },
              { company: "Oracle", text: "CEO publicou post elogiando a SAP e provocando debate sobre IA em ERP — 1.500 reações, 3x a média. Movimento atípico que posiciona a Oracle como \"adulto na sala\" entre os dois líderes." },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${item.company === "SAP Brasil" ? "text-blue-400 bg-blue-400/10" : "text-orange-400 bg-orange-400/10"}`}>{item.company}</span>
                <p className="text-sm text-gray-300">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        </>)}

        {reportTab === "content" && (<>
        {/* 4. Ranking Competitivo */}
        <section id="ranking" ref={setRef("ranking")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-white mb-4">Ranking Competitivo</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[750px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2.5 pr-3 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase w-16">#</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Empresa</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">SoL <InfoTooltip text="Share of LinkedIn — percentual da presença qualificada da marca no LinkedIn do nicho." /></th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">RER <InfoTooltip text="Revenue Engagement Rate — % do engajamento que vem de decisores." /></th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">Posts <InfoTooltip text="Total de posts publicados no período." /></th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">Decisores <InfoTooltip text="Pessoas únicas do ICP que engajaram." /></th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Top Temas <InfoTooltip text="Temas com maior engajamento qualificado no período." /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { pos: "1", mov: "↑1", name: "SAP Brasil", sov: "41%", sovD: "+5%", rer: "45%", rerD: "+3%", posts: "142", postsD: "+48", dec: "287", decD: "+52%", temas: ["IA + ERP", "Cloud Enterprise", "Transformação Digital"], hl: false },
                  { pos: "2", mov: "↓1", name: "TOTVS", sov: "34%", sovD: "−3%", rer: "42%", rerD: "+5%", posts: "87", postsD: "−6", dec: "198", decD: "−8%", temas: ["Reforma Tributária", "Gestão Financeira", "Produto/Plataforma"], hl: true },
                  { pos: "3", mov: "=", name: "Oracle", sov: "18%", sovD: "+2%", rer: "38%", rerD: "+4%", posts: "58", postsD: "+12", dec: "94", decD: "+31%", temas: ["ERP Cloud Enterprise", "IA Generativa", "Migração Cloud"], hl: false },
                ].map((row) => (
                  <tr key={row.name} className={row.hl ? "bg-[#E91E8C]/[0.06]" : ""}>
                    <td className="py-3 pr-3">
                      <span className="text-xs font-black text-gray-400">{row.pos}</span>
                      <span className={`ml-1 text-[10px] font-bold ${row.mov.includes("↑") ? "text-green-400" : row.mov.includes("↓") ? "text-red-400" : "text-gray-600"}`}>{row.mov}</span>
                    </td>
                    <td className={`py-3 font-medium ${row.hl ? "text-[#E91E8C]" : "text-gray-300"}`}>{row.name}</td>
                    <td className="py-3 text-center text-gray-300">{row.sov} <span className={`text-[10px] ${row.sovD.startsWith("−") ? "text-red-400" : "text-green-400"}`}>({row.sovD})</span></td>
                    <td className="py-3 text-center text-gray-300">{row.rer} <span className="text-[10px] text-green-400">({row.rerD})</span></td>
                    <td className="py-3 text-center text-gray-300">{row.posts} <span className={`text-[10px] ${row.postsD.startsWith("−") ? "text-red-400" : "text-green-400"}`}>({row.postsD})</span></td>
                    <td className="py-3 text-center text-gray-300">{row.dec} <span className={`text-[10px] ${row.decD.startsWith("−") ? "text-red-400" : "text-green-400"}`}>({row.decD})</span></td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.temas.map((t) => (
                          <span key={t} className="text-[10px] text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 italic mt-4">SAP assume liderança pela primeira vez em 9 meses, puxada pela aposta em IA. Oracle cresce de forma consistente há 6 meses consecutivos.</p>
        </section>

        {/* 5. Análise de Conteúdo */}
        <section id="analise" ref={setRef("analise")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 space-y-6 scroll-mt-20">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Análise de Conteúdo por Empresa</h3>
            <p className="text-xs text-gray-500 mb-5">Composição do conteúdo publicado no mês</p>
            <div className="space-y-5">
              <ContentBar label="TOTVS — 87 posts" segments={[{ name: "🏢 Institucional", pct: 38, color: "bg-blue-500" }, { name: "💼 Vagas e RH", pct: 22, color: "bg-purple-500" }, { name: "📊 Produto e negócio", pct: 34, color: "bg-green-500" }, { name: "📎 Outros", pct: 6, color: "bg-gray-600" }]} />
              <ContentBar label="SAP Brasil — 142 posts" segments={[{ name: "🏢 Institucional", pct: 28, color: "bg-blue-500" }, { name: "💼 Vagas e RH", pct: 18, color: "bg-purple-500" }, { name: "📊 Produto e negócio", pct: 49, color: "bg-green-500" }, { name: "📎 Outros", pct: 5, color: "bg-gray-600" }]} />
              <ContentBar label="Oracle — 58 posts" segments={[{ name: "🏢 Institucional", pct: 20, color: "bg-blue-500" }, { name: "💼 Vagas e RH", pct: 12, color: "bg-purple-500" }, { name: "📊 Produto e negócio", pct: 62, color: "bg-green-500" }, { name: "📎 Outros", pct: 6, color: "bg-gray-600" }]} />
            </div>
            <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-400/90"><strong>&#9888; TOTVS publica 60% de conteúdo que não constrói pipeline</strong> (institucional + vagas). SAP está em 46%. Oracle em 32%.</p>
            </div>
          </div>

          {/* Posts em destaque com abas */}
          <div>
            <h4 className="text-base font-bold text-white mb-3">Posts em destaque do mês</h4>
            <CompanyTabs active={highlightTab} onChange={setHighlightTab} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Positivo */}
              <div className="bg-[#0B0B1A] border border-green-500/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><path d="M20 6 9 17l-5-5"/></svg>
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Destaque positivo</span>
                </div>
                <p className="text-sm font-semibold text-white">&ldquo;{posts.positive.title}&rdquo;</p>
                <p className="text-[10px] text-gray-500">{posts.positive.author}</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="text-green-400 font-bold bg-green-400/10 px-2 py-0.5 rounded-full">RER {posts.positive.rer}%</span>
                  <span>{posts.positive.reactions.toLocaleString("pt-BR")} reações</span>
                  <span>{posts.positive.comments} comentários</span>
                </div>
                <p className="text-xs text-gray-400"><strong className="text-white">Por que funciona:</strong> {posts.positive.why}</p>
              </div>

              {/* Negativo */}
              <div className="bg-[#0B0B1A] border border-red-500/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Destaque negativo</span>
                </div>
                <p className="text-sm font-semibold text-white">&ldquo;{posts.negative.title}&rdquo;</p>
                <p className="text-[10px] text-gray-500">{posts.negative.author}</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="text-red-400 font-bold bg-red-400/10 px-2 py-0.5 rounded-full">RER {posts.negative.rer}%</span>
                  <span>{posts.negative.reactions} reações</span>
                  <span>{posts.negative.comments} comentários</span>
                </div>
                <p className="text-xs text-gray-400"><strong className="text-white">Por que falhou:</strong> {posts.negative.why}</p>
              </div>

              {/* Inesperado */}
              <div className="bg-[#0B0B1A] border border-blue-500/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Destaque inesperado</span>
                </div>
                <p className="text-sm font-semibold text-white">&ldquo;{posts.unexpected.title}&rdquo;</p>
                <p className="text-[10px] text-gray-500">{posts.unexpected.author}</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span>{posts.unexpected.reactions.toLocaleString("pt-BR")} reações</span>
                  <span className="text-blue-400 font-bold">({posts.unexpected.detail})</span>
                </div>
                <p className="text-xs text-gray-400"><strong className="text-white">O que nos diz:</strong> {posts.unexpected.why}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Desempenho dos Colaboradores */}
        <section id="colaboradores" ref={setRef("colaboradores")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 space-y-4 scroll-mt-20">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Desempenho dos Colaboradores Monitorados</h3>
            <p className="text-xs text-gray-500 mb-3">Aderência e impacto de cada colaborador por categoria temática</p>
          </div>

          <CompanyTabs active={collabTab} onChange={setCollabTab} />

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[750px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Colaborador</th>
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">Posts</th>
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">% Engaj.</th>
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Categoria principal</th>
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">Aderência ICP</th>
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Destaque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {collabs.map((p) => (
                  <tr key={p.name} className={p.posts === 0 ? "opacity-50" : ""}>
                    <td className="py-2.5">
                      <span className="text-sm text-white font-medium">{p.name}</span>
                      <span className="text-[10px] text-gray-500 ml-1.5">{p.role}</span>
                    </td>
                    <td className="py-2.5 text-center text-gray-400">{p.posts}</td>
                    <td className="py-2.5 text-center text-gray-400">{p.engPct}</td>
                    <td className="py-2.5 text-gray-400 text-xs">{p.cat}</td>
                    <td className="py-2.5 text-center">
                      {p.posts === 0 ? (
                        <InactiveAlert tooltipText="Veja sugestões de conteúdo para reativar este colaborador na seção Sugestões de Conteúdos abaixo." />
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.badgeColor}`}>{p.badge}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-gray-500 text-xs">{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {collabTab === "TOTVS" && (
            <div className="space-y-3 mt-2">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-400/90"><strong>&#9888; Diagnóstico:</strong> 79% do engajamento concentrado em 2 pessoas. Categorias técnicas (IA, Cloud) sem representante ativo — justamente onde SAP está ganhando terreno.</p>
              </div>
              <div className="bg-[#E91E8C]/5 border border-[#E91E8C]/20 rounded-xl px-4 py-3">
                <p className="text-xs text-[#E91E8C] font-bold mb-2">&#127919; Oportunidade — colaboradores NÃO monitorados que já publicam:</p>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <p><strong className="text-white">Izabel Branco</strong> (Head de IA) — posta 3x/mês, ativa no tema IA+ERP <span className="text-amber-400">(território que estamos perdendo)</span></p>
                  <p><strong className="text-white">Ricardo Oliveira</strong> (Head Fiscal) — 2 posts/mês sobre reforma tributária</p>
                  <p><strong className="text-white">Ana Paula Motta</strong> (Dir. PMEs) — 4 posts/mês sobre PMEs</p>
                  <p><strong className="text-white">Fernando Gomes</strong> (Head CS) — 2 posts/mês com cases reais</p>
                </div>
              </div>
            </div>
          )}

          {collabTab === "SAP Brasil" && (
            <div className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl px-4 py-3 text-xs text-gray-400 mt-2">
              <p>Distribuição saudável: top-3 = <strong className="text-white">58% do engajamento</strong>. <strong className="text-white">12 colaboradores adicionais</strong> além da C-suite postam regularmente — programa de employee advocacy estruturado.</p>
            </div>
          )}

          {collabTab === "Oracle" && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400/90 mt-2">
              <p>Concentração extrema: CEO gera <strong>71% de todo o engajamento</strong>. Sem programa de advocacy visível — dependência total da voz do CEO.</p>
            </div>
          )}

          <div className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl px-4 py-3 text-xs text-gray-400 italic">
            SAP tem o programa de employee advocacy mais maduro do set — voz distribuída, reduz risco. TOTVS e Oracle são CEO-dependentes. Para a TOTVS: <strong className="text-white not-italic">risco</strong> (concentração) e <strong className="text-white not-italic">oportunidade</strong> (ativar 4 colaboradores = +30-40% SoL estimado).
          </div>
        </section>

        {/* 7. Decisores em Destaque */}
        <section id="decisores" ref={setRef("decisores")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 scroll-mt-20">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Decisores em Destaque</h3>
              <p className="text-xs text-gray-500">Principais decisores do ICP que interagiram com posts da TOTVS no mês</p>
            </div>
            <button
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 border border-[#1E1E3A] rounded-lg px-3 py-1.5 transition-colors shrink-0"
              title="Disponível no plano Professional"
              onClick={() => alert("Disponível no plano Professional")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[650px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Decisor</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Empresa</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Comportamento</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Setor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { name: "Alessandro Braga", role: "CFO", company: "Gerdau", behavior: "3 comentários em posts sobre reforma tributária", sector: "Indústria" },
                  { name: "Júlia Martins", role: "Controller", company: "Ambev", behavior: "Compartilhou 2 posts da TOTVS", sector: "Bebidas" },
                  { name: "Roberto Tavares", role: "Head Fiscal", company: "Vale", behavior: "5 curtidas em posts de reforma tributária", sector: "Mineração" },
                  { name: "Camila Duarte", role: "VP de TI", company: "Localiza", behavior: "2 comentários em post sobre cloud", sector: "Serviços" },
                  { name: "Eduardo Prado", role: "CIO", company: "Mercado Livre", behavior: "Curtiu post sobre integração ERP-CRM", sector: "Varejo" },
                  { name: "Mariana Souza", role: "Dir. Financeira", company: "Natura", behavior: "Compartilhou post sobre reforma tributária", sector: "Consumo" },
                  { name: "Paulo Ribeiro", role: "CFO", company: "Raízen", behavior: "2 curtidas e 1 comentário em post do Dennis", sector: "Energia" },
                  { name: "Luciana Marques", role: "Controller", company: "Magazine Luiza", behavior: "Comentou em post fiscal", sector: "Varejo" },
                ].map((d) => (
                  <tr key={d.name}>
                    <td className="py-2.5">
                      <a href="#" className="text-sm text-white font-medium hover:text-[#E91E8C] transition-colors">{d.name}</a>
                      <span className="text-[10px] text-gray-500 ml-1.5">{d.role}</span>
                    </td>
                    <td className="py-2.5 text-gray-300 text-sm">{d.company}</td>
                    <td className="py-2.5 text-gray-400 text-xs">{d.behavior}</td>
                    <td className="py-2.5 text-gray-500 text-xs">{d.sector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 italic mt-4">Padrão claro: decisores financeiros dominam nosso engajamento — 6 dos 8. Para capturar o buyer tecnológico, é preciso conteúdo que fale diretamente com CIO/CTO.</p>
        </section>
        </>)}

        {reportTab === "analysis" && (<>
        {/* Tradução para Negócio */}
        <section id="traducao" ref={setRef("traducao")} className="rounded-2xl bg-gradient-to-br from-[#E91E8C]/10 to-[#C724D1]/10 border border-[#E91E8C]/20 p-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-white mb-4">O que esses números significam para a TOTVS</h3>
          <div className="space-y-2.5 text-sm text-gray-300">
            <p><strong className="text-white">142 decisores engajados</strong> representam <strong className="text-white">47 contas</strong> do seu ICP Enterprise — destas, 12 já são clientes e 35 são contas-alvo.</p>
            <p>O <strong className="text-white">RER de 42%</strong> está <strong className="text-white">14% acima da média do setor</strong> de software B2B no Brasil.</p>
            <p>Os <strong className="text-white">5 decisores que engajaram com a SAP</strong> movimentam <strong className="text-white">~R$ 80M em budget anual de tecnologia</strong>.</p>
            <p>A perda de <strong className="text-white">3% de SoL</strong> em IA+ERP equivale a <strong className="text-white">~20 oportunidades de top-of-funnel</strong> deixadas na mesa.</p>
          </div>
        </section>

        {/* 11. CTA */}
        <div className="text-center py-6 space-y-4">
          <p className="text-lg font-bold text-white max-w-2xl mx-auto">
            Sua marca está perdendo espaço em temas estratégicos. E se você pudesse ativar dezenas de vozes do LinkedIn que já falam direto com seu ICP?
          </p>
          <p className="text-sm text-gray-400 max-w-xl mx-auto">
            Com a Busca da BubbleIn, você encontra creators B2B rankeados pela composição da audiência — não por volume de seguidores.
          </p>
          <Link
            href="/share-of-linkedin#planos"
            className="inline-block bg-gradient-to-r from-[#E91E8C] to-[#C724D1] text-white font-semibold px-8 py-3.5 rounded-full text-sm hover:opacity-90 transition-opacity"
          >
            Encontrar creators para minha campanha
          </Link>
          <p className="text-xs text-gray-600">Também disponível: receber o relatório automaticamente no primeiro dia útil de cada mês por e-mail.</p>
        </div>
        </>)}
      </div>
    </div>
    )}
    </div>
  );
}

/* ========== MAIN PAGE ========== */
export default function ShareOfLinkedInExemploPageClient() {
  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-6">
        {/* Back link */}
        <Link href="/share-of-linkedin" className="text-xs text-gray-400 hover:text-[#E91E8C] transition-colors">
          ← Voltar para Share of LinkedIn
        </Link>

        <NewReport />

        {/* Footer */}
        <footer className="border-t border-[#1E1E3A] py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Image src="/bubblein-logo-transparente.png" alt="BubbleIn" width={135} height={36} />
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span>&copy; {new Date().getFullYear()} BubbleIn. Todos os direitos reservados.</span>
              <span className="text-gray-700">·</span>
              <a href="/termos-de-uso" className="hover:text-[#E91E8C] transition-colors">Termos de Uso</a>
              <span className="text-gray-700">·</span>
              <a href="/politica-de-privacidade" className="hover:text-[#E91E8C] transition-colors">Política de Privacidade</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
