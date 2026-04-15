"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001+"];
const ITEMS_PER_PAGE = 10;

const SCAN_STEPS = [
  "Analisando relevância dos posts...",
  "Coletando engajamentos dos posts...",
  "Identificando decisores e influenciadores...",
  "Calculando ICP Score com IA...",
  "Finalizando resultados...",
];

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

interface LeadResult {
  id: string;
  profile_slug: string;
  name: string;
  headline: string;
  job_title: string;
  company: string;
  linkedin_url: string;
  profile_photo: string;
  icp_score: number;
  role_level: string;
  engagement_type: string;
  source_post_urls: string[];
  interaction_count: number;
  total_possible_interactions: number;
  created_at: string;
}

type SortMode = "lead_score_desc" | "lead_score_asc" | "recent_desc" | "recent_asc";

/**
 * Compute a normalized Lead Score (0-100) combining:
 *   - role_level (decision power) — 35%
 *   - ICP score (how well they fit the ICP)  — 25%
 *   - interaction ratio (how many tracked posts they engaged with) — 25%
 *   - engagement type (comment > reaction) — 15%
 */
function computeLeadScore(
  lead: Pick<LeadResult, "role_level" | "icp_score" | "engagement_type" | "interaction_count">,
  totalPossible: number
): number {
  const roleScore =
    lead.role_level === "decisor" ? 100 :
    lead.role_level === "influenciador" ? 60 : 20;
  const icpScore = Math.max(0, Math.min(100, lead.icp_score ?? 0));
  const interactionScore = totalPossible > 0
    ? Math.min(100, (lead.interaction_count / totalPossible) * 100)
    : 0;
  const engagementScore =
    lead.engagement_type === "both" ? 100 :
    lead.engagement_type === "comment" ? 90 : 30;
  const score = roleScore * 0.35 + icpScore * 0.25 + interactionScore * 0.25 + engagementScore * 0.15;
  return Math.round(score);
}

function formatCollectedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
      " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

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
        <span
          role="tooltip"
          className="absolute z-50 left-5 top-1/2 -translate-y-1/2 w-64 rounded-lg bg-[#1a1919] border border-[#ca98ff]/30 px-3 py-2 text-[11px] text-white/80 font-normal normal-case tracking-normal shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
        >
          {text}
        </span>
      )}
    </span>
  );
}

interface PostInfo {
  id: string;
  post_url: string;
  text_content: string;
  relevance_score: number | null;
}

interface AnalyzedProfile {
  id: string;
  name: string;
  linkedin_url: string;
  leads_count: number;
  created_at: string;
}

export default function LeadsGenerationOptionsPage() {
  const params = useParams();
  const router = useRouter();
  const profileId = params.profileId as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leads results state
  const [results, setResults] = useState<LeadResult[]>([]);
  const [posts, setPosts] = useState<PostInfo[]>([]);
  const [totalTrackedPosts, setTotalTrackedPosts] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("lead_score_desc");
  const [scanning, setScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState(0);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [userCredits, setUserCredits] = useState<number>(-1);
  const [scanCredits, setScanCredits] = useState(3);
  const [resultsPage, setResultsPage] = useState(1);
  const [filterPostUrl, setFilterPostUrl] = useState("all");
  const [filterRoleLevel, setFilterRoleLevel] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [showPostDetails, setShowPostDetails] = useState(false);
  // Config form collapse: collapsed by default once leads exist; clicking
  // "+ Adicionar mais leads" expands it. The effect only force-opens the
  // form AFTER the initial data fetch has finished and there are still
  // no results — otherwise the form would flash open during the first
  // render (when `results` is still []) even though there ARE leads in
  // the DB that just haven't loaded yet.
  const [configExpanded, setConfigExpanded] = useState(false);
  useEffect(() => {
    if (!loading && results.length === 0) setConfigExpanded(true);
  }, [loading, results.length]);

  // Profile history for dropdown
  const [profileHistory, setProfileHistory] = useState<AnalyzedProfile[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [optRes, resultsRes, historyRes, meRes] = await Promise.all([
        fetch(`/api/leads-generation/options?profileId=${profileId}`),
        fetch(`/api/leads-generation/results?profileId=${profileId}`),
        fetch("/api/leads-generation/profiles"),
        fetch("/api/auth/me"),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        const credits = meData.user?.credits ?? 5;
        setUserCredits(credits);
        if (credits !== -1) {
          setScanCredits((c) => Math.min(c, credits));
        }
      }

      if (optRes.ok) {
        const data = await optRes.json();
        setProfile(data.profile);
        setOptions(data.options ? {
          market_context: data.options.market_context ?? "",
          job_titles: data.options.job_titles ?? [],
          departments: data.options.departments ?? [],
          company_sizes: data.options.company_sizes ?? [],
        } : null);
      }

      if (resultsRes.ok) {
        const data = await resultsRes.json();
        setResults(data.results ?? []);
        setPosts(data.posts ?? []);
        setTotalTrackedPosts(data.totalTrackedPosts ?? (data.posts ?? []).length);
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setProfileHistory(data.profiles ?? []);
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

  async function handleScan() {
    setScanning(true);
    setScanStep(0);
    scanIntervalRef.current = setInterval(() => {
      setScanStep((prev) => Math.min(prev + 1, SCAN_STEPS.length - 2)); // Stop at 80%, only go to 100% on actual completion
    }, 8000);

    try {
      // Trigger scan (returns immediately, processing runs async in background)
      const res = await fetch("/api/leads-generation/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, credits: scanCredits }),
      });

      const scanResponse = await res.json().catch(() => ({}));
      console.log("[lg-scan] Scan API response:", scanResponse);

      if (!res.ok) {
        setErrorMessage("Não foi possível realizar a operação! Tente novamente mais tarde.");
        return;
      }

      // Poll for results until scan_status changes to "complete" or "error" (max 10 min)
      let scanDone = false;
      const pollStart = Date.now();
      const MAX_POLL = 10 * 60 * 1000;
      let lastSeenCount = 0;
      const prevResultsCount = results.length; // capture before polling starts

      while (!scanDone && Date.now() - pollStart < MAX_POLL) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const resultsRes = await fetch(`/api/leads-generation/results?profileId=${profileId}`);
          if (!resultsRes.ok) continue;
          const pollData = await resultsRes.json();
          const newResults = pollData.results ?? [];
          const scanStatus = pollData.scanStatus ?? "idle";

          // Always update results when count changes
          if (newResults.length !== lastSeenCount) {
            lastSeenCount = newResults.length;
            setResults(newResults);
            setPosts(pollData.posts ?? []);
            setTotalTrackedPosts(pollData.totalTrackedPosts ?? (pollData.posts ?? []).length);
          }

          if (scanStatus === "complete") {
            scanDone = true;
            setResults(newResults);
            setPosts(pollData.posts ?? []);
            setTotalTrackedPosts(pollData.totalTrackedPosts ?? (pollData.posts ?? []).length);
          } else if (scanStatus === "error") {
            scanDone = true;
            setErrorMessage("Não foi possível realizar a operação! Tente novamente mais tarde.");
          }
        } catch { /* retry */ }
      }

      // Final reload
      const finalRes = await fetch(`/api/leads-generation/results?profileId=${profileId}`);
      if (finalRes.ok) {
        const finalData = await finalRes.json();
        setResults(finalData.results ?? []);
        setPosts(finalData.posts ?? []);
        setTotalTrackedPosts(finalData.totalTrackedPosts ?? (finalData.posts ?? []).length);

        const finalCount = (finalData.results ?? []).length;
        const newLeadsFound = finalCount - prevResultsCount;
        console.log(`[lg-scan] Final: ${finalCount} total, ${newLeadsFound} new (prev: ${prevResultsCount})`);
        if (newLeadsFound > 0) {
          setScanSuccess(`Foram adicionados ${newLeadsFound} lead${newLeadsFound !== 1 ? "s" : ""} à sua lista!`);
        } else {
          setScanSuccess(`Busca concluída com ${finalCount} leads. Nenhum lead novo encontrado nesta busca.`);
        }
        // Message stays until user dismisses it
      }

      setScanStep(SCAN_STEPS.length - 1);

      // Refresh credits
      window.dispatchEvent(new CustomEvent("credits-updated", { detail: null }));
      fetch("/api/auth/me").then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.user) {
            window.dispatchEvent(new CustomEvent("credits-updated", { detail: d.user.credits }));
            setUserCredits(d.user.credits);
          }
        })
        .catch(() => {});
    } catch { setErrorMessage("Não foi possível realizar a operação! Tente novamente mais tarde."); }
    finally {
      if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
      setScanning(false);
    }
  }

  // Filtered results
  const totalPossibleInteractions = totalTrackedPosts * 2;

  const filteredResults = useMemo(() => {
    const filtered = results.filter((r) => {
      if (filterPostUrl !== "all" && !r.source_post_urls?.includes(filterPostUrl)) return false;
      if (filterRoleLevel !== "all" && r.role_level !== filterRoleLevel) return false;
      if (searchText && !r.name?.toLowerCase().includes(searchText.toLowerCase()) && !r.company?.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
    const withScore = filtered.map((r) => ({
      r,
      score: computeLeadScore(r, totalPossibleInteractions),
      ts: new Date(r.created_at ?? 0).getTime(),
    }));
    withScore.sort((a, b) => {
      switch (sortMode) {
        case "lead_score_desc": return b.score - a.score || b.ts - a.ts;
        case "lead_score_asc":  return a.score - b.score || a.ts - b.ts;
        case "recent_desc":     return b.ts - a.ts || b.score - a.score;
        case "recent_asc":      return a.ts - b.ts || a.score - b.score;
      }
    });
    return withScore.map((x) => x.r);
  }, [results, filterPostUrl, filterRoleLevel, searchText, sortMode, totalPossibleInteractions]);

  // RER calculation
  const rer = useMemo(() => {
    const total = filteredResults.length;
    const decisors = filteredResults.filter((r) => r.role_level === "decisor").length;
    return total > 0 ? Math.round((decisors / total) * 100) : 0;
  }, [filteredResults]);

  // Per-post RER
  const postRerMap = useMemo(() => {
    const map = new Map<string, { total: number; decisors: number; rer: number }>();
    for (const r of results) {
      for (const url of r.source_post_urls ?? []) {
        const s = map.get(url) || { total: 0, decisors: 0, rer: 0 };
        s.total++;
        if (r.role_level === "decisor") s.decisors++;
        map.set(url, s);
      }
    }
    Array.from(map.entries()).forEach(([url, s]) => {
      s.rer = s.total > 0 ? Math.round((s.decisors / s.total) * 100) : 0;
      map.set(url, s);
    });
    return map;
  }, [results]);

  const topPost = useMemo((): { url: string; rer: number; text: string } | null => {
    let bestUrl = "";
    let bestRer = -1;
    Array.from(postRerMap.entries()).forEach(([url, s]) => {
      if (s.rer > bestRer) { bestUrl = url; bestRer = s.rer; }
    });
    if (!bestUrl) return null;
    const post = posts.find((p) => p.post_url === bestUrl);
    return { url: bestUrl, rer: bestRer, text: post?.text_content?.slice(0, 30) ?? shortPostLabel(bestUrl) };
  }, [postRerMap, posts]);

  // Pagination
  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedResults = filteredResults.slice((resultsPage - 1) * ITEMS_PER_PAGE, resultsPage * ITEMS_PER_PAGE);

  function roleLevelLabel(level?: string) {
    if (level === "decisor") return { text: "Decisor", cls: "bg-[#6a2785] text-[#e197fc]" };
    if (level === "influenciador") return { text: "Influenciador", cls: "bg-blue-900/40 text-blue-300" };
    return { text: "Observador", cls: "bg-white/5 text-[#adaaaa]" };
  }

  function icpLabel(score: number) {
    if (score >= 70) return { text: "Alto", cls: "text-[#ca98ff]", dot: "bg-[#ca98ff] shadow-[0_0_8px_#cc97ff]" };
    if (score >= 40) return { text: "Médio", cls: "text-[#ff946e]", dot: "bg-[#ff946e]" };
    return { text: "Baixo", cls: "text-[#adaaaa]", dot: "bg-[#adaaaa]" };
  }

  function shortPostLabel(url: string): string {
    if (!url) return "—";
    const postsMatch = url.match(/\/posts\/([^_/?#]+)/);
    if (postsMatch) return `@${postsMatch[1]}`;
    const shareMatch = url.match(/urn:li:(?:share|activity|ugcPost):(\d+)/);
    if (shareMatch) return `Post #${shareMatch[1].slice(-6)}`;
    return url.slice(-30);
  }

  function exportCsv() {
    const headers = ["Nome", "LinkedIn URL", "Cargo", "Empresa", "ICP Score", "Lead Score", "Status", "Interações", "Engajamento", "Coletado em", "Posts URLs", "Posts Preview"];
    const escape = (v: string) => v.includes(",") || v.includes('"') || v.includes("\n") ? '"' + v.replace(/"/g, '""') + '"' : v;
    const rows = filteredResults.map((r) => {
      const postPreviews = (r.source_post_urls ?? []).map((url) => {
        const post = posts.find((p) => p.post_url === url);
        return post?.text_content?.slice(0, 30) ?? shortPostLabel(url);
      }).join("; ");
      return [
        r.name, r.linkedin_url, r.job_title, r.company,
        String(r.icp_score),
        String(computeLeadScore(r, totalPossibleInteractions)),
        r.role_level ?? "",
        `${r.interaction_count}/${totalPossibleInteractions}`,
        r.engagement_type ?? "",
        r.created_at ?? "",
        (r.source_post_urls ?? []).join("; "),
        postPreviews,
      ].map(escape);
    });
    const csv = [headers.map(escape).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads-generation-${profile?.name ?? "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
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
        <Link href="/casting/leads-generation" className="text-[#ca98ff] text-sm mt-2 inline-block hover:underline">← Voltar</Link>
      </div>
    );
  }

  const uniquePostUrls = Array.from(new Set(results.flatMap((r) => r.source_post_urls ?? [])));

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <Link href="/casting/leads-generation" className="text-xs text-[#adaaaa] hover:text-[#ca98ff] transition-colors">← Nova análise</Link>

      {/* Header with profile dropdown */}
      <header>
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4 leading-tight font-[family-name:var(--font-lexend)] text-white">
          Vamos encontrar leads através{" "}
          <br className="hidden md:block" />
          de seu <span className="bg-gradient-to-r from-[#ca98ff] to-[#e197fc] bg-clip-text text-transparent">LinkedIn</span>
        </h2>
        <div className="flex items-center gap-3 mt-3">
          {profileHistory.length > 1 ? (
            <select
              value={profileId}
              onChange={(e) => router.push(`/casting/leads-generation/${e.target.value}`)}
              className="text-lg font-semibold text-white bg-transparent outline-none border-b border-[#ca98ff]/30 focus:border-[#ca98ff] pb-0.5 cursor-pointer font-[family-name:var(--font-lexend)]"
            >
              {profileHistory.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#131313] text-white">
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-lg font-semibold text-white">{profile?.name}</span>
          )}
          {profile?.headline && <span className="text-sm text-white/40">— {profile.headline}</span>}
          {profile && (
            <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#ca98ff] hover:text-[#e197fc] transition-colors" title="Ver perfil no LinkedIn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            </a>
          )}
        </div>
      </header>

      {/* Error message */}
      {errorMessage && (
        <div className="rounded-xl bg-[#ff946e]/10 px-4 py-3 text-sm text-[#ff946e] flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-[#ff946e]/60 hover:text-[#ff946e] ml-3 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Success message */}
      {scanSuccess && (
        <div className="rounded-xl bg-[#a2f31f]/10 px-4 py-3 text-sm text-[#a2f31f] font-medium flex items-center justify-between">
          <div className="flex items-center gap-2"><span>&#10003;</span> {scanSuccess}</div>
          <button onClick={() => setScanSuccess(null)} className="text-[#a2f31f]/60 hover:text-[#a2f31f] ml-3 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Dashboard KPIs — only visible once we have leads */}
      {results.length > 0 && (() => {
        const decisorsCount = results.filter((r) => r.role_level === "decisor").length;
        return (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total leads */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-[#ca98ff]/20 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#ca98ff]/10 blur-[40px] rounded-full pointer-events-none" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[0.65rem] font-bold tracking-[0.2em] text-white/40 uppercase">Total de leads</p>
                  <p className="text-4xl font-black text-[#ca98ff] font-[family-name:var(--font-lexend)] mt-2">{results.length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#ca98ff]/10 border border-[#ca98ff]/20 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ca98ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </div>
              </div>
            </div>
            {/* Decisores */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-[#a2f31f]/20 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#a2f31f]/10 blur-[40px] rounded-full pointer-events-none" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[0.65rem] font-bold tracking-[0.2em] text-white/40 uppercase">Decisores</p>
                  <p className="text-4xl font-black text-[#a2f31f] font-[family-name:var(--font-lexend)] mt-2">{decisorsCount}</p>
                  <p className="text-[10px] text-white/40 mt-1">
                    {results.length > 0 ? Math.round((decisorsCount / results.length) * 100) : 0}% do total
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#a2f31f]/10 border border-[#a2f31f]/20 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a2f31f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
              </div>
            </div>
            {/* Posts mapeados */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-white/5 blur-[40px] rounded-full pointer-events-none" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[0.65rem] font-bold tracking-[0.2em] text-white/40 uppercase">Posts mapeados</p>
                  <p className="text-4xl font-black text-white font-[family-name:var(--font-lexend)] mt-2">{totalTrackedPosts}</p>
                  <p className="text-[10px] text-white/40 mt-1">até {totalPossibleInteractions} interações por lead</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Leads configuration — collapsed when results exist, expanded otherwise */}
      {results.length > 0 && !configExpanded ? (
        <button
          onClick={() => setConfigExpanded(true)}
          className="w-full group rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-[#ca98ff]/20 hover:border-[#ca98ff]/50 hover:bg-[#ca98ff]/[0.06] transition-all py-4 px-6 flex items-center justify-center gap-3 font-[family-name:var(--font-lexend)]"
        >
          <span className="w-8 h-8 rounded-full bg-[#ca98ff]/10 border border-[#ca98ff]/30 flex items-center justify-center text-[#ca98ff] text-lg font-bold group-hover:scale-110 transition-transform">+</span>
          <span className="text-sm font-bold text-[#ca98ff] uppercase tracking-wider">Adicionar mais leads</span>
        </button>
      ) : (
      <section>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-[#ca98ff]/40 rounded-[2rem] p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.37)] relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#ca98ff]/20 blur-[80px] rounded-full pointer-events-none" />
          {results.length > 0 && (
            <button
              onClick={() => setConfigExpanded(false)}
              aria-label="Fechar configuração"
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all text-lg leading-none"
            >
              &times;
            </button>
          )}
          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#ca98ff]/10 border border-[#ca98ff]/20 flex items-center justify-center shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ca98ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /></svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white font-[family-name:var(--font-lexend)]">
                {results.length > 0 ? "Adicionar mais leads" : `Leads (${results.length})`}
              </h2>
              <p className="text-[#adaaaa] text-sm mt-1">Identifique decisores que já demonstraram interesse.</p>
            </div>
          </div>

          <div className="space-y-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[0.7rem] font-black tracking-[0.2em] text-white/40 uppercase block">Cargos</label>
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl focus-within:border-[#ca98ff]/50 focus-within:bg-white/[0.04] transition-all">
                  <textarea
                    rows={4}
                    value={options.job_titles.join(", ")}
                    onChange={(e) => updateField("job_titles", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                    className="w-full bg-transparent border-none focus:ring-0 px-4 py-3.5 text-white text-sm font-medium outline-none placeholder-white/20 resize-y min-h-[120px] leading-relaxed"
                    placeholder="CEO, CTO, VP Marketing, Head of Growth, Diretor Comercial..."
                  />
                </div>
                <p className="text-[10px] text-white/30">Separe por vírgulas. Ex: CEO, Head de Vendas, VP Marketing</p>
              </div>
              <div className="space-y-2">
                <label className="text-[0.7rem] font-black tracking-[0.2em] text-white/40 uppercase block">Departamentos</label>
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl focus-within:border-[#ca98ff]/50 focus-within:bg-white/[0.04] transition-all">
                  <textarea
                    rows={4}
                    value={options.departments.join(", ")}
                    onChange={(e) => updateField("departments", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                    className="w-full bg-transparent border-none focus:ring-0 px-4 py-3.5 text-white text-sm font-medium outline-none placeholder-white/20 resize-y min-h-[120px] leading-relaxed"
                    placeholder="Marketing, Sales, Growth, Produto, Operações..."
                  />
                </div>
                <p className="text-[10px] text-white/30">Separe por vírgulas. Ex: Marketing, Vendas, Produto</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[0.7rem] font-black tracking-[0.2em] text-white/40 uppercase block">Tamanho da Empresa</label>
              <div className="flex flex-wrap gap-2">
                {COMPANY_SIZES.map((size) => {
                  const isSelected = options.company_sizes.includes(size);
                  return (
                    <button key={size} onClick={() => toggleCompanySize(size)} className={`px-4 py-2 rounded-full text-[11px] font-bold transition-all ${isSelected ? "border-2 border-[#ca98ff]/40 bg-[#ca98ff]/10 text-[#ca98ff] shadow-[0_0_15px_rgba(204,151,255,0.1)]" : "border border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"}`}>
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scan button with credits control */}
          <div className="mt-8 relative z-10 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#adaaaa]">
              <span>~{scanCredits * 12} leads ({scanCredits} créditos) · 12 leads para cada 1 crédito</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setScanCredits((c) => Math.max(1, c - 1))} className="w-6 h-6 rounded-full bg-white/5 text-white/60 hover:bg-white/10 flex items-center justify-center text-sm">-</button>
                <span className="text-white font-bold w-4 text-center">{scanCredits}</span>
                <button onClick={() => setScanCredits((c) => userCredits === -1 ? c + 1 : Math.min(c + 1, userCredits))} disabled={userCredits !== -1 && scanCredits >= userCredits} className="w-6 h-6 rounded-full bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm">+</button>
              </div>
            </div>
            {userCredits !== -1 && scanCredits >= userCredits && userCredits > 0 && (
              <p className="text-[10px] text-[#ff946e]">
                Limite de créditos atingido.{" "}
                <a href="https://wa.me/5511941238555?text=Ola!%20Quero%20comprar%20mais%20creditos" target="_blank" rel="noopener noreferrer" className="text-[#a2f31f] font-semibold hover:underline">Comprar mais créditos</a>
              </p>
            )}
            {userCredits === 0 && (
              <p className="text-[10px] text-[#ff946e]">
                Sem créditos disponíveis.{" "}
                <a href="https://wa.me/5511941238555?text=Ola!%20Quero%20comprar%20creditos" target="_blank" rel="noopener noreferrer" className="text-[#a2f31f] font-semibold hover:underline">Comprar créditos</a>
              </p>
            )}
            {scanning ? (
              <div className="space-y-3 py-2">
                {SCAN_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {i < scanStep ? (
                      <span className="text-[#a2f31f] text-sm">&#10003;</span>
                    ) : i === scanStep ? (
                      <span className="animate-pulse text-[#ca98ff] text-sm">&#9679;</span>
                    ) : (
                      <span className="text-white/20 text-sm">&#9675;</span>
                    )}
                    <span className={`text-xs ${i <= scanStep ? "text-white" : "text-white/20"}`}>{step}</span>
                  </div>
                ))}
                <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                  <div className="bg-[#ca98ff] h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.round(((scanStep + 1) / SCAN_STEPS.length) * 100)}%` }} />
                </div>
                <p className="text-center text-xs text-[#ca98ff] font-bold">{Math.round(((scanStep + 1) / SCAN_STEPS.length) * 100)}%</p>
              </div>
            ) : (
              <button
                onClick={handleScan}
                disabled={userCredits === 0}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#ca98ff] to-[#9c48ea] text-[#1a0033] font-bold text-sm shadow-[0_10px_30px_-5px_rgba(204,151,255,0.4)] hover:shadow-[0_15px_40px_-5px_rgba(204,151,255,0.5)] hover:translate-y-[-2px] transition-all active:scale-[0.98] tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {results.length > 0 ? "GERAR MAIS LEADS" : "VER DECISORES INTERESSADOS"}
              </button>
            )}
            {scanSuccess && (
              <div className="rounded-xl bg-[#a2f31f]/10 px-4 py-3 text-sm text-[#a2f31f] font-medium flex items-center gap-2 mt-3">
                <span>&#10003;</span> {scanSuccess}
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* Leads Results section */}
      {results.length > 0 && (
        <section className="space-y-6 pt-4">
          {/* Top bar: post filter + RER card */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-7 space-y-3">
              <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block">Filtrar por Post</label>
              <select value={filterPostUrl} onChange={(e) => { setFilterPostUrl(e.target.value); setResultsPage(1); }} className="w-full max-w-md bg-[#1a1919] border border-white/5 rounded-xl px-4 py-3 text-sm font-medium text-[#adaaaa] outline-none focus:ring-2 focus:ring-[#ca98ff]">
                <option value="all">Todos os Posts ({uniquePostUrls.length})</option>
                {uniquePostUrls.map((url) => {
                  const post = posts.find((p) => p.post_url === url);
                  const textPreview = post?.text_content?.slice(0, 15) ?? shortPostLabel(url);
                  const pRer = postRerMap.get(url);
                  return <option key={url} value={url}>{textPreview}... — RER (Revenue Engagement Rate) {pRer?.rer ?? 0}%</option>;
                })}
              </select>
              {filterPostUrl !== "all" && (
                <div>
                  <a href={filterPostUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#ca98ff] hover:text-[#e197fc] transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    Ver post no LinkedIn
                  </a>
                </div>
              )}
            </div>
            {/* RER Card */}
            <div className="col-span-12 lg:col-span-5">
              <div className="bg-[#ca98ff]/10 border border-[#ca98ff]/20 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ca98ff" strokeWidth="1.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
                </div>
                <div className="relative z-10">
                  <span className="text-[0.65rem] font-bold tracking-[0.1em] text-[#ca98ff] uppercase block mb-1">
                    Top Post — RER (Revenue Engagement Rate)
                    <InfoTooltip text="RER (Revenue Engagement Rate) = % de engajadores classificados como decisores sobre o total de engajadores do post. Quanto maior, mais o post atraiu decisores de compra — forte indicador de potencial de conversão." />
                  </span>
                  {topPost ? (
                    <>
                      <h3 className="text-5xl font-black text-[#ca98ff] font-[family-name:var(--font-lexend)]">{topPost.rer}%</h3>
                      <p className="text-xs text-white/60 mt-1 truncate max-w-[250px]">{topPost.text}...</p>
                    </>
                  ) : (
                    <h3 className="text-5xl font-black text-[#ca98ff] font-[family-name:var(--font-lexend)]">{rer}%</h3>
                  )}
                  <p className="text-[10px] text-[#adaaaa] mt-3">Média RER (Revenue Engagement Rate): <span className="text-white/60 font-bold">{rer}%</span> · Decisor / Total Engagement</p>
                  <button
                    onClick={() => setShowPostDetails(true)}
                    className="mt-3 text-xs text-[#ca98ff] hover:text-[#e197fc] font-semibold transition-colors"
                  >
                    Ver detalhes →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Post details view */}
          {showPostDetails && (
            <div className="space-y-4">
              <button
                onClick={() => setShowPostDetails(false)}
                className="text-xs text-[#adaaaa] hover:text-[#ca98ff] transition-colors font-[family-name:var(--font-lexend)]"
              >
                ← Voltar para leads
              </button>
              <h2 className="text-xl font-extrabold text-white font-[family-name:var(--font-lexend)]">Posts por RER (Revenue Engagement Rate)</h2>
              <div className="space-y-3">
                {Array.from(postRerMap.entries())
                  .sort((a, b) => b[1].rer - a[1].rer)
                  .map(([url, stats]) => {
                    const post = posts.find((p) => p.post_url === url);
                    const textPreview = post?.text_content?.slice(0, 40) ?? shortPostLabel(url);
                    const rerColor = stats.rer >= 50 ? "text-[#a2f31f]" : stats.rer >= 25 ? "text-[#ca98ff]" : "text-[#adaaaa]";
                    const rerBg = stats.rer >= 50 ? "bg-[#a2f31f]/10 border-[#a2f31f]/20" : stats.rer >= 25 ? "bg-[#ca98ff]/10 border-[#ca98ff]/20" : "bg-white/[0.03] border-white/[0.08]";
                    return (
                      <button
                        key={url}
                        onClick={() => { setFilterPostUrl(url); setResultsPage(1); setShowPostDetails(false); }}
                        className={`w-full ${rerBg} border rounded-xl p-5 text-left hover:opacity-90 transition-all`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-3xl font-black font-[family-name:var(--font-lexend)] ${rerColor}`}>{stats.rer}%</span>
                          <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#ca98ff] hover:text-[#e197fc] transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                          </a>
                        </div>
                        <p className="text-sm text-white/80 mb-3">{textPreview}{textPreview.length >= 40 ? "..." : ""}</p>
                        <div className="flex gap-2 text-[10px]">
                          <span className="rounded-full bg-[#ca98ff]/10 text-[#ca98ff] px-2 py-0.5">{stats.decisors} decisor</span>
                          <span className="rounded-full bg-white/5 text-[#adaaaa] px-2 py-0.5">{stats.total} total</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Table header */}
          {!showPostDetails && (<>
          <div className="flex justify-between items-end flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-extrabold text-white font-[family-name:var(--font-lexend)]">Lista de Leads ({filteredResults.length})</h2>
              <p className="text-[#adaaaa] text-sm mt-1">
                {totalTrackedPosts} posts trackeados · até {totalPossibleInteractions} interações por lead
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <select
                value={sortMode}
                onChange={(e) => { setSortMode(e.target.value as SortMode); setResultsPage(1); }}
                className="bg-[#201f1f] border-none rounded-lg px-3 py-2 text-sm text-[#adaaaa] outline-none focus:ring-2 focus:ring-[#ca98ff]"
                title="Ordenação"
              >
                <option value="lead_score_desc">Lead Score ↓ (melhores)</option>
                <option value="lead_score_asc">Lead Score ↑</option>
                <option value="recent_desc">Recém adicionados ↓</option>
                <option value="recent_asc">Mais antigos ↑</option>
              </select>
              <input type="text" value={searchText} onChange={(e) => { setSearchText(e.target.value); setResultsPage(1); }} placeholder="Filtrar leads..." className="bg-[#201f1f] border-none rounded-lg px-4 py-2 text-sm text-white w-48 outline-none focus:ring-2 focus:ring-[#ca98ff]" />
              <select value={filterRoleLevel} onChange={(e) => { setFilterRoleLevel(e.target.value); setResultsPage(1); }} className="bg-[#201f1f] border-none rounded-lg px-3 py-2 text-sm text-[#adaaaa] outline-none focus:ring-2 focus:ring-[#ca98ff]">
                <option value="all">Todos</option>
                <option value="decisor">Decisor</option>
                <option value="influenciador">Influenciador</option>
                <option value="observador">Observador</option>
              </select>
              <button onClick={exportCsv} className="bg-[#262626] px-4 py-2 rounded-lg text-sm font-medium text-[#adaaaa] hover:text-white hover:bg-[#333] transition-all">
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Table with dual scroll (top + bottom) */}
          <div
            className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-xl shadow-2xl overflow-x-auto"
            ref={(el) => {
              if (!el) return;
              // Create synced top scrollbar
              const id = "table-top-scroll";
              let topScroll = el.parentElement?.querySelector(`#${id}`) as HTMLDivElement | null;
              if (!topScroll) {
                topScroll = document.createElement("div");
                topScroll.id = id;
                topScroll.style.overflowX = "auto";
                topScroll.style.marginBottom = "4px";
                const inner = document.createElement("div");
                inner.style.height = "1px";
                topScroll.appendChild(inner);
                el.parentElement?.insertBefore(topScroll, el);
                topScroll.addEventListener("scroll", () => { el.scrollLeft = topScroll!.scrollLeft; });
                el.addEventListener("scroll", () => { topScroll!.scrollLeft = el.scrollLeft; });
              }
              const inner = topScroll.firstChild as HTMLDivElement;
              if (inner) inner.style.width = `${el.scrollWidth}px`;
            }}
          >
            <table className="w-full text-left min-w-[1100px]">
              <thead>
                <tr className="bg-[#131313]/50">
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Lead</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Cargo</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase text-center whitespace-nowrap">
                    Lead Score
                    <InfoTooltip text={`Índice 0–100 combinando poder de decisão (35%), ICP (25%), proporção de interações (25%) e tipo de engajamento (15%). Leads com maior score são mais qualificados para abordagem.`} />
                  </th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase text-center whitespace-nowrap">
                    Interações
                    <InfoTooltip text={`Quantidade de posts do seu LinkedIn com os quais o lead interagiu (curtida ou comentário), sobre o máximo possível: ${totalTrackedPosts} posts × 2 = ${totalPossibleInteractions} interações possíveis por lead.`} />
                  </th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Status</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Empresa</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">ICP Score</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Engagement</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase whitespace-nowrap">Coletado em</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Posts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedResults.map((lead) => {
                  const rl = roleLevelLabel(lead.role_level);
                  const icp = icpLabel(lead.icp_score);
                  const denom = totalPossibleInteractions;
                  const isFull = lead.interaction_count >= denom && denom > 0;
                  const leadScore = computeLeadScore(lead, denom);
                  const lsColor =
                    leadScore >= 75 ? "text-[#a2f31f]" :
                    leadScore >= 50 ? "text-[#ca98ff]" :
                    leadScore >= 30 ? "text-[#ff946e]" :
                    "text-[#adaaaa]";
                  const lsBg =
                    leadScore >= 75 ? "bg-[#a2f31f]/10" :
                    leadScore >= 50 ? "bg-[#ca98ff]/10" :
                    leadScore >= 30 ? "bg-[#ff946e]/10" :
                    "bg-white/5";
                  return (
                    <tr key={lead.id} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          {lead.profile_photo ? (
                            <img src={lead.profile_photo} alt={lead.name} className="w-10 h-10 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#262626] flex items-center justify-center">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#adaaaa" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                          )}
                          <div>
                            <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="font-bold text-white group-hover:text-[#ca98ff] transition-colors">{lead.name}</a>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-medium text-white/80">{lead.job_title || "—"}</td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center justify-center rounded-full font-black text-sm px-3 py-1 min-w-[48px] ${lsBg} ${lsColor}`}>
                          {leadScore}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${isFull ? "bg-[#ca98ff]/20 text-[#ca98ff]" : "bg-white/5 text-[#adaaaa]"}`}>
                          {lead.interaction_count}/{denom}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${rl.cls}`}>{rl.text}</span>
                      </td>
                      <td className="px-6 py-5 text-sm text-[#adaaaa] font-medium">{lead.company || "—"}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${icp.dot}`} />
                          <span className={`text-xs font-bold ${icp.cls}`}>{icp.text}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${lead.engagement_type === "comment" || lead.engagement_type === "both" ? "text-[#ca98ff]" : "text-[#adaaaa]"}`}>
                          {lead.engagement_type === "both" ? "Curtida + Comentário" : lead.engagement_type === "comment" ? "Comentário" : "Curtida"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-[11px] text-[#adaaaa] whitespace-nowrap">
                        {lead.created_at ? formatCollectedAt(lead.created_at) : "—"}
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1 max-w-[180px]">
                          {(lead.source_post_urls ?? []).slice(0, 3).map((url, i) => {
                            const post = posts.find((p) => p.post_url === url);
                            const preview = post?.text_content?.slice(0, 15) ?? shortPostLabel(url);
                            return (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-[#adaaaa] hover:text-[#ca98ff] transition-colors truncate">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                {preview}...
                              </a>
                            );
                          })}
                          {(lead.source_post_urls ?? []).length > 3 && (
                            <span className="text-[10px] text-white/20">+{(lead.source_post_urls ?? []).length - 3} mais</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedResults.length === 0 && (
                  <tr><td colSpan={10} className="px-6 py-12 text-center text-[#adaaaa] text-sm">Nenhum lead encontrado com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setResultsPage((p) => Math.max(1, p - 1))} disabled={resultsPage === 1} className="rounded-full bg-[#20201f] px-4 py-2 text-xs font-medium text-[#adaaaa] hover:text-white hover:bg-[#262626] disabled:opacity-50 transition-colors">Anterior</button>
                <span className="px-4 py-2 text-xs font-medium text-[#adaaaa]">Página {resultsPage} de {totalPages}</span>
                <button onClick={() => setResultsPage((p) => Math.min(totalPages, p + 1))} disabled={resultsPage === totalPages} className="rounded-full bg-[#20201f] px-4 py-2 text-xs font-medium text-[#adaaaa] hover:text-white hover:bg-[#262626] disabled:opacity-50 transition-colors">Próxima</button>
              </div>
            </div>
          )}

          {/* Footer count */}
          <p className="text-center text-xs text-[#adaaaa]">
            Exibindo {filteredResults.length} de {results.length} leads identificados
          </p>
          </>)}
        </section>
      )}

      {/* Leads empty state */}
      {results.length === 0 && !scanning && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#ca98ff]/10 border border-[#ca98ff]/20 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ca98ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2 font-[family-name:var(--font-lexend)]">Nenhum lead encontrado ainda</h3>
          <p className="text-sm text-[#adaaaa] max-w-md mx-auto">Configure os cargos e departamentos acima e clique em &quot;Ver Decisores Interessados&quot; para encontrar leads qualificados.</p>
        </div>
      )}

    </div>
  );
}
