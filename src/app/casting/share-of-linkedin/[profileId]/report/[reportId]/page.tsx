"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// Brand = purple, competitors = gray
let _mainCompanyName = "";
function setMainCompany(name: string) { _mainCompanyName = name; }

function getCompanyColor(name: string): string {
  const isMain = name.toLowerCase() === _mainCompanyName.toLowerCase();
  return isMain ? "text-[#ca98ff] bg-[#ca98ff]/10" : "text-[#8b8b8b] bg-[#8b8b8b]/10";
}

function getCompanyBarColor(name: string): string {
  const isMain = name.toLowerCase() === _mainCompanyName.toLowerCase();
  return isMain ? "#ca98ff" : "#8b8b8b";
}

function formatDelta(value: number, mainValue: number): { text: string; color: string } | null {
  if (mainValue === 0) return null;
  const delta = Math.round(((value - mainValue) / mainValue) * 100);
  if (delta === 0) return null;
  return {
    text: delta > 0 ? `+${delta}%` : `${delta}%`,
    color: delta > 0 ? "text-[#ff946e]" : "text-[#a2f31f]",
  };
}

const CONTENT_TYPE_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  produto: { label: "Produto", color: "text-[#a2f31f]", bg: "bg-[#a2f31f]" },
  institucional: { label: "Institucional", color: "text-[#38bdf8]", bg: "bg-[#38bdf8]" },
  vagas: { label: "Vagas", color: "text-[#f59e0b]", bg: "bg-[#f59e0b]" },
  outros: { label: "Outros", color: "text-white/40", bg: "bg-white/40" },
};

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} onBlur={() => setTimeout(() => setOpen(false), 150)} className="w-3.5 h-3.5 rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white flex items-center justify-center text-[9px] font-bold leading-none" aria-label="Mais informações">i</button>
      {open && <span role="tooltip" className="absolute z-50 left-5 top-1/2 -translate-y-1/2 w-64 rounded-lg bg-[#1a1919] border border-[#ca98ff]/30 px-3 py-2 text-[11px] text-white/80 font-normal normal-case tracking-normal shadow-[0_8px_24px_rgba(0,0,0,0.5)]">{text}</span>}
    </span>
  );
}

interface SolPost {
  id: string;
  profile_slug: string;
  company_name: string;
  source_type: "company" | "employee";
  author_name: string | null;
  author_headline: string | null;
  post_url: string | null;
  text_content: string | null;
  reactions: number;
  comments: number;
  posted_at: string | null;
  theme: string | null;
  content_type: string | null;
  summary: string | null;
  rer_estimate: number | null;
  rer_sample_size: number | null;
}

interface CompanyMetrics {
  posts_count: number;
  engagement_total: number;
  rer_avg: number;
  decisores_estimated: number;
  top_themes: string[];
  content_composition: Record<string, number>;
  sol_score: number;
}

interface CollabMetrics {
  name: string;
  slug: string;
  headline: string;
  posts: number;
  engagement: number;
  rer_avg: number;
  main_category: string;
  adherence: string;
}

interface ReportData {
  report: {
    id: string;
    status: string;
    period_start: string;
    period_end: string;
    created_at: string;
    metrics: {
      companies: Record<string, CompanyMetrics>;
      collaborators: Record<string, CollabMetrics[]>;
    } | null;
  };
  profile: { id: string; name: string; linkedin_url: string };
  posts: SolPost[];
}

const TABS = [
  { id: "analise", label: "Análise" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "posts", label: "Posts" },
  { id: "influencers", label: "Influencers", disabled: true },
];

const POSTS_PER_PAGE = 20;

export default function ReportPage() {
  const params = useParams();
  const profileId = params.profileId as string;
  const reportId = params.reportId as string;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("analise");

  // Post filters
  const [companyFilter, setCompanyFilter] = useState("Todos");
  const [typeFilter, setTypeFilter] = useState("all");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "engagement" | "rer">("date");
  const [page, setPage] = useState(1);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [showVagas, setShowVagas] = useState(false);

  // Conteudo tab
  const [collabCompany, setCollabCompany] = useState<string>("");
  const [chartMode, setChartMode] = useState<"sol" | "engagement" | "posts">("sol");

  // Expand company posts in sections
  const [expandedSolCompany, setExpandedSolCompany] = useState<string | null>(null);
  const [expandedRankingCompany, setExpandedRankingCompany] = useState<string | null>(null);
  const [expandedContentCompany, setExpandedContentCompany] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/sol/reports/${reportId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [reportId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const companies = useMemo(() => {
    if (!data) return [];
    const names = Array.from(new Set(data.posts.map((p) => p.company_name)));
    return ["Todos", ...names];
  }, [data]);

  const metrics = data?.report?.metrics ?? null;

  // Set default collabCompany
  useEffect(() => {
    if (data && !collabCompany) {
      const names = Array.from(new Set(data.posts.map((p) => p.company_name)));
      if (names.length > 0) setCollabCompany(names[0]);
    }
  }, [data, collabCompany]);

  const filteredPosts = useMemo(() => {
    if (!data) return [];
    let filtered = data.posts;

    if (!showVagas) filtered = filtered.filter((p) => p.content_type !== "vagas");
    if (companyFilter !== "Todos") filtered = filtered.filter((p) => p.company_name === companyFilter);
    if (typeFilter !== "all") filtered = filtered.filter((p) => p.source_type === typeFilter);
    if (contentTypeFilter !== "all") filtered = filtered.filter((p) => p.content_type === contentTypeFilter);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter((p) => (p.text_content ?? "").toLowerCase().includes(q) || (p.author_name ?? "").toLowerCase().includes(q));
    }

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "engagement") return (b.reactions + b.comments) - (a.reactions + a.comments);
      if (sortBy === "rer") return (b.rer_estimate ?? 0) - (a.rer_estimate ?? 0);
      return new Date(b.posted_at ?? 0).getTime() - new Date(a.posted_at ?? 0).getTime();
    });
    return filtered;
  }, [data, companyFilter, typeFilter, contentTypeFilter, searchText, sortBy, showVagas]);

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = filteredPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);
  useEffect(() => { setPage(1); }, [companyFilter, typeFilter, contentTypeFilter, searchText, sortBy, showVagas]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-[#ca98ff]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <span className="text-white/60">Carregando relatório...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 mb-4">Relatório não encontrado.</p>
          <Link href={`/casting/share-of-linkedin/${profileId}`} className="text-[#ca98ff] hover:underline text-sm">← Voltar ao mapeamento</Link>
        </div>
      </div>
    );
  }

  const periodStart = new Date(data.report.period_start + "T12:00:00");
  const periodLabel = periodStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Derived company names (without "Todos")
  const companyNames = companies.filter((c) => c !== "Todos");
  const profileCompanyName = data.profile.name;
  setMainCompany(profileCompanyName);

  // Main company metrics for delta comparisons
  const mainMetrics = metrics?.companies[profileCompanyName] ?? null;

  return (
    <div className="min-h-screen bg-[#131313] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <Link href={`/casting/share-of-linkedin/${profileId}`} className="text-xs text-[#adaaaa] hover:text-[#ca98ff] transition-colors">← Voltar ao mapeamento</Link>

        <div>
          <h1 className="text-2xl font-extrabold text-white font-[family-name:var(--font-lexend)]">
            Relatório Share of <span className="bg-gradient-to-r from-[#ca98ff] to-[#e197fc] bg-clip-text text-transparent">LinkedIn</span>
          </h1>
          <p className="text-sm text-white/40 mt-1 capitalize">{data.profile.name} — {periodLabel}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/[0.02] border border-white/10 rounded-full p-0.5 w-fit">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => !tab.disabled && setActiveTab(tab.id)} className={`px-5 py-2 rounded-full text-xs font-medium transition-colors ${activeTab === tab.id ? "bg-[#ca98ff]/20 text-[#ca98ff]" : tab.disabled ? "text-white/20 cursor-not-allowed" : "text-white/50 hover:text-white/70"}`} title={tab.disabled ? "Em breve" : undefined}>
              {tab.label}{tab.disabled && <span className="ml-1 text-[9px] text-white/20">Em breve</span>}
            </button>
          ))}
        </div>

        {/* ============================================================ */}
        {/* ANÁLISE TAB */}
        {/* ============================================================ */}
        {activeTab === "analise" && metrics && (
          <div className="space-y-6">
            {/* SOL Chart */}
            <div className="rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white font-[family-name:var(--font-lexend)]">
                    Share of LinkedIn
                    <InfoTooltip text="Estimativa baseada em amostragem de 10-20 engajadores por post. O SOL combina volume de posts, engajamento e taxa de decisores (RER) para medir presença competitiva." />
                  </h3>
                </div>
                <div className="flex gap-1 bg-white/[0.02] border border-white/10 rounded-full p-0.5">
                  {(["sol", "engagement", "posts"] as const).map((m) => (
                    <button key={m} onClick={() => setChartMode(m)} className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${chartMode === m ? "bg-[#ca98ff]/20 text-[#ca98ff]" : "text-white/40 hover:text-white/60"}`}>
                      {m === "sol" ? "SOL" : m === "engagement" ? "Engajamento" : "Posts"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {Object.entries(metrics.companies)
                  .sort((a, b) => {
                    if (chartMode === "sol") return b[1].sol_score - a[1].sol_score;
                    if (chartMode === "engagement") return b[1].engagement_total - a[1].engagement_total;
                    return b[1].posts_count - a[1].posts_count;
                  })
                  .map(([name, cm]) => {
                    const value = chartMode === "sol" ? cm.sol_score : chartMode === "engagement" ? cm.engagement_total : cm.posts_count;
                    const maxValue = Math.max(...Object.values(metrics.companies).map((c) => chartMode === "sol" ? c.sol_score : chartMode === "engagement" ? c.engagement_total : c.posts_count), 1);
                    const pct = Math.round((value / maxValue) * 100);
                    const isMain = name.toLowerCase() === profileCompanyName.toLowerCase();
                    const barColor = getCompanyBarColor(name);
                    const isSolExpanded = expandedSolCompany === name;
                    const companyPosts = isSolExpanded ? data.posts.filter((p) => p.company_name === name && p.content_type !== "vagas") : [];
                    return (
                      <div key={name}>
                        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setExpandedSolCompany(isSolExpanded ? null : name)}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 text-white/30 ${isSolExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
                          <span className={`text-xs w-32 truncate text-right ${isMain ? "text-[#ca98ff] font-bold" : "text-white/60"} group-hover:text-white/80`}>{name}</span>
                          <div className="flex-1 h-6 bg-white/[0.03] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: barColor }} />
                          </div>
                          <span className="text-xs font-bold text-white/80 w-12 text-right tabular-nums">
                            {chartMode === "sol" ? value.toFixed(1) : value.toLocaleString("pt-BR")}
                          </span>
                          {!isMain && mainMetrics && (() => {
                            const mv = chartMode === "sol" ? mainMetrics.sol_score : chartMode === "engagement" ? mainMetrics.engagement_total : mainMetrics.posts_count;
                            const d = formatDelta(value, mv);
                            return d ? <span className={`text-[10px] font-bold shrink-0 w-14 text-right ${d.color}`}>{d.text}</span> : <span className="w-14 shrink-0" />;
                          })()}
                        </div>
                        {isSolExpanded && (
                          <div className="ml-12 mt-2 mb-1 space-y-1">
                            {/* SOL breakdown */}
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/40 px-3 py-2 bg-white/[0.02] rounded-lg border border-white/[0.04] mb-1">
                              <span className="font-medium text-white/50">SOL =</span>
                              <span className="text-white/70 font-bold">{cm.posts_count}</span><span>posts</span>
                              <span>×</span>
                              <span className="text-white/70 font-bold">{cm.rer_avg}%</span><span>RER</span>
                              <span>×</span>
                              <span className="text-white/70 font-bold">{cm.engagement_total.toLocaleString("pt-BR")}</span><span>engaj.</span>
                              <span>=</span>
                              <span className="text-white/90 font-black">{cm.sol_score.toFixed(1)}</span>
                            </div>
                            {companyPosts.slice(0, 10).map((p) => {
                              const eng = p.reactions + p.comments;
                              return (
                                <a key={p.id} href={p.post_url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-xs py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-[#ca98ff]/20 transition-colors" onClick={(e) => { if (!p.post_url) e.preventDefault(); }}>
                                  <span className="flex-1 text-white/60 truncate">{p.summary ?? (p.text_content ?? "").slice(0, 80)}</span>
                                  <span className="text-white/40 tabular-nums shrink-0">{eng.toLocaleString("pt-BR")} engaj.</span>
                                  {p.rer_estimate != null && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.rer_estimate >= 30 ? "text-[#a2f31f] bg-[#a2f31f]/10" : p.rer_estimate >= 15 ? "text-[#f59e0b] bg-[#f59e0b]/10" : "text-[#ff946e] bg-[#ff946e]/10"}`}>
                                      RER {p.rer_estimate}%
                                    </span>
                                  )}
                                  {p.post_url && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20 shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>}
                                </a>
                              );
                            })}
                            {companyPosts.length > 10 && <p className="text-[10px] text-white/30 pl-3">+{companyPosts.length - 10} posts</p>}
                            <button onClick={() => { setActiveTab("posts"); setCompanyFilter(name); window.scrollTo(0, 0); }} className="text-[10px] text-[#ca98ff] hover:underline pl-3 mt-1">Ver todos os posts de {name} →</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Ranking table */}
            <div className="rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-bold text-white font-[family-name:var(--font-lexend)] mb-4">Ranking Competitivo</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="py-2.5 pr-3 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase w-8">#</th>
                      <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase">Empresa</th>
                      <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase text-center">Posts</th>
                      <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase text-center">Engaj.</th>
                      <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase text-center">RER</th>
                      <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase text-center">Decisores</th>
                      <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase">Top Temas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.entries(metrics.companies)
                      .sort((a, b) => b[1].sol_score - a[1].sol_score)
                      .map(([name, cm], idx) => {
                        const isMain = name.toLowerCase() === profileCompanyName.toLowerCase();
                        const rerColor = cm.rer_avg >= 30 ? "text-[#a2f31f] bg-[#a2f31f]/10" : cm.rer_avg >= 15 ? "text-[#f59e0b] bg-[#f59e0b]/10" : "text-[#ff946e] bg-[#ff946e]/10";
                        const isRankExpanded = expandedRankingCompany === name;
                        const rankPosts = isRankExpanded ? data.posts.filter((p) => p.company_name === name && p.content_type !== "vagas") : [];
                        return (
                          <React.Fragment key={name}>
                            <tr className={`cursor-pointer hover:bg-white/[0.02] ${isMain ? "bg-[#ca98ff]/[0.06]" : ""}`} onClick={() => setExpandedRankingCompany(isRankExpanded ? null : name)}>
                              <td className="py-3 pr-3"><span className={`text-xs font-black ${idx === 0 ? "text-[#f59e0b]" : idx === 1 ? "text-[#adaaaa]" : idx === 2 ? "text-[#cd7f32]" : "text-white/30"}`}>{idx + 1}</span></td>
                              <td className={`py-3 font-medium ${isMain ? "text-[#ca98ff]" : "text-white/80"}`}>
                                <span className="flex items-center gap-1.5">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 text-white/30 ${isRankExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
                                  {name}
                                </span>
                              </td>
                              <td className="py-3 text-center text-white/60">
                                <div>{cm.posts_count}</div>
                                {!isMain && mainMetrics && (() => { const d = formatDelta(cm.posts_count, mainMetrics.posts_count); return d ? <div className={`text-[9px] ${d.color}`}>{d.text}</div> : null; })()}
                              </td>
                              <td className="py-3 text-center text-white/60">
                                <div>{cm.engagement_total.toLocaleString("pt-BR")}</div>
                                {!isMain && mainMetrics && (() => { const d = formatDelta(cm.engagement_total, mainMetrics.engagement_total); return d ? <div className={`text-[9px] ${d.color}`}>{d.text}</div> : null; })()}
                              </td>
                              <td className="py-3 text-center">
                                <div><span className={`${rerColor} text-xs font-bold px-2 py-0.5 rounded-full`}>{cm.rer_avg}%</span></div>
                                {!isMain && mainMetrics && (() => { const d = formatDelta(cm.rer_avg, mainMetrics.rer_avg); return d ? <div className={`text-[9px] ${d.color}`}>{d.text}</div> : null; })()}
                              </td>
                              <td className="py-3 text-center text-white/60">
                                <div>{cm.decisores_estimated}</div>
                                {!isMain && mainMetrics && (() => { const d = formatDelta(cm.decisores_estimated, mainMetrics.decisores_estimated); return d ? <div className={`text-[9px] ${d.color}`}>{d.text}</div> : null; })()}
                              </td>
                              <td className="py-3 text-white/50 text-xs">{cm.top_themes.join(", ")}</td>
                            </tr>
                            {isRankExpanded && rankPosts.length > 0 && (
                              <tr>
                                <td colSpan={7} className="p-0">
                                  <div className="px-6 py-3 bg-white/[0.01] space-y-1">
                                    {rankPosts.slice(0, 10).map((p) => {
                                      const eng = p.reactions + p.comments;
                                      return (
                                        <a key={p.id} href={p.post_url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-xs py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-[#ca98ff]/20 transition-colors" onClick={(e) => { if (!p.post_url) e.preventDefault(); }}>
                                          <span className="flex-1 text-white/60 truncate">{p.summary ?? (p.text_content ?? "").slice(0, 80)}</span>
                                          <span className="text-white/40 tabular-nums shrink-0">{eng.toLocaleString("pt-BR")} engaj.</span>
                                          {p.rer_estimate != null && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.rer_estimate >= 30 ? "text-[#a2f31f] bg-[#a2f31f]/10" : p.rer_estimate >= 15 ? "text-[#f59e0b] bg-[#f59e0b]/10" : "text-[#ff946e] bg-[#ff946e]/10"}`}>
                                              RER {p.rer_estimate}%
                                            </span>
                                          )}
                                          {p.post_url && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20 shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>}
                                        </a>
                                      );
                                    })}
                                    {rankPosts.length > 10 && <p className="text-[10px] text-white/30 pl-3">+{rankPosts.length - 10} posts</p>}
                                    <button onClick={(e) => { e.stopPropagation(); setActiveTab("posts"); setCompanyFilter(name); window.scrollTo(0, 0); }} className="text-[10px] text-[#ca98ff] hover:underline pl-3 mt-1">Ver todos os posts de {name} →</button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "analise" && !metrics && (
          <div className="text-center py-12">
            <p className="text-white/40 text-sm">Métricas ainda não calculadas. Aguarde o processamento completo.</p>
          </div>
        )}

        {/* ============================================================ */}
        {/* CONTEÚDO TAB */}
        {/* ============================================================ */}
        {activeTab === "conteudo" && (
          <div className="space-y-6">
            {/* Content composition bars */}
            <div className="rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white font-[family-name:var(--font-lexend)]">Análise de Conteúdo por Empresa</h3>
                  <p className="text-xs text-white/40 mt-1">Composição dos posts por categoria</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showVagas} onChange={(e) => setShowVagas(e.target.checked)} className="sr-only peer" />
                  <div className="w-8 h-4 bg-white/10 rounded-full peer-checked:bg-[#f59e0b]/30 relative transition-colors">
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform ${showVagas ? "translate-x-4 bg-[#f59e0b]" : "bg-white/40"}`} />
                  </div>
                  <span className="text-[10px] text-white/40">Mostrar vagas</span>
                </label>
              </div>
              <div className="space-y-4">
                {companyNames.map((name) => {
                  const compPosts = data.posts.filter((p) => p.company_name === name);
                  const counts: Record<string, number> = { produto: 0, institucional: 0, vagas: 0, outros: 0 };
                  compPosts.forEach((p) => { counts[p.content_type ?? "outros"] = (counts[p.content_type ?? "outros"] ?? 0) + 1; });
                  const total = showVagas ? compPosts.length : compPosts.length - counts.vagas;
                  if (total === 0) return null;
                  const types = showVagas ? ["produto", "institucional", "vagas", "outros"] : ["produto", "institucional", "outros"];
                  const isContentExpanded = expandedContentCompany === name;
                  const contentPosts = isContentExpanded ? compPosts.filter((p) => showVagas || p.content_type !== "vagas") : [];
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1.5 cursor-pointer group" onClick={() => setExpandedContentCompany(isContentExpanded ? null : name)}>
                        <span className={`text-xs font-medium flex items-center gap-1.5 group-hover:text-white/90 ${name.toLowerCase() === profileCompanyName.toLowerCase() ? "text-[#ca98ff]" : "text-white/70"}`}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 text-white/30 ${isContentExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
                          {name}
                        </span>
                        <span className="text-[10px] text-white/30">
                          {total} posts
                          {name.toLowerCase() !== profileCompanyName.toLowerCase() && mainMetrics && (() => {
                            const mainTotal = showVagas
                              ? data.posts.filter((p) => p.company_name === profileCompanyName).length
                              : data.posts.filter((p) => p.company_name === profileCompanyName && p.content_type !== "vagas").length;
                            const d = formatDelta(total, mainTotal);
                            return d ? <span className={`ml-1 ${d.color}`}>{d.text}</span> : null;
                          })()}
                        </span>
                      </div>
                      <div className="flex h-5 rounded-full overflow-hidden bg-white/[0.03]">
                        {types.map((type) => {
                          const count = counts[type] ?? 0;
                          const pct = total > 0 ? (count / total) * 100 : 0;
                          if (pct === 0) return null;
                          const ct = CONTENT_TYPE_COLORS[type];
                          return <div key={type} className={`${ct.bg} ${type === "vagas" ? "opacity-40" : ""} h-full`} style={{ width: `${pct}%` }} title={`${ct.label}: ${count} (${Math.round(pct)}%)`} />;
                        })}
                      </div>
                      <div className="flex gap-3 mt-1">
                        {types.map((type) => {
                          const count = counts[type] ?? 0;
                          if (count === 0) return null;
                          const ct = CONTENT_TYPE_COLORS[type];
                          return <span key={type} className={`text-[9px] ${ct.color} ${type === "vagas" ? "opacity-40" : ""}`}>{ct.label} {count}</span>;
                        })}
                      </div>
                      {isContentExpanded && contentPosts.length > 0 && (
                        <div className="mt-2 mb-1 space-y-1">
                          {contentPosts.slice(0, 10).map((p) => {
                            const eng = p.reactions + p.comments;
                            const ct = CONTENT_TYPE_COLORS[p.content_type ?? "outros"];
                            return (
                              <a key={p.id} href={p.post_url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-xs py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-[#ca98ff]/20 transition-colors" onClick={(e) => { if (!p.post_url) e.preventDefault(); }}>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${ct.color} ${ct.bg}/10`}>{ct.label}</span>
                                <span className="flex-1 text-white/60 truncate">{p.summary ?? (p.text_content ?? "").slice(0, 80)}</span>
                                <span className="text-white/40 tabular-nums shrink-0">{eng.toLocaleString("pt-BR")} engaj.</span>
                                {p.rer_estimate != null && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.rer_estimate >= 30 ? "text-[#a2f31f] bg-[#a2f31f]/10" : p.rer_estimate >= 15 ? "text-[#f59e0b] bg-[#f59e0b]/10" : "text-[#ff946e] bg-[#ff946e]/10"}`}>
                                    RER {p.rer_estimate}%
                                  </span>
                                )}
                                {p.post_url && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20 shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>}
                              </a>
                            );
                          })}
                          {contentPosts.length > 10 && <p className="text-[10px] text-white/30 pl-3">+{contentPosts.length - 10} posts</p>}
                          <button onClick={() => { setActiveTab("posts"); setCompanyFilter(name); window.scrollTo(0, 0); }} className="text-[10px] text-[#ca98ff] hover:underline pl-3 mt-1">Ver todos os posts de {name} →</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Highlight posts per company */}
            <div className="rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-bold text-white font-[family-name:var(--font-lexend)] mb-4">Posts em Destaque</h3>
              <div className="space-y-6">
                {companyNames.map((name) => {
                  const compPosts = data.posts.filter((p) => p.company_name === name && p.content_type !== "vagas");
                  if (compPosts.length === 0) return null;
                  const withRer = compPosts.filter((p) => p.rer_estimate != null);
                  const bestRer = withRer.length > 0 ? withRer.sort((a, b) => (b.rer_estimate ?? 0) - (a.rer_estimate ?? 0))[0] : null;
                  const worstRer = withRer.length > 1 ? withRer.sort((a, b) => (a.rer_estimate ?? 0) - (b.rer_estimate ?? 0))[0] : null;
                  const avgEng = compPosts.reduce((s, p) => s + p.reactions + p.comments, 0) / compPosts.length;
                  const unexpected = compPosts.filter((p) => (p.reactions + p.comments) > avgEng * 2 && (p.rer_estimate ?? 100) < 20).sort((a, b) => (b.reactions + b.comments) - (a.reactions + a.comments))[0] ?? null;

                  const highlights = [
                    bestRer && { type: "positive", label: "Melhor RER", icon: "text-[#a2f31f]", post: bestRer },
                    worstRer && worstRer.id !== bestRer?.id && { type: "negative", label: "Menor RER", icon: "text-[#ff946e]", post: worstRer },
                    unexpected && unexpected.id !== bestRer?.id && unexpected.id !== worstRer?.id && { type: "unexpected", label: "Inesperado", icon: "text-[#f59e0b]", post: unexpected },
                  ].filter(Boolean);

                  if (highlights.length === 0) return null;

                  return (
                    <div key={name}>
                      <p className={`text-xs font-bold mb-2 ${getCompanyColor(name).split(" ")[0]}`}>{name}</p>
                      <div className="flex flex-wrap gap-3">
                        {highlights.map((h) => {
                          if (!h) return null;
                          const p = h.post;
                          const postDate = p.posted_at ? new Date(p.posted_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
                          const ct = CONTENT_TYPE_COLORS[p.content_type ?? "outros"];
                          return (
                            <div key={h.type} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2 min-w-[280px] flex-1">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-bold ${h.icon}`}>{h.label}</span>
                                <div className="flex items-center gap-2">
                                  {p.content_type && <span className={`text-[9px] px-1.5 py-0.5 rounded ${ct.color} ${ct.bg}/10`}>{ct.label}</span>}
                                  {p.rer_estimate != null && <span className="text-[10px] font-bold text-white/40">RER {p.rer_estimate}%</span>}
                                </div>
                              </div>
                              <p className="text-xs text-white/70 line-clamp-3">{p.summary ?? (p.text_content ?? "").slice(0, 120)}</p>
                              <p className="text-[10px] text-white/30">{p.author_name} — {p.reactions + p.comments} engaj.{postDate && ` — ${postDate}`}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Collaborator performance */}
            {metrics && (
              <div className="rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white font-[family-name:var(--font-lexend)] mb-4">Desempenho dos Colaboradores</h3>
                <div className="flex gap-1 bg-white/[0.02] border border-white/10 rounded-full p-0.5 w-fit mb-4">
                  {companyNames.map((c) => (
                    <button key={c} onClick={() => setCollabCompany(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${collabCompany === c ? "bg-[#ca98ff]/20 text-[#ca98ff]" : "text-white/40 hover:text-white/60"}`}>{c}</button>
                  ))}
                </div>
                {(metrics.collaborators[collabCompany] ?? []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="py-2 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase">Nome</th>
                          <th className="py-2 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase text-center">Posts</th>
                          <th className="py-2 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase text-center">Engaj.</th>
                          <th className="py-2 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase text-center">RER</th>
                          <th className="py-2 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase">Categoria</th>
                          <th className="py-2 text-[0.6rem] font-bold tracking-widest text-white/40 uppercase">Aderência</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(metrics.collaborators[collabCompany] ?? []).map((col) => {
                          const adherenceColor = col.adherence === "alta" ? "text-[#a2f31f] bg-[#a2f31f]/10" : col.adherence === "média" ? "text-[#f59e0b] bg-[#f59e0b]/10" : "text-[#ff946e] bg-[#ff946e]/10";
                          return (
                            <tr key={col.slug}>
                              <td className="py-2.5">
                                <p className="text-sm text-white/80 font-medium">{col.name}</p>
                                {col.headline && <p className="text-[10px] text-white/30 truncate max-w-[200px]">{col.headline}</p>}
                              </td>
                              <td className="py-2.5 text-center text-white/60 text-sm">{col.posts}</td>
                              <td className="py-2.5 text-center text-white/60 text-sm">{col.engagement}</td>
                              <td className="py-2.5 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.rer_avg >= 30 ? "text-[#a2f31f] bg-[#a2f31f]/10" : col.rer_avg >= 15 ? "text-[#f59e0b] bg-[#f59e0b]/10" : "text-[#ff946e] bg-[#ff946e]/10"}`}>{col.rer_avg}%</span></td>
                              <td className="py-2.5 text-white/50 text-xs capitalize">{col.main_category}</td>
                              <td className="py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${adherenceColor}`}>{col.adherence}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-white/30">Nenhum colaborador com posts neste período.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* POSTS TAB */}
        {/* ============================================================ */}
        {activeTab === "posts" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1 bg-white/[0.02] border border-white/10 rounded-full p-0.5">
                {companies.map((c) => (
                  <button key={c} onClick={() => setCompanyFilter(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${companyFilter === c ? "bg-[#ca98ff]/20 text-[#ca98ff]" : "text-white/40 hover:text-white/60"}`}>{c}</button>
                ))}
              </div>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60">
                <option value="all">Todos os tipos</option>
                <option value="company">Perfil oficial</option>
                <option value="employee">Colaboradores</option>
              </select>
              <select value={contentTypeFilter} onChange={(e) => setContentTypeFilter(e.target.value)} className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60">
                <option value="all">Todas categorias</option>
                <option value="produto">Produto</option>
                <option value="institucional">Institucional</option>
                <option value="vagas">Vagas</option>
                <option value="outros">Outros</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "date" | "engagement" | "rer")} className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60">
                <option value="date">Mais recentes</option>
                <option value="engagement">Maior engajamento</option>
                <option value="rer">Maior RER</option>
              </select>
              <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Buscar..." className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 w-40" />
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showVagas} onChange={(e) => setShowVagas(e.target.checked)} className="sr-only peer" />
                <div className="w-7 h-3.5 bg-white/10 rounded-full peer-checked:bg-[#f59e0b]/30 relative transition-colors">
                  <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-transform ${showVagas ? "translate-x-3.5 bg-[#f59e0b]" : "bg-white/40"}`} />
                </div>
                <span className="text-[10px] text-white/30">Vagas</span>
              </label>
              <span className="text-xs text-white/30">{filteredPosts.length} posts</span>
            </div>

            {/* Column headers */}
            <div className="flex items-center gap-3 px-5 py-2 border-b border-white/10">
              <span className="w-[10px] shrink-0" />
              <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase shrink-0 w-auto">Empresa</span>
              <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase shrink-0">Tipo</span>
              <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase shrink-0">Categoria</span>
              <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase flex-1">Conteúdo / Autor</span>
              <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase shrink-0 hidden sm:inline">Data</span>
              <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase w-14 text-right shrink-0">Engaj.</span>
              <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase shrink-0">RER</span>
              <span className="w-[14px] shrink-0" />
            </div>

            <div className="space-y-2">
              {paginatedPosts.map((post) => {
                const isExpanded = expandedPost === post.id;
                const preview = (post.text_content ?? "").length > 150 ? (post.text_content ?? "").slice(0, 150) + "..." : (post.text_content ?? "");
                const engagement = post.reactions + post.comments;
                const postedDate = post.posted_at ? new Date(post.posted_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";
                const rerColor = post.rer_estimate != null ? (post.rer_estimate >= 30 ? "text-[#a2f31f] bg-[#a2f31f]/10" : post.rer_estimate >= 15 ? "text-[#f59e0b] bg-[#f59e0b]/10" : "text-[#ff946e] bg-[#ff946e]/10") : "";
                const ct = CONTENT_TYPE_COLORS[post.content_type ?? "outros"];

                return (
                  <div key={post.id} className={`bg-white/[0.02] border rounded-xl px-5 py-3.5 cursor-pointer transition-colors ${isExpanded ? "border-[#ca98ff]/30" : "border-white/[0.06] hover:border-[#ca98ff]/20"}`} onClick={() => setExpandedPost(isExpanded ? null : post.id)}>
                    <div className="flex items-center gap-3">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 text-white/30 ${isExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${getCompanyColor(post.company_name)}`}>{post.company_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${post.source_type === "company" ? "text-[#38bdf8] bg-[#38bdf8]/10" : "text-white/40 bg-white/5"}`}>
                        {post.source_type === "company" ? "Oficial" : "Colab."}
                      </span>
                      {post.content_type && <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${ct.color} ${ct.bg.replace("bg-", "bg-")}/10`}>{ct.label}</span>}
                      <div className="flex-1 min-w-0">
                        {!isExpanded && <p className="text-sm text-white/80 truncate">{post.summary ?? preview}</p>}
                        <p className="text-[10px] text-white/40 mt-0.5">{post.author_name ?? post.profile_slug}</p>
                      </div>
                      <span className="text-[10px] text-white/30 shrink-0 hidden sm:inline">{postedDate}</span>
                      <span className="text-xs text-white/60 font-medium tabular-nums w-14 text-right shrink-0">{engagement.toLocaleString("pt-BR")}</span>
                      {post.rer_estimate != null && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${rerColor}`} title="Estimativa baseada em amostragem de 10-20 engajadores por post">
                          RER {post.rer_estimate}%
                        </span>
                      )}
                      {post.post_url && (
                        <a href={post.post_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-white/30 hover:text-[#ca98ff] transition-colors shrink-0" title="Ver post no LinkedIn">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pl-8 border-t border-white/[0.06] pt-3 space-y-2">
                        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{post.text_content}</p>
                        {post.theme && <span className="inline-block text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded">{post.theme}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              {paginatedPosts.length === 0 && <div className="text-center py-12"><p className="text-white/40 text-sm">Nenhum post encontrado.</p></div>}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center py-4 gap-3">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-full bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/40 hover:text-white disabled:opacity-50 transition-colors">Anterior</button>
                <span className="text-xs text-white/40">Página {page} de {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-full bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/40 hover:text-white disabled:opacity-50 transition-colors">Próxima</button>
              </div>
            )}
            <p className="text-center text-xs text-white/30">{filteredPosts.length} posts no período</p>
          </div>
        )}

        {/* Influencers placeholder */}
        {activeTab === "influencers" && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#ca98ff]/10 border border-[#ca98ff]/20 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ca98ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-[family-name:var(--font-lexend)]">Em breve</h3>
            <p className="text-sm text-white/40">Esta seção será habilitada nas próximas etapas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
