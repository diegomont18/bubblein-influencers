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

  let text: string;
  if (Math.abs(delta) > 100) {
    const multiplier = Math.abs(value / mainValue);
    const formatted = multiplier >= 10 ? `${Math.round(multiplier)}x` : `${multiplier.toFixed(1).replace(/\.0$/, "")}x`;
    text = delta > 0 ? `+${formatted}` : `-${formatted}`;
  } else {
    text = delta > 0 ? `+${delta}%` : `${delta}%`;
  }

  return {
    text,
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

interface SovTotals {
  brand_owner: "main" | "competitor";
  positivo: number;
  neutro: number;
  negativo: number;
}

interface SovMention {
  company_name: string;
  brand_owner: "main" | "competitor";
  brand_term: string;
  author_name: string;
  author_role: string;
  author_company: string;
  author_linkedin_url: string;
  followers: number;
  post_url: string;
  text: string;
  posted_at: string | null;
  reactions: number;
  comments: number;
  sentiment: "positivo" | "neutro" | "negativo";
  summary: string;
}

interface InfluencerCard {
  name: string;
  role: string;
  company: string;
  linkedin_url: string;
  followers: number;
  posts_about: number;
  themes_covered: string[];
  brands_mentioned: Array<{ brand: string; brand_owner: "main" | "competitor"; company_name: string }>;
  avg_engagement: number;
  frequency: number;
  sentiment: "positivo" | "neutro" | "negativo";
  potential: "alto" | "médio" | "baixo";
  profile_photo?: string;
  slug?: string;
  posts_per_month?: number;
  avg_likes?: number | null;
  avg_comments?: number | null;
}

interface InfluencerMentionRow {
  date: string;
  text: string;
  brand?: string;
  brand_owner?: "main" | "competitor";
  sentiment?: "positivo" | "neutro" | "negativo";
  post_url?: string;
}

interface RecommendationItem {
  id: number;
  title: string;
  tag: "DEFENSIVA" | "CONTEÚDO" | "OFENSIVA" | "CONSOLIDACAO" | "RELACIONAMENTO";
  urgency: "alta" | "média" | "baixa";
  desc: string;
  who: string;
  details: string;
}

interface RecommendationsPayload {
  insights?: {
    positives: Array<{ title: string; description: string }>;
    concerns: Array<{ title: string; description: string }>;
  };
  recommendations?: RecommendationItem[];
  movements?: Array<{ company: string; text: string }>;
}

interface RawDataPayload {
  sov?: { totals_by_company: Record<string, SovTotals>; mentions: SovMention[] };
  influencers?: InfluencerCard[];
  influencer_mentions?: Record<string, InfluencerMentionRow[]>;
  archived_influencers?: string[];
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
    raw_data: RawDataPayload | null;
    recommendations: RecommendationsPayload | null;
    ai_incomplete?: boolean;
  };
  profile: { id: string; name: string; linkedin_url: string };
  options?: {
    market_context?: string;
    proprietary_brands?: string[];
    competitors?: Array<{ name?: string; selected?: boolean; url?: string }>;
    ai_response?: Record<string, unknown>;
  };
  posts: SolPost[];
}

const TABS: Array<{ id: string; label: string; disabled?: boolean }> = [
  { id: "analise", label: "Análise" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "posts", label: "Posts" },
  { id: "influencers", label: "Influencers" },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TAG_COLORS: Record<RecommendationItem["tag"], string> = {
  DEFENSIVA: "text-red-400 bg-red-400/10 border-red-400/20",
  "CONTEÚDO": "text-blue-400 bg-blue-400/10 border-blue-400/20",
  OFENSIVA: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  CONSOLIDACAO: "text-green-400 bg-green-400/10 border-green-400/20",
  RELACIONAMENTO: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

const SENTIMENT_COLORS: Record<"positivo" | "neutro" | "negativo", { text: string; bg: string; bar: string; label: string }> = {
  positivo: { text: "text-[#a2f31f]", bg: "bg-[#a2f31f]/10", bar: "#a2f31f", label: "Positivo" },
  neutro: { text: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", bar: "#f59e0b", label: "Neutro" },
  negativo: { text: "text-[#ff946e]", bg: "bg-[#ff946e]/10", bar: "#ff946e", label: "Negativo" },
};

function cleanSnippetText(text: string): string {
  return text
    .replace(/\b(Denunciar est[ea] (comentário|comentario|publicação|publicacao|post)|Report this (comment|post))\b\.?/gi, "")
    .replace(/\b(Curtir|Comentar|Compartilhar|Like|Comment|Share|Repost)\b/g, "")
    .replace(/,?\s*\d+\s*(sem|d|h|min)\.?(\s|,|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  if (!keywords.length) return text;
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <span key={i} className="text-[#ca98ff] font-semibold">{part}</span>
      : part
  );
}

const POTENTIAL_INFO: Record<string, { label: string; description: string }> = {
  alto: { label: "Alto", description: "+30k seguidores ou 2+ citações da sua marca" },
  "médio": { label: "Médio", description: "+10k seguidores ou 1 citação da sua marca" },
  baixo: { label: "Baixo", description: "Abaixo dos critérios anteriores" },
};

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
  const [chartMode, setChartMode] = useState<"sol" | "engagement" | "posts" | "sov">("sol");

  // Expand company posts in sections
  const [expandedSolCompany, setExpandedSolCompany] = useState<string | null>(null);
  const [expandedRankingCompany, setExpandedRankingCompany] = useState<string | null>(null);
  const [expandedContentCompany, setExpandedContentCompany] = useState<string | null>(null);

  // Recommendations like/dislike (ephemeral)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [recVotes, setRecVotes] = useState<Record<number, "like" | "dislike">>({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [expandedRec, setExpandedRec] = useState<number | null>(null);
  // Influencers tab state
  const [expandedInfluencer, setExpandedInfluencer] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reprocessingInfluencers, setReprocessingInfluencers] = useState(false);
  const [showArchivedInfluencers, setShowArchivedInfluencers] = useState(false);
  const [archivingInfluencer, setArchivingInfluencer] = useState<string | null>(null);
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [editingTerms, setEditingTerms] = useState(false);
  const [termsValue, setTermsValue] = useState("");
  const [savingTerms, setSavingTerms] = useState(false);

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

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.user?.role === "admin") setIsAdmin(true); })
      .catch(() => {});
  }, []);

  const companies = useMemo(() => {
    if (!data) return [];
    const names = Array.from(new Set(data.posts.map((p) => p.company_name)));
    return ["Todos", ...names];
  }, [data]);

  const metrics = data?.report?.metrics ?? null;
  const sovTotals = data?.report?.raw_data?.sov?.totals_by_company ?? null;
  const recommendationsPayload = data?.report?.recommendations ?? null;
  const allInfluencerCards = data?.report?.raw_data?.influencers ?? [];
  const archivedInfluencerKeys = data?.report?.raw_data?.archived_influencers ?? [];
  const archivedSet = useMemo(() => new Set(archivedInfluencerKeys), [archivedInfluencerKeys]);
  const influencerCards = useMemo(() => allInfluencerCards.filter((c) => !archivedSet.has(c.linkedin_url || c.name)), [allInfluencerCards, archivedSet]);
  const archivedInfluencerCards = useMemo(() => allInfluencerCards.filter((c) => archivedSet.has(c.linkedin_url || c.name)), [allInfluencerCards, archivedSet]);
  const influencerMentionsByKey = data?.report?.raw_data?.influencer_mentions ?? {};

  // All monitored keywords (themes + all brands) for mention highlighting
  const allMonitoredKeywords = useMemo(() => {
    const keywords: string[] = [];
    const mc = data?.options?.market_context ?? "";
    keywords.push(...mc.split(",").map(t => t.trim()).filter(t => t));
    const brands = (data?.options?.proprietary_brands ?? []) as string[];
    keywords.push(...brands.filter(b => typeof b === "string" && b.trim()));
    const aiResp = (data?.options?.ai_response ?? {}) as Record<string, unknown>;
    const compBrands = (aiResp.competitor_brands ?? {}) as Record<string, unknown>;
    for (const brandList of Object.values(compBrands)) {
      if (Array.isArray(brandList)) keywords.push(...brandList.filter((b): b is string => typeof b === "string" && b.trim().length > 0));
    }
    return Array.from(new Set(keywords));
  }, [data]);

  // Brand groups for the terms display
  const brandGroups = useMemo(() => {
    const groups: Array<{ name: string; type: "themes" | "main" | "competitor"; brands: string[] }> = [];
    const mc = data?.options?.market_context ?? "";
    const themesList = mc.split(",").map(t => t.trim()).filter(t => t);
    if (themesList.length > 0) groups.push({ name: "Temas do mercado", type: "themes", brands: themesList });
    const mainBrands = (data?.options?.proprietary_brands ?? []) as string[];
    const filtered = mainBrands.filter(b => typeof b === "string" && b.trim());
    if (filtered.length > 0) groups.push({ name: data?.profile?.name ?? "Empresa", type: "main", brands: filtered });
    const competitors = (data?.options?.competitors ?? []) as Array<{ name?: string; selected?: boolean }>;
    const aiResp = (data?.options?.ai_response ?? {}) as Record<string, unknown>;
    const compBrandsMap = (aiResp.competitor_brands ?? {}) as Record<string, unknown>;
    for (const comp of competitors) {
      if (!comp.selected || !comp.name) continue;
      const raw = compBrandsMap[comp.name];
      const list = Array.isArray(raw) ? raw.filter((b): b is string => typeof b === "string" && b.trim().length > 0) : [];
      if (list.length > 0) groups.push({ name: comp.name, type: "competitor", brands: list });
    }
    return groups;
  }, [data]);

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
                    {chartMode === "sov" ? "Share of Voice" : "Share of LinkedIn"}
                    <InfoTooltip text={chartMode === "sov" ? "Share of Voice = posts externos no LinkedIn que citam as marcas próprias de cada empresa, classificados por sentimento (positivo, neutro, negativo)." : "Estimativa baseada em amostragem de 10-20 engajadores por post. O SOL combina volume de posts, engajamento e taxa de decisores (RER) para medir presença competitiva."} />
                  </h3>
                </div>
                <div className="flex gap-1 bg-white/[0.02] border border-white/10 rounded-full p-0.5">
                  {(["sol", "engagement", "posts", ...(sovTotals ? (["sov"] as const) : [])] as const).map((m) => (
                    <button key={m} onClick={() => setChartMode(m)} className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${chartMode === m ? "bg-[#ca98ff]/20 text-[#ca98ff]" : "text-white/40 hover:text-white/60"}`}>
                      {m === "sol" ? "SOL" : m === "engagement" ? "Engajamento" : m === "posts" ? "Posts" : "SOV"}
                    </button>
                  ))}
                </div>
              </div>
              {chartMode === "sov" && sovTotals ? (
                <div className="space-y-3">
                  {Object.entries(sovTotals)
                    .sort((a, b) => {
                      const ta = a[1].positivo + a[1].neutro + a[1].negativo;
                      const tb = b[1].positivo + b[1].neutro + b[1].negativo;
                      return tb - ta;
                    })
                    .map(([name, t]) => {
                      const total = t.positivo + t.neutro + t.negativo;
                      const maxTotal = Math.max(...Object.values(sovTotals).map((x) => x.positivo + x.neutro + x.negativo), 1);
                      const widthPct = Math.round((total / maxTotal) * 100);
                      const isMain = t.brand_owner === "main";
                      const isSovExpanded = expandedSolCompany === name;
                      const companyMentions = isSovExpanded ? (data.report.raw_data?.sov?.mentions ?? []).filter((m) => m.company_name === name) : [];
                      return (
                        <div key={name}>
                          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setExpandedSolCompany(isSovExpanded ? null : name)}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 text-white/30 ${isSovExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
                            <span className={`text-xs w-32 truncate text-right ${isMain ? "text-[#ca98ff] font-bold" : "text-white/60"} group-hover:text-white/80`}>{name}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isMain ? "text-[#ca98ff] bg-[#ca98ff]/10" : "text-white/40 bg-white/5"}`}>
                              {isMain ? "Marca própria" : "Concorrente"}
                            </span>
                            <div className="flex-1 h-6 bg-white/[0.03] rounded-full overflow-hidden flex" style={{ width: `${Math.max(widthPct, 3)}%` }}>
                              {total > 0 && (
                                <>
                                  <div style={{ width: `${(t.positivo / total) * 100}%`, backgroundColor: SENTIMENT_COLORS.positivo.bar }} title={`Positivo: ${t.positivo}`} />
                                  <div style={{ width: `${(t.neutro / total) * 100}%`, backgroundColor: SENTIMENT_COLORS.neutro.bar }} title={`Neutro: ${t.neutro}`} />
                                  <div style={{ width: `${(t.negativo / total) * 100}%`, backgroundColor: SENTIMENT_COLORS.negativo.bar }} title={`Negativo: ${t.negativo}`} />
                                </>
                              )}
                            </div>
                            <span className="text-xs font-bold text-white/80 w-12 text-right tabular-nums">{total}</span>
                            <span className="w-14 shrink-0 text-[9px] text-white/40 text-right">+{t.positivo}/{t.neutro}/-{t.negativo}</span>
                          </div>
                          {isSovExpanded && (
                            <div className="ml-12 mt-2 mb-1 space-y-1">
                              {companyMentions.length === 0 && (
                                <p className="text-[10px] text-white/30 pl-3 py-2">Sem menções externas no período.</p>
                              )}
                              {companyMentions.slice(0, 10).map((m, idx) => {
                                const sc = SENTIMENT_COLORS[m.sentiment];
                                return (
                                  <a key={`${m.post_url}-${idx}`} href={m.post_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-xs py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-[#ca98ff]/20 transition-colors">
                                    <span className="flex-1 text-white/60 truncate">
                                      <span className="text-white/40">{m.author_name}</span>
                                      {m.author_company && <span className="text-white/30"> · {m.author_company}</span>}
                                      <span className="text-white/50"> — {m.summary || m.text.slice(0, 80)}</span>
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${sc.text} ${sc.bg}`}>{m.brand_term}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${sc.text} ${sc.bg}`}>{sc.label}</span>
                                  </a>
                                );
                              })}
                              {companyMentions.length > 10 && <p className="text-[10px] text-white/30 pl-3">+{companyMentions.length - 10} menções</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
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
              )}
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

            {/* Insights Estratégicos */}
            {recommendationsPayload?.insights && ((recommendationsPayload.insights.positives?.length ?? 0) > 0 || (recommendationsPayload.insights.concerns?.length ?? 0) > 0) && (
              <div className="rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white font-[family-name:var(--font-lexend)] mb-4">Insights Estratégicos</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-green-400/5 border border-green-400/15 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>
                      Positivos
                    </p>
                    <div className="space-y-2.5">
                      {(recommendationsPayload.insights.positives ?? []).map((p, i) => (
                        <div key={i}>
                          <p className="text-sm text-white font-semibold">{p.title}</p>
                          <p className="text-xs text-white/50">{p.description}</p>
                        </div>
                      ))}
                      {(recommendationsPayload.insights.positives ?? []).length === 0 && (
                        <p className="text-xs text-white/30">Sem insights positivos identificados neste período.</p>
                      )}
                    </div>
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      Pontos de Atenção
                    </p>
                    <div className="space-y-2.5">
                      {(recommendationsPayload.insights.concerns ?? []).map((c, i) => (
                        <div key={i}>
                          <p className="text-sm text-white font-semibold">{c.title}</p>
                          <p className="text-xs text-white/50">{c.description}</p>
                        </div>
                      ))}
                      {(recommendationsPayload.insights.concerns ?? []).length === 0 && (
                        <p className="text-xs text-white/30">Sem pontos de atenção identificados neste período.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI incomplete warning */}
            {data?.report?.ai_incomplete && (
              <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-yellow-300 text-sm font-semibold">Analise de IA incompleta</p>
                  <p className="text-yellow-300/70 text-xs mt-0.5">Algumas classificacoes ou recomendacoes podem estar ausentes. Gere um novo relatorio para completar.</p>
                </div>
              </div>
            )}

            {/* Recomendações Estratégicas */}
            {(recommendationsPayload?.recommendations?.length ?? 0) > 0 && (
              <div className="rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white font-[family-name:var(--font-lexend)] mb-4">Recomendações Estratégicas</h3>
                <div className="space-y-3">
                  {recommendationsPayload!.recommendations!.map((rec) => {
                    const tagColor = TAG_COLORS[rec.tag] ?? TAG_COLORS["CONTEÚDO"];
                    const isExpanded = expandedRec === rec.id;
                    const vote = recVotes[rec.id];
                    return (
                      <div key={rec.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl font-black text-[#ca98ff]/30 leading-none shrink-0 w-6 text-center">{rec.id}</span>
                          <div className="flex-1 space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-white">{rec.title}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tagColor}`}>{rec.tag} · {rec.urgency}</span>
                            </div>
                            <p className="text-xs text-white/60">{rec.desc}</p>
                            {rec.who && (
                              <p className="text-xs text-white/40"><strong className="text-white/60">Quem publica:</strong> {rec.who}</p>
                            )}
                            {rec.details && (
                              <button onClick={() => setExpandedRec(isExpanded ? null : rec.id)} className="text-[11px] text-[#ca98ff] hover:underline">
                                {isExpanded ? "Esconder detalhes" : "Ver detalhes"}
                              </button>
                            )}
                            {isExpanded && rec.details && (
                              <pre className="text-xs text-white/50 whitespace-pre-wrap font-sans pt-1">{rec.details}</pre>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setRecVotes((v) => {
                                const next = { ...v };
                                if (next[rec.id] === "like") delete next[rec.id];
                                else next[rec.id] = "like";
                                return next;
                              })}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${vote === "like" ? "bg-green-400/20 text-green-400" : "text-white/30 hover:text-white/60"}`}
                              aria-label="Curtir"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7v-12l4.5-9.5a1.93 1.93 0 0 1 3.5 1.38z"/></svg>
                            </button>
                            <button
                              onClick={() => setRecVotes((v) => {
                                const next = { ...v };
                                if (next[rec.id] === "dislike") delete next[rec.id];
                                else next[rec.id] = "dislike";
                                return next;
                              })}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${vote === "dislike" ? "bg-red-400/20 text-red-400" : "text-white/30 hover:text-white/60"}`}
                              aria-label="Não curtir"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-4.5 9.5a1.93 1.93 0 0 1-3.5-1.38z"/></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Movimentos Estratégicos */}
            {(recommendationsPayload?.movements?.length ?? 0) > 0 && (
              <div className="rounded-2xl bg-amber-500/5 border border-amber-500/30 p-6">
                <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Movimentos estratégicos observados
                </h3>
                <div className="space-y-4">
                  {recommendationsPayload!.movements!.map((mv, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 text-white/70 bg-white/10">{mv.company}</span>
                      <p className="text-sm text-white/70">{mv.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "analise" && !metrics && (
          <div className="text-center py-12">
            {data?.report?.status === "failed" ? (
              <>
                <p className="text-red-400 text-sm font-medium">Não foi possível gerar o relatório.</p>
                <p className="text-white/30 text-xs mt-2">
                  {(data?.report?.metrics as Record<string, unknown>)?.message as string ?? "As contas de coleta atingiram o limite. Tente novamente mais tarde."}
                </p>
              </>
            ) : (
              <p className="text-white/40 text-sm">Métricas ainda não calculadas. Aguarde o processamento completo.</p>
            )}
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

        {/* Influencers Tab */}
        {activeTab === "influencers" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white font-[family-name:var(--font-lexend)] mb-1">Influenciadores externos</h3>
                  <p className="text-xs text-white/50">Amostra de pessoas externas que falam sobre os temas do seu mercado. Para uma busca completa com mais filtros e resultados, use a funcionalidade <Link href="/casting" className="text-[#ca98ff] hover:underline">Influencers B2B</Link>.</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={async () => {
                      setReprocessingInfluencers(true);
                      try {
                        const res = await fetch("/api/sol/reprocess-influencers", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ reportId }),
                        });
                        if (res.ok) await loadReport();
                      } catch { /* ignore */ }
                      finally { setReprocessingInfluencers(false); }
                    }}
                    disabled={reprocessingInfluencers}
                    className="shrink-0 rounded-lg bg-[#ca98ff]/20 border border-[#ca98ff]/30 px-3 py-1.5 text-xs font-semibold text-[#ca98ff] hover:bg-[#ca98ff]/30 disabled:opacity-50 transition-colors"
                  >
                    {reprocessingInfluencers ? "Reprocessando..." : "Reprocessar"}
                  </button>
                )}
              </div>

              {/* Monitored terms — grouped by company */}
              {allMonitoredKeywords.length > 0 && (
                <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <button onClick={() => { setTermsExpanded((v) => !v); if (!editingTerms) setTermsValue(data?.options?.market_context ?? ""); }} className="text-xs text-white/50 hover:text-white/70 transition-colors">
                      <span className="text-[10px] uppercase tracking-wider text-white/30 mr-2">Termos monitorados</span>
                      {!termsExpanded && <span className="text-white/50">{allMonitoredKeywords.length} termos</span>}
                      <span className="ml-1 text-white/30">{termsExpanded ? "▴" : "▾"}</span>
                    </button>
                  </div>
                  {termsExpanded && (
                    <div className="mt-3 space-y-3">
                      {brandGroups.map((group) => (
                        <div key={group.name}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-[10px] uppercase tracking-wider text-white/30">{group.name}</p>
                            {group.type === "main" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#ca98ff]/10 text-[#ca98ff]/60">própria</span>}
                            {group.type === "competitor" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/30">concorrente</span>}
                          </div>
                          {group.type === "themes" && editingTerms ? (
                            <div>
                              <textarea
                                value={termsValue}
                                onChange={(e) => setTermsValue(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-[#ca98ff]/40 resize-none"
                                rows={2}
                                placeholder="Termos separados por vírgula"
                              />
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={async () => {
                                    setSavingTerms(true);
                                    try {
                                      const res = await fetch("/api/leads-generation/options", {
                                        method: "PUT",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ profileId, market_context: termsValue }),
                                      });
                                      if (res.ok) {
                                        setEditingTerms(false);
                                        await loadReport();
                                      }
                                    } catch { /* ignore */ }
                                    finally { setSavingTerms(false); }
                                  }}
                                  disabled={savingTerms}
                                  className="text-[11px] font-semibold text-[#ca98ff] hover:text-[#dbb8ff] disabled:opacity-50 transition-colors"
                                >
                                  {savingTerms ? "Salvando..." : "Salvar"}
                                </button>
                                <button onClick={() => setEditingTerms(false)} className="text-[11px] text-white/30 hover:text-white/50 transition-colors">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {group.brands.map((t) => (
                                <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full border ${group.type === "main" ? "bg-[#ca98ff]/10 text-[#ca98ff] border-[#ca98ff]/20" : group.type === "competitor" ? "bg-white/[0.03] text-white/50 border-white/10" : "bg-[#ca98ff]/10 text-[#ca98ff] border-[#ca98ff]/20"}`}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {!editingTerms && (
                        <button onClick={() => { setEditingTerms(true); setTermsValue(data?.options?.market_context ?? ""); }} className="text-[10px] text-white/30 hover:text-white/50 transition-colors">Editar temas de mercado</button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {influencerCards.length === 0 && allInfluencerCards.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-white/40 text-sm">Sem influenciadores externos identificados neste período.</p>
                </div>
              )}

              {allInfluencerCards.length > 0 && (
                <>
                  <div className="space-y-3">
                    {influencerCards.map((c) => {
                      const key = c.linkedin_url || c.name;
                      const isExpanded = expandedInfluencer === key;
                      const sc = SENTIMENT_COLORS[c.sentiment];
                      const potInfo = POTENTIAL_INFO[c.potential] ?? POTENTIAL_INFO.baixo;
                      const potColor =
                        c.potential === "alto" ? "text-[#a2f31f] bg-[#a2f31f]/10" :
                        c.potential === "médio" ? "text-[#f59e0b] bg-[#f59e0b]/10" :
                        "text-white/40 bg-white/5";
                      const mentions = influencerMentionsByKey[key] ?? [];
                      const mentionKeywords = allMonitoredKeywords;
                      const isArchiving = archivingInfluencer === key;
                      return (
                        <div key={key} className="bg-white/[0.02] border border-white/10 rounded-xl p-5">
                          {/* Header: photo + name + linkedin link + archive */}
                          <div className="flex items-start gap-3 mb-4">
                            {c.profile_photo ? (
                              <img src={c.profile_photo} alt={c.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/30 text-base font-bold shrink-0">
                                {c.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-white hover:text-[#ca98ff] transition-colors truncate block">{c.name}</a>
                                  <p className="text-xs text-white/50 truncate">{c.role}{c.company ? ` · ${c.company}` : ""}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={async () => {
                                      setArchivingInfluencer(key);
                                      try {
                                        const res = await fetch("/api/sol/archive-influencer", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ reportId, influencerKey: key, archive: true }),
                                        });
                                        if (res.ok) await loadReport();
                                      } catch { /* ignore */ }
                                      finally { setArchivingInfluencer(null); }
                                    }}
                                    disabled={isArchiving}
                                    className="text-[10px] text-white/20 hover:text-white/50 transition-colors disabled:opacity-50"
                                    title="Arquivar influenciador"
                                  >
                                    {isArchiving ? "..." : "Arquivar"}
                                  </button>
                                  <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white/30 hover:text-[#ca98ff] transition-colors">LinkedIn ↗</a>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Metrics grid with headers */}
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Seguidores</p>
                              <p className="text-sm font-semibold text-white tabular-nums">{c.followers > 0 ? c.followers.toLocaleString("pt-BR") : "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1 flex items-center">Posts/mês<InfoTooltip text="Frequência estimada de publicações por mês no LinkedIn." /></p>
                              <p className="text-sm font-semibold text-white tabular-nums">{c.posts_per_month != null ? c.posts_per_month : c.posts_about}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Avg Likes</p>
                              <p className="text-sm font-semibold text-white tabular-nums">{c.avg_likes != null ? c.avg_likes.toLocaleString("pt-BR") : "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Avg Comments</p>
                              <p className="text-sm font-semibold text-white tabular-nums">{c.avg_comments != null ? c.avg_comments.toLocaleString("pt-BR") : "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1 flex items-center">Potencial<InfoTooltip text={`Alto: ${POTENTIAL_INFO.alto.description}. Médio: ${POTENTIAL_INFO["médio"].description}. Baixo: ${POTENTIAL_INFO.baixo.description}.`} /></p>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block ${potColor}`}>{potInfo.label}</span>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Sentimento</p>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block ${sc.text} ${sc.bg}`}>{sc.label}</span>
                            </div>
                          </div>

                          {/* Temas + Marcas citadas side by side */}
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Temas</p>
                              {c.themes_covered.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {c.themes_covered.slice(0, 6).map((t) => (
                                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.03] text-white/50 border border-white/10">{t}</span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-white/30">—</p>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Marcas citadas</p>
                              {c.brands_mentioned.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {c.brands_mentioned.map((b, i) => (
                                    <span key={i} title={`Citou ${b.brand} (${b.company_name})`} className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${b.brand_owner === "main" ? "text-[#ca98ff] bg-[#ca98ff]/10" : "text-white/60 bg-white/[0.06]"}`}>
                                      {b.brand}
                                      <span className="opacity-60 ml-1">{b.brand_owner === "main" ? "· própria" : `· ${b.company_name}`}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-white/30">Não citou marcas — só temas de mercado.</p>
                              )}
                            </div>
                          </div>

                          {/* Mentions toggle */}
                          {mentions.length > 0 && (
                            <div className="flex items-center justify-end">
                              <button onClick={() => setExpandedInfluencer(isExpanded ? null : key)} className="text-[11px] text-[#ca98ff] hover:text-[#dbb8ff] transition-colors">
                                {isExpanded ? "Esconder menções ▴" : `Ver ${mentions.length} menções ▾`}
                              </button>
                            </div>
                          )}

                          {/* Expanded mentions */}
                          {isExpanded && mentions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                              <p className="text-[10px] uppercase tracking-wider text-white/30">Menções</p>
                              {mentions.slice(0, 6).map((m, i) => {
                                const ms = m.sentiment ? SENTIMENT_COLORS[m.sentiment] : null;
                                return (
                                  <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {m.date && <span className="text-[11px] text-white/30 tabular-nums">{m.date}</span>}
                                        {m.brand && (
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${m.brand_owner === "main" ? "text-[#ca98ff] bg-[#ca98ff]/10" : "text-white/60 bg-white/[0.06]"}`}>{m.brand}</span>
                                        )}
                                        {ms && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ms.text} ${ms.bg}`}>{ms.label}</span>}
                                      </div>
                                      {m.post_url && (
                                        <a href={m.post_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] text-[#ca98ff] hover:text-[#dbb8ff] transition-colors">ver post ↗</a>
                                      )}
                                    </div>
                                    <p className="text-sm text-white/60 leading-relaxed">{highlightKeywords(cleanSnippetText(m.text), mentionKeywords)}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Archived influencers */}
                  {archivedInfluencerCards.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowArchivedInfluencers((v) => !v)}
                        className="text-[11px] text-white/30 hover:text-white/50 transition-colors"
                      >
                        {showArchivedInfluencers ? `Esconder arquivados (${archivedInfluencerCards.length}) ▴` : `Ver arquivados (${archivedInfluencerCards.length}) ▾`}
                      </button>
                      {showArchivedInfluencers && (
                        <div className="mt-3 space-y-2">
                          {archivedInfluencerCards.map((c) => {
                            const key = c.linkedin_url || c.name;
                            const isRestoring = archivingInfluencer === key;
                            return (
                              <div key={key} className="flex items-center justify-between gap-3 bg-white/[0.01] border border-white/[0.06] rounded-lg px-4 py-3 opacity-60">
                                <div className="flex items-center gap-3 min-w-0">
                                  {c.profile_photo ? (
                                    <img src={c.profile_photo} alt={c.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/30 text-xs font-bold shrink-0">
                                      {c.name.charAt(0)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white/60 truncate">{c.name}</p>
                                    <p className="text-[10px] text-white/30 truncate">{c.role}{c.company ? ` · ${c.company}` : ""}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={async () => {
                                    setArchivingInfluencer(key);
                                    try {
                                      const res = await fetch("/api/sol/archive-influencer", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ reportId, influencerKey: key, archive: false }),
                                      });
                                      if (res.ok) await loadReport();
                                    } catch { /* ignore */ }
                                    finally { setArchivingInfluencer(null); }
                                  }}
                                  disabled={isRestoring}
                                  className="shrink-0 text-[10px] text-[#ca98ff]/60 hover:text-[#ca98ff] transition-colors disabled:opacity-50"
                                >
                                  {isRestoring ? "..." : "Desarquivar"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Blur CTA — more influencers */}
                  <div className="relative mt-4 overflow-hidden rounded-xl">
                    <div className="blur-sm pointer-events-none select-none space-y-3">
                      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-white/10 shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-40 bg-white/10 rounded" />
                            <div className="h-2 w-56 bg-white/[0.06] rounded" />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                          <div className="space-y-1"><div className="h-2 w-16 bg-white/[0.06] rounded" /><div className="h-3 w-12 bg-white/10 rounded" /></div>
                          <div className="space-y-1"><div className="h-2 w-10 bg-white/[0.06] rounded" /><div className="h-3 w-6 bg-white/10 rounded" /></div>
                          <div className="space-y-1"><div className="h-2 w-14 bg-white/[0.06] rounded" /><div className="h-3 w-10 bg-white/10 rounded" /></div>
                          <div className="space-y-1"><div className="h-2 w-16 bg-white/[0.06] rounded" /><div className="h-3 w-12 bg-white/10 rounded" /></div>
                        </div>
                      </div>
                      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-white/10 shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-36 bg-white/10 rounded" />
                            <div className="h-2 w-48 bg-white/[0.06] rounded" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/60 to-transparent">
                      <div className="text-center">
                        <p className="text-sm text-white/70 mb-3">Encontre mais influenciadores no seu mercado</p>
                        <Link href="/casting" className="inline-block rounded-lg bg-[#ca98ff]/20 border border-[#ca98ff]/30 px-4 py-2 text-sm font-semibold text-[#ca98ff] hover:bg-[#ca98ff]/30 transition-colors">Ir para Influencers B2B →</Link>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
