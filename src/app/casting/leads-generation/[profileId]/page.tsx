"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CastingResultsDark } from "@/components/casting/casting-results-dark";
import { CastingProfile } from "@/components/casting/casting-results";

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001+"];
const ITEMS_PER_PAGE = 20;

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
  const [activeCard, setActiveCard] = useState<"leads" | "influencers">("leads");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leads results state
  const [results, setResults] = useState<LeadResult[]>([]);
  const [posts, setPosts] = useState<PostInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState(0);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [userCredits, setUserCredits] = useState<number>(-1);
  const [scanCredits, setScanCredits] = useState(3);
  const [resultsPage, setResultsPage] = useState(1);
  const [filterPostUrl, setFilterPostUrl] = useState("all");
  const [filterRoleLevel, setFilterRoleLevel] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Influencer state
  const [influencerProfiles, setInfluencerProfiles] = useState<CastingProfile[]>([]);
  const [influencerSearching, setInfluencerSearching] = useState(false);
  const [influencerStep, setInfluencerStep] = useState(0);
  const influencerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [influencerCredits, setInfluencerCredits] = useState(3);
  const [influencerSuccess, setInfluencerSuccess] = useState<string | null>(null);

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
          setInfluencerCredits((c) => Math.min(c, credits));
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

        // Load ALL influencer results for this profile
        try {
          const infRes = await fetch(`/api/leads-generation/influencer-results?profileId=${profileId}`);
          if (infRes.ok) {
            const infData = await infRes.json();
            setInfluencerProfiles(infData.profiles ?? []);
          }
        } catch { /* ignore */ }
      }

      if (resultsRes.ok) {
        const data = await resultsRes.json();
        setResults(data.results ?? []);
        setPosts(data.posts ?? []);
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
      setScanStep((prev) => Math.min(prev + 1, SCAN_STEPS.length - 1));
    }, 6000);

    try {
      // Trigger scan (returns immediately, processing runs async in background)
      const res = await fetch("/api/leads-generation/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, credits: scanCredits }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage("Não foi possível realizar a operação! Tente novamente mais tarde.");
        return;
      }

      // Poll for results every 5s until stable (same pattern as influencer/casting)
      const prevCount = results.length;
      let lastCount = prevCount;
      let stableTime = 0;

      while (stableTime < 30000) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const resultsRes = await fetch(`/api/leads-generation/results?profileId=${profileId}`);
          if (!resultsRes.ok) continue;
          const data = await resultsRes.json();
          const newResults = data.results ?? [];

          if (newResults.length > results.length) {
            setResults(newResults);
            setPosts(data.posts ?? []);
          }

          if (newResults.length === lastCount) {
            stableTime += 5000;
          } else {
            stableTime = 0;
            lastCount = newResults.length;
          }
        } catch { /* retry */ }
      }

      // Final reload
      const finalRes = await fetch(`/api/leads-generation/results?profileId=${profileId}`);
      if (finalRes.ok) {
        const data = await finalRes.json();
        setResults(data.results ?? []);
        setPosts(data.posts ?? []);
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

  const INFLUENCER_STEPS = [
    "Analisando temas de mercado...",
    "Buscando influenciadores no LinkedIn...",
    "Avaliando relevância e engajamento...",
    "Calculando score dos creators...",
    "Finalizando resultados...",
  ];

  async function handleInfluencerSearch() {
    setInfluencerSearching(true);
    setInfluencerStep(0);
    influencerIntervalRef.current = setInterval(() => {
      setInfluencerStep((prev) => Math.min(prev + 1, INFLUENCER_STEPS.length - 1));
    }, 8000);

    try {
      const res = await fetch("/api/leads-generation/influencer-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, credits: influencerCredits }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage("Não foi possível realizar a operação! Tente novamente mais tarde.");
        return;
      }
      const { searchId } = await res.json();
      // searchId used for polling below

      // Poll for status every 5 seconds (same pattern as /casting page)
      let searchComplete = false;
      while (!searchComplete) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const statusRes = await fetch(`/api/casting/search/${searchId}/status`);
          if (!statusRes.ok) continue;

          const statusData = await statusRes.json();

          // Update displayed profiles progressively
          if (statusData.profiles?.length > 0) {
            setInfluencerProfiles((prev) => {
              const existing = new Set(prev.map((p) => p.slug));
              const newOnes = (statusData.profiles as CastingProfile[]).filter((p: CastingProfile) => !existing.has(p.slug));
              return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
            });
          }

          if (statusData.status === "complete") {
            searchComplete = true;
            const totalFound = statusData.found ?? 0;
            setInfluencerSuccess(`${totalFound} influenciador${totalFound !== 1 ? "es" : ""} encontrado${totalFound !== 1 ? "s" : ""}!`);
            setTimeout(() => setInfluencerSuccess(null), 8000);
          } else if (statusData.status === "error") {
            searchComplete = true;
            setErrorMessage("Não foi possível realizar a operação! Tente novamente mais tarde.");
          }
        } catch { /* retry on next poll */ }
      }

      // Reload ALL results for this profile (includes previous + new)
      try {
        const allRes = await fetch(`/api/leads-generation/influencer-results?profileId=${profileId}`);
        if (allRes.ok) {
          const allData = await allRes.json();
          setInfluencerProfiles(allData.profiles ?? []);
        }
      } catch { /* ignore */ }

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
      if (influencerIntervalRef.current) { clearInterval(influencerIntervalRef.current); influencerIntervalRef.current = null; }
      setInfluencerSearching(false);
    }
  }

  // Filtered results
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (filterPostUrl !== "all" && !r.source_post_urls?.includes(filterPostUrl)) return false;
      if (filterRoleLevel !== "all" && r.role_level !== filterRoleLevel) return false;
      if (searchText && !r.name?.toLowerCase().includes(searchText.toLowerCase()) && !r.company?.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [results, filterPostUrl, filterRoleLevel, searchText]);

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
    const headers = ["Nome", "LinkedIn URL", "Cargo", "Empresa", "ICP Score", "Status", "Interações", "Engajamento", "Posts URLs", "Posts Preview"];
    const escape = (v: string) => v.includes(",") || v.includes('"') || v.includes("\n") ? '"' + v.replace(/"/g, '""') + '"' : v;
    const rows = filteredResults.map((r) => {
      const postPreviews = (r.source_post_urls ?? []).map((url) => {
        const post = posts.find((p) => p.post_url === url);
        return post?.text_content?.slice(0, 30) ?? shortPostLabel(url);
      }).join("; ");
      return [
        r.name, r.linkedin_url, r.job_title, r.company,
        String(r.icp_score), r.role_level ?? "",
        `${r.interaction_count}/${r.total_possible_interactions}`,
        r.engagement_type ?? "",
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

      {/* Two paths — card selection */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Leads Card */}
        <div
          className={`bg-white/[0.03] backdrop-blur-xl border rounded-[2rem] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.37)] relative overflow-hidden cursor-pointer transition-all ${activeCard === "leads" ? "border-[#ca98ff]/40" : "border-white/[0.08] opacity-70 hover:opacity-90"}`}
          onClick={() => setActiveCard("leads")}
        >
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#ca98ff]/20 blur-[60px] rounded-full pointer-events-none" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#ca98ff]/10 border border-[#ca98ff]/20 flex items-center justify-center shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ca98ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-[family-name:var(--font-lexend)]">Leads ({results.length})</h2>
              <p className="text-[#adaaaa] text-xs mt-1">Identifique decisores que já demonstraram interesse.</p>
            </div>
          </div>

          {activeCard === "leads" && (<>
          <div className="space-y-5 relative z-10 mt-4" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block">Cargos</label>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-0.5 focus-within:border-[#ca98ff]/40 transition-all">
                  <textarea rows={3} value={options.job_titles.join(", ")} onChange={(e) => updateField("job_titles", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className="w-full bg-transparent border-none focus:ring-0 px-3 py-2.5 text-white text-xs font-medium outline-none placeholder-white/20 resize-none" placeholder="CEO, CTO, VP Marketing..." />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block">Departamentos</label>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-0.5 focus-within:border-[#ca98ff]/40 transition-all">
                  <textarea rows={3} value={options.departments.join(", ")} onChange={(e) => updateField("departments", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className="w-full bg-transparent border-none focus:ring-0 px-3 py-2.5 text-white text-xs font-medium outline-none placeholder-white/20 resize-none" placeholder="Marketing, Sales..." />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block">Tamanho da Empresa</label>
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
          <div className="mt-6 relative z-10 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-xs text-[#adaaaa]">
              <span>~{scanCredits * 15} leads ({scanCredits} créditos)</span>
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
          </div>
          </>)}
        </div>

        {/* Influenciadores Card */}
        <div
          className={`bg-white/[0.03] backdrop-blur-xl border rounded-[2rem] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.37)] cursor-pointer transition-all ${activeCard === "influencers" ? "border-[#ca98ff]/40" : "border-white/[0.08] opacity-70 hover:opacity-90"}`}
          onClick={() => setActiveCard("influencers")}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-[family-name:var(--font-lexend)]">Influenciadores ({influencerProfiles.length})</h2>
              <p className="text-[#adaaaa] text-xs mt-1">Crie conexões e autoridade interagindo com grandes players do seu nicho.</p>
            </div>
          </div>
          {activeCard === "influencers" && (
            <div className="mt-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black tracking-[0.2em] text-white/30 uppercase block">Temas de Atuação</label>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-1 focus-within:border-[#ca98ff]/40 transition-all">
                  <textarea rows={3} value={options.market_context} onChange={(e) => updateField("market_context", e.target.value)} className="w-full bg-transparent border-none focus:ring-0 px-4 py-3 text-white text-sm font-medium outline-none placeholder-white/20 resize-none" placeholder="Ex: Métricas de Marketing, Analytics, Growth..." />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-[#adaaaa]">
                <span>~{influencerCredits * 3} influenciadores ({influencerCredits} créditos)</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setInfluencerCredits((c) => Math.max(1, c - 1))} className="w-6 h-6 rounded-full bg-white/5 text-white/60 hover:bg-white/10 flex items-center justify-center text-sm">-</button>
                  <span className="text-white font-bold w-4 text-center">{influencerCredits}</span>
                  <button onClick={() => setInfluencerCredits((c) => userCredits === -1 ? c + 1 : Math.min(c + 1, userCredits))} disabled={userCredits !== -1 && influencerCredits >= userCredits} className="w-6 h-6 rounded-full bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm">+</button>
                </div>
              </div>
              {userCredits !== -1 && influencerCredits >= userCredits && userCredits > 0 && (
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
              {influencerSuccess && (
                <div className="rounded-xl bg-[#a2f31f]/10 px-4 py-3 text-sm text-[#a2f31f] font-medium flex items-center gap-2">
                  <span>&#10003;</span> {influencerSuccess}
                </div>
              )}
              {influencerSearching ? (
                <div className="space-y-3 py-2">
                  {INFLUENCER_STEPS.map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {i < influencerStep ? (
                        <span className="text-[#a2f31f] text-sm">&#10003;</span>
                      ) : i === influencerStep ? (
                        <span className="animate-pulse text-[#ca98ff] text-sm">&#9679;</span>
                      ) : (
                        <span className="text-white/20 text-sm">&#9675;</span>
                      )}
                      <span className={`text-xs ${i <= influencerStep ? "text-white" : "text-white/20"}`}>{step}</span>
                    </div>
                  ))}
                  <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                    <div className="bg-[#ca98ff] h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.round(((influencerStep + 1) / INFLUENCER_STEPS.length) * 100)}%` }} />
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleInfluencerSearch}
                  disabled={userCredits === 0}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#ca98ff] to-[#9c48ea] text-[#1a0033] font-bold text-sm shadow-[0_10px_30px_-5px_rgba(204,151,255,0.4)] hover:shadow-[0_15px_40px_-5px_rgba(204,151,255,0.5)] hover:translate-y-[-2px] transition-all active:scale-[0.98] tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {influencerProfiles.length > 0 ? "BUSCAR MAIS INFLUENCIADORES" : "BUSCAR INFLUENCIADORES"}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Leads Results section */}
      {activeCard === "leads" && results.length > 0 && (
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
                  return <option key={url} value={url}>{textPreview}... — RER {pRer?.rer ?? 0}%</option>;
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
                  <span className="text-[0.65rem] font-bold tracking-[0.1em] text-[#ca98ff] uppercase block mb-1">Revenue Engagement Rate (RER)</span>
                  <h3 className="text-5xl font-black text-[#ca98ff] font-[family-name:var(--font-lexend)]">{rer}%</h3>
                  <p className="text-xs text-[#adaaaa] mt-2">Decisor Engagement / Total Engagement</p>
                  {topPost && (
                    <button
                      onClick={() => { setFilterPostUrl(topPost.url); setResultsPage(1); }}
                      className="mt-3 flex items-center gap-2 text-xs text-[#ca98ff] hover:text-[#e197fc] transition-colors"
                    >
                      <span className="text-[10px] text-white/40">Top Post:</span>
                      <span className="font-semibold truncate max-w-[180px]">{topPost.text}...</span>
                      <span className="font-bold">{topPost.rer}%</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table header */}
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-extrabold font-[family-name:var(--font-lexend)]">Análise de Decisores</h2>
              <p className="text-[#adaaaa] text-sm mt-1">Ordenado por <span className="text-[#ca98ff] font-semibold">Status + Score ICP</span></p>
            </div>
            <div className="flex gap-3">
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

          {/* Table */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-xl overflow-hidden shadow-2xl">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#131313]/50">
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Lead</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Cargo</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase text-center">Interações</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Status</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Empresa</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">ICP Score</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Engagement</th>
                  <th className="px-6 py-4 text-[0.65rem] font-bold tracking-widest text-[#adaaaa] uppercase">Posts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedResults.map((lead) => {
                  const rl = roleLevelLabel(lead.role_level);
                  const icp = icpLabel(lead.icp_score);
                  const isFull = lead.interaction_count >= lead.total_possible_interactions && lead.total_possible_interactions > 0;
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
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${isFull ? "bg-[#ca98ff]/20 text-[#ca98ff]" : "bg-white/5 text-[#adaaaa]"}`}>
                          {lead.interaction_count}/{lead.total_possible_interactions}
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
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-[#adaaaa] text-sm">Nenhum lead encontrado com esses filtros.</td></tr>
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
        </section>
      )}

      {/* Leads empty state */}
      {activeCard === "leads" && results.length === 0 && !scanning && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#ca98ff]/10 border border-[#ca98ff]/20 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ca98ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2 font-[family-name:var(--font-lexend)]">Nenhum lead encontrado ainda</h3>
          <p className="text-sm text-[#adaaaa] max-w-md mx-auto">Configure os cargos e departamentos acima e clique em &quot;Ver Decisores Interessados&quot; para encontrar leads qualificados.</p>
        </div>
      )}

      {/* Influencer Results section */}
      {activeCard === "influencers" && influencerProfiles.length > 0 && (
        <section className="space-y-4 pt-4">
          <CastingResultsDark
            profiles={influencerProfiles}
            readOnly
          />
        </section>
      )}

      {/* Influencer empty state */}
      {activeCard === "influencers" && influencerProfiles.length === 0 && !influencerSearching && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2 font-[family-name:var(--font-lexend)]">Nenhum influenciador encontrado ainda</h3>
          <p className="text-sm text-[#adaaaa] max-w-md mx-auto">Defina os temas de atuação acima e clique em &quot;Buscar Influenciadores&quot; para encontrar criadores de conteúdo relevantes no seu mercado.</p>
        </div>
      )}
    </div>
  );
}
