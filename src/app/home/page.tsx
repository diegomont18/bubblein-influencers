"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { CastingResultsDark } from "@/components/casting/casting-results-dark";
import { CastingProfile } from "@/components/casting/casting-results";

const SEARCH_STEPS = [
  "Análise estratégica de conteúdo…",
  "Identificando creators por grau de influência…",
  "Análise de alcance dos creators…",
  "Analisando relevância dos perfis…",
  "Calculando score dos creators…",
  "Finalizando resultados…",
];

const LANGUAGES = [
  { label: "Portuguese (Brazil)", value: "lang_pt", country: "br", domain: "google.com.br" },
  { label: "English (US)", value: "lang_en", country: "us", domain: "google.com" },
  { label: "Spanish", value: "lang_es", country: "es", domain: "google.es" },
  { label: "French", value: "lang_fr", country: "fr", domain: "google.fr" },
];

interface Campaign {
  id: string;
  name: string;
}

interface SearchTab {
  id: string;
  name: string;
  profiles: CastingProfile[];
  loaded: boolean;
  profileCount: number;
  campaignId: string | null;
}

export default function HomePage() {
  const [userCredits, setUserCredits] = useState<number>(3);
  const [themes, setThemes] = useState("");
  const [languageIdx, setLanguageIdx] = useState(0);
  const [minFollowers, setMinFollowers] = useState(2500);
  const [maxFollowers, setMaxFollowers] = useState(100000);
  const [resultsCount, setResultsCount] = useState(3);
  const [searching, setSearching] = useState(false);
  const [searchStep, setSearchStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Campaigns
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [filterCampaignId, setFilterCampaignId] = useState<string | null>(null); // null = all

  // View toggle & panorama stats
  const [activeView, setActiveView] = useState<"campanhas" | "panorama">("campanhas");
  const [lastSearchStats, setLastSearchStats] = useState<{
    totalCandidates: number;
    matched: number;
    keywordStats: Record<string, { googleResults: number; candidates: number; matched: number; filteredJob: number; filteredRepost: number }>;
  } | null>(null);

  // Search tabs
  const [searchTabs, setSearchTabs] = useState<SearchTab[]>([]);

  // Campaign editing
  const [editingCampaignName, setEditingCampaignName] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Fetch user credits
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          const credits = data.user.credits === -1 ? 100 : data.user.credits;
          setUserCredits(credits);
          setResultsCount((prev) => Math.min(prev, credits));
        }
      })
      .catch(() => {});
  }, []);

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (!res.ok) return;
      const json = await res.json();
      const list = (json.campaigns ?? []) as Campaign[];
      setCampaigns(list);

      // Auto-create "Campanha 1" if none exist
      if (list.length === 0) {
        const createRes = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Campanha 1" }),
        });
        if (createRes.ok) {
          const data = await createRes.json();
          setCampaigns([data.campaign]);
          setActiveCampaignId(data.campaign.id);
        }
      } else if (!activeCampaignId) {
        setActiveCampaignId(list[0].id);
      }
    } catch { /* ignore */ }
  }, [activeCampaignId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // Load past searches from DB
  const loadPastSearches = useCallback(async () => {
    try {
      const res = await fetch("/api/casting/lists");
      if (!res.ok) return;
      const json = await res.json();
      const lists = (json.data ?? []) as Array<{
        id: string;
        name: string;
        filters_applied: Record<string, unknown> | null;
        casting_list_profiles: [{ count: number }];
        campaign_id: string | null;
      }>;

      const contentLists = lists.filter(
        (l) => (l.filters_applied?.searchMode ?? "content") === "content"
      );

      setSearchTabs((prev) => {
        const inProgress = prev.filter((t) => t.id.startsWith("temp-"));
        const dbTabs: SearchTab[] = contentLists.map((l) => {
          const existing = prev.find((t) => t.id === l.id);
          return {
            id: l.id,
            name: l.name,
            profiles: existing?.profiles ?? [],
            loaded: existing?.loaded ?? false,
            profileCount: l.casting_list_profiles?.[0]?.count ?? 0,
            campaignId: l.campaign_id ?? null,
          };
        });
        return [...dbTabs, ...inProgress];
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadPastSearches(); }, [loadPastSearches]);

  async function loadTabProfiles(tabId: string) {
    try {
      const res = await fetch(`/api/casting/lists?id=${tabId}`);
      if (!res.ok) return;
      const json = await res.json();
      const profiles: CastingProfile[] = (json.profiles ?? []).map(
        (p: { notes: string; profile_id: string }) => {
          try {
            const notes = typeof p.notes === "string" ? JSON.parse(p.notes) : p.notes;
            return {
              slug: p.profile_id,
              name: notes?.name ?? "Unknown",
              headline: notes?.headline ?? "",
              job_title: notes?.job_title ?? "",
              company: notes?.company ?? "",
              location: notes?.location ?? "",
              followers: notes?.followers ?? 0,
              followers_range: notes?.followers_range ?? undefined,
              posts_per_month: notes?.posts_per_month ?? 0,
              avg_likes_per_post: notes?.avg_likes_per_post ?? null,
              avg_comments_per_post: notes?.avg_comments_per_post ?? null,
              creator_score: notes?.creator_score ?? null,
              topics: notes?.topics ?? [],
              final_score: notes?.final_score ?? undefined,
              linkedin_url: notes?.linkedin_url ?? `https://linkedin.com/in/${p.profile_id}`,
              focus: notes?.focus ?? null,
              source_keyword: notes?.source_keyword ?? undefined,
              profile_photo: notes?.profile_photo ?? "",
              found_at: notes?.found_at ?? undefined,
            };
          } catch {
            return {
              slug: p.profile_id, name: "Unknown", headline: "", job_title: "", company: "",
              location: "", followers: 0, posts_per_month: 0,
              linkedin_url: `https://linkedin.com/in/${p.profile_id}`,
            };
          }
        }
      );
      setSearchTabs((prev) =>
        prev.map((t) => t.id === tabId ? { ...t, profiles, loaded: true, profileCount: profiles.length } : t)
      );
    } catch { /* ignore */ }
  }

  // Eagerly load profiles for all unloaded tabs
  useEffect(() => {
    for (const tab of searchTabs) {
      if (!tab.loaded && !tab.id.startsWith("temp-")) {
        loadTabProfiles(tab.id);
      }
    }
  }, [searchTabs]);

  // Filtered tabs by campaign
  const filteredTabs = useMemo(() => {
    if (!filterCampaignId) return searchTabs;
    return searchTabs.filter((t) => t.campaignId === filterCampaignId);
  }, [searchTabs, filterCampaignId]);

  const allProfiles = useMemo(() => {
    return filteredTabs.filter((t) => t.loaded).flatMap((t) => t.profiles);
  }, [filteredTabs]);

  async function handleSearch() {
    if (userCredits <= 0) { setError("Sem créditos. Compre mais para continuar buscando."); return; }
    if (!activeCampaignId) { setError("Selecione uma campanha."); return; }
    const themeLines = themes.split("\n").map((l) => l.trim()).filter(Boolean);
    if (themeLines.length === 0) { setError("Insira pelo menos uma palavra-chave."); return; }
    setError(null);
    setWarningMessage(null);
    setSearching(true);
    setSearchStep(0);
    stepIntervalRef.current = setInterval(() => {
      setSearchStep((prev) => Math.min(prev + 1, SEARCH_STEPS.length - 1));
    }, 8000);

    const tempId = `temp-${Date.now()}`;
    const newTab: SearchTab = { id: tempId, name: "Buscando...", profiles: [], loaded: true, profileCount: 0, campaignId: activeCampaignId };
    setSearchTabs((prev) => [...prev, newTab]);
    setFilterCampaignId(activeCampaignId);

    const lang = LANGUAGES[languageIdx];
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const maxResults = resultsCount;
    let dbListId: string | null = null;
    let partialData: { found: number; requested: number } | null = null;

    try {
      const res = await fetch("/api/casting/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themes: themeLines,
          language: lang.value,
          country: lang.country,
          domain: lang.domain,
          minFollowers, maxFollowers,
          resultsCount: maxResults,
          coverAllKeywords: true,
          publico: [],
          searchMode: "content",
          campaignId: activeCampaignId,
        }),
        signal: controller.signal,
      });
      if (!res.ok) { const json = await res.json().catch(() => ({})); throw new Error(json.error ?? `Busca falhou (${res.status})`); }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let count = 0;
      const bufferedProfiles: CastingProfile[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split("\n");
        streamBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "profile" && count < maxResults) {
              count++;
              bufferedProfiles.push(event.data as CastingProfile);
            } else if (event.type === "partial") {
              partialData = event.data;
            } else if (event.type === "done") {
              dbListId = event.data.listId ?? null;
              if (event.data.keywordStats) {
                const totalMatched = Object.values(event.data.keywordStats as Record<string, { matched: number }>).reduce((sum: number, k) => sum + (k.matched || 0), 0);
                setLastSearchStats({
                  totalCandidates: event.data.totalCandidates ?? 0,
                  matched: totalMatched,
                  keywordStats: event.data.keywordStats,
                });
              }
            } else if (event.type === "error") {
              setError(event.data.message ?? "Busca falhou");
            }
          } catch { /* skip */ }
        }
      }
      if (streamBuffer.trim()) {
        try { const event = JSON.parse(streamBuffer); if (event.type === "done") dbListId = event.data.listId ?? null; } catch { /* ignore */ }
      }
      // Batch all profiles at once
      setSearchTabs((prev) =>
        prev.map((t) => t.id === tempId ? { ...t, profiles: bufferedProfiles, profileCount: bufferedProfiles.length } : t)
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Busca falhou");
      }
    } finally {
      if (stepIntervalRef.current) { clearInterval(stepIntervalRef.current); stepIntervalRef.current = null; }
      setSearchStep(0);
      setSearching(false);
      abortControllerRef.current = null;
      if (dbListId) {
        setSearchTabs((prev) =>
          prev.map((t) => t.id === tempId ? { ...t, id: dbListId! } : t)
        );
        loadPastSearches();
      }
      // Show partial results warning
      if (partialData) {
        setWarningMessage(`Encontramos ${partialData.found} de ${partialData.requested} creators solicitados. Para melhores resultados, tente adicionar mais palavras-chave e/ou ampliar a faixa de seguidores.`);
      }
      // Refresh credits after search (they were deducted server-side)
      const creditsBefore = userCredits;
      fetch("/api/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user) {
            const rawCredits = data.user.credits;
            const newCredits = rawCredits === -1 ? 100 : rawCredits;
            setUserCredits(newCredits);
            // Notify navbar layout
            window.dispatchEvent(new CustomEvent("credits-updated", { detail: rawCredits }));
            // Show success message
            if (rawCredits !== -1) {
              const spent = creditsBefore - newCredits;
              if (spent > 0) {
                setSuccessMessage(`Parabéns, você encontrou mais creators para divulgar sua empresa. Foram gastos ${spent} créditos, e restam ${newCredits} créditos.`);
                setTimeout(() => setSuccessMessage(null), 8000);
              }
            }
          }
        })
        .catch(() => {});
    }
  }

  function handleStopSearch() { abortControllerRef.current?.abort(); }

  async function handleRenameCampaign(newName: string) {
    if (!activeCampaignId || !newName.trim()) {
      setEditingCampaignName(null);
      return;
    }
    try {
      const res = await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeCampaignId, name: newName.trim() }),
      });
      if (res.ok) {
        setCampaigns((prev) => prev.map((c) => c.id === activeCampaignId ? { ...c, name: newName.trim() } : c));
      }
    } catch { /* ignore */ }
    setEditingCampaignName(null);
  }

  async function handleCreateCampaign() {
    const name = `Campanha ${campaigns.length + 1}`;
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns((prev) => [...prev, data.campaign]);
        setActiveCampaignId(data.campaign.id);
      }
    } catch { /* ignore */ }
  }

  const inputClass = "w-full rounded-xl bg-[#20201f] px-4 py-3 text-sm text-white placeholder-white/30 outline-none border-b-2 border-transparent focus:border-[#ca98ff] transition-colors";
  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2 font-[family-name:var(--font-lexend)]";
  const noCredits = userCredits <= 0;

  function Tooltip({ text }: { text: string }) {
    return (
      <span className="relative group ml-1.5 inline-flex align-middle">
        <span className="cursor-help text-[#adaaaa]/60 hover:text-[#ca98ff] transition-colors text-[10px] border border-[#adaaaa]/30 rounded-full w-4 h-4 inline-flex items-center justify-center">?</span>
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-[#262626] px-3 py-2 text-xs text-[#e0e0e0] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50 text-left normal-case tracking-normal font-normal">
          {text}
        </span>
      </span>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative">
        <h1 className="text-4xl font-extrabold text-white tracking-tight font-[family-name:var(--font-lexend)]">
          Casting de Creators
        </h1>
        <p className="mt-2 text-[#adaaaa] max-w-xl font-[family-name:var(--font-be-vietnam-pro)]">
          Encontre os creators perfeitos usando inteligência artificial. Filtre por nicho, métricas e qualidade de audiência.
        </p>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ca98ff]/5 rounded-full blur-[80px] pointer-events-none" />
      </div>

      {/* Search Panel */}
      <div className="rounded-2xl bg-[#131313] p-6 space-y-6">
        {/* Campaign Selector */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className={labelClass}>Campanha<Tooltip text="Agrupe suas buscas em campanhas para organizar os creators encontrados por projeto ou cliente." /></label>
            {editingCampaignName !== null ? (
              <input
                autoFocus
                value={editingCampaignName}
                onChange={(e) => setEditingCampaignName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameCampaign(editingCampaignName); if (e.key === "Escape") setEditingCampaignName(null); }}
                onBlur={() => handleRenameCampaign(editingCampaignName)}
                className={inputClass}
              />
            ) : (
              <select
                value={activeCampaignId ?? ""}
                onChange={(e) => setActiveCampaignId(e.target.value || null)}
                className={inputClass}
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={() => {
              const current = campaigns.find((c) => c.id === activeCampaignId);
              if (current) setEditingCampaignName(current.name);
            }}
            className="mt-6 rounded-full bg-[#20201f] px-3 py-3 text-xs text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors"
            title="Renomear campanha"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          </button>
          <button
            onClick={handleCreateCampaign}
            className="mt-6 rounded-full bg-[#20201f] px-4 py-3 text-xs font-medium text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors font-[family-name:var(--font-lexend)] whitespace-nowrap"
          >
            + Nova campanha
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Keywords */}
          <div className="lg:col-span-8">
            <label className={labelClass}>Palavras-chave<Tooltip text="Digite os temas ou nichos que você busca. Separe por vírgula ou linha. Ex: marketing digital, liderança." /></label>
            <textarea
              rows={4}
              value={themes}
              onChange={(e) => setThemes(e.target.value)}
              placeholder={"ex: marketing digital, liderança,\ncriação de conteúdo..."}
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1.5 text-[10px] text-[#adaaaa]/60 font-[family-name:var(--font-be-vietnam-pro)]">
              Separe as palavras-chave por vírgula ou linha. Quanto mais palavras-chave, mais resultados.
            </p>
          </div>

          {/* Right: Filters */}
          <div className="lg:col-span-4 space-y-4 rounded-xl bg-[#1a1a1a] p-5">
            <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">Filtros</h3>

            <div>
              <label className={labelClass}>Idioma<Tooltip text="Selecione o idioma principal do conteúdo dos creators que você deseja encontrar." /></label>
              <select value={languageIdx} onChange={(e) => setLanguageIdx(Number(e.target.value))} className={inputClass}>
                {LANGUAGES.map((l, i) => <option key={l.value} value={i}>{l.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Faixa de Seguidores<Tooltip text="Defina o mínimo e máximo de seguidores dos creators. Deixe em branco para não filtrar." /></label>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={minFollowers} onChange={(e) => setMinFollowers(Number(e.target.value))} min={0} placeholder="Min" className={inputClass} />
                <input type="number" value={maxFollowers} onChange={(e) => setMaxFollowers(Number(e.target.value))} min={0} placeholder="Max" className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Resultados Desejados<Tooltip text={`Quantidade de creators para buscar. O limite atual é ${userCredits} crédito${userCredits !== 1 ? "s" : ""}. Cada resultado consome 1 crédito.`} /></label>
              <input type="number" value={resultsCount} onChange={(e) => setResultsCount(Math.min(Number(e.target.value), userCredits))} min={1} max={userCredits} className={inputClass} />
              {userCredits < 100 && resultsCount >= userCredits && (
                <span className="relative group">
                  <a
                    href="https://wa.me/5511941238555?text=Ola!%20Tenho%20interesse%20em%20comprar%20creditos%20no%20BubbleIn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#a2f31f]/30 bg-[#a2f31f]/10 px-3 py-1.5 text-xs font-semibold text-[#a2f31f] hover:bg-[#a2f31f]/20 transition-colors font-[family-name:var(--font-lexend)]"
                  >
                    <span>✦</span> Comprar mais créditos
                  </a>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-[#262626] px-3 py-2 text-xs text-[#e0e0e0] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
                    Créditos liberam mais buscas de creators. Cada creator encontrado consome 1 crédito. Fale conosco para adquirir mais.
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Search Button */}
        <div>
          {noCredits ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-[#ff946e]">Sem créditos disponíveis.</p>
              <span className="relative group inline-block">
                <a
                  href="https://wa.me/5511941238555?text=Ola!%20Tenho%20interesse%20em%20comprar%20creditos%20no%20BubbleIn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#a2f31f]/30 bg-[#a2f31f]/10 px-5 py-3 text-sm font-semibold text-[#a2f31f] hover:bg-[#a2f31f]/20 transition-colors font-[family-name:var(--font-lexend)]"
                >
                  <span>✦</span> Comprar créditos para começar
                </a>
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-[#262626] px-3 py-2 text-xs text-[#e0e0e0] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
                  Créditos liberam mais buscas de creators. Cada creator encontrado consome 1 crédito. Fale conosco para adquirir mais.
                </span>
              </span>
            </div>
          ) : (
            <button
              onClick={handleSearch}
              disabled={searching}
              className="w-full rounded-full bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] px-6 py-3.5 text-sm font-semibold text-[#46007d] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all font-[family-name:var(--font-lexend)]"
            >
              {searching ? "Buscando..." : "✦ Buscar Creators"}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-[#ff946e]/10 px-4 py-3 text-sm text-[#ff946e]">{error}</div>
      )}

      {/* Partial results warning */}
      {warningMessage && (
        <div className="rounded-xl bg-[#ffb347]/10 px-4 py-3 text-sm text-[#ffb347] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>{warningMessage}</span>
            <button
              onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-full bg-[#ffb347]/20 px-3 py-1 text-xs font-semibold text-[#ffb347] hover:bg-[#ffb347]/30 transition-colors whitespace-nowrap font-[family-name:var(--font-lexend)]"
            >
              &#8595; Ver resultados
            </button>
          </div>
          <button onClick={() => setWarningMessage(null)} className="text-[#ffb347]/60 hover:text-[#ffb347] ml-3 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="rounded-xl bg-[#a2f31f]/10 px-4 py-3 text-sm text-[#a2f31f] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>{successMessage}</span>
            <button
              onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-full bg-[#a2f31f]/20 px-3 py-1 text-xs font-semibold text-[#a2f31f] hover:bg-[#a2f31f]/30 transition-colors whitespace-nowrap font-[family-name:var(--font-lexend)]"
            >
              &#8595; Ver resultados
            </button>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-[#a2f31f]/60 hover:text-[#a2f31f] ml-3 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Results */}
      {(searchTabs.length > 0 || searching) && (
        <div ref={resultsRef} className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-lexend)]">
                Resultados da Busca
                <span className="ml-2 text-sm font-normal text-[#adaaaa]">{allProfiles.length} resultados</span>
              </h2>
              {/* View toggle */}
              <div className="flex rounded-full bg-[#20201f] p-0.5">
                <button
                  onClick={() => setActiveView("campanhas")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all font-[family-name:var(--font-lexend)] ${activeView === "campanhas" ? "bg-[#ca98ff] text-[#46007d]" : "text-[#adaaaa] hover:text-white"}`}
                >
                  Campanhas
                </button>
                <button
                  onClick={() => setActiveView("panorama")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all font-[family-name:var(--font-lexend)] ${activeView === "panorama" ? "bg-[#ca98ff] text-[#46007d]" : "text-[#adaaaa] hover:text-white"}`}
                >
                  Panorama
                </button>
              </div>
            </div>

            {/* Campaign filter */}
            {activeView === "campanhas" && (
              <select
                value={filterCampaignId ?? ""}
                onChange={(e) => setFilterCampaignId(e.target.value || null)}
                className="rounded-full bg-[#20201f] px-4 py-2 text-xs text-[#adaaaa] outline-none font-[family-name:var(--font-lexend)] border-b-2 border-transparent focus:border-[#ca98ff]"
              >
                <option value="">Todas as campanhas</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {searching && (
            <div className="rounded-2xl bg-[#131313] p-6 space-y-4">
              <div className="space-y-3">
                {SEARCH_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 transition-all duration-300">
                    {i < searchStep ? (
                      <span className="text-[#a2f31f] text-sm">&#10003;</span>
                    ) : i === searchStep ? (
                      <span className="animate-pulse text-[#ca98ff] text-sm">&#9679;</span>
                    ) : (
                      <span className="text-[#adaaaa]/30 text-sm">&#9675;</span>
                    )}
                    <span className={`text-sm transition-colors duration-300 ${i <= searchStep ? "text-white" : "text-[#adaaaa]/30"}`}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-center pt-2">
                <button
                  onClick={handleStopSearch}
                  className="rounded-full bg-[#ff946e]/10 px-4 py-2 text-xs font-medium text-[#ff946e] hover:bg-[#ff946e]/20 transition-colors font-[family-name:var(--font-lexend)]"
                >
                  Parar Busca
                </button>
              </div>
            </div>
          )}

          {/* Campanhas view */}
          {!searching && activeView === "campanhas" && (
            <>
              {allProfiles.length === 0 && filterCampaignId ? (
                <div className="rounded-2xl bg-[#131313] overflow-hidden">
                  <div className="px-6 py-12 text-center text-[#adaaaa] text-sm">
                    Não foram encontrados creators para essa campanha.
                  </div>
                </div>
              ) : (
                <CastingResultsDark
                  profiles={allProfiles}
                  queryTheme={themes}
                />
              )}
            </>
          )}

          {/* Panorama view */}
          {!searching && activeView === "panorama" && (
            lastSearchStats ? (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-[#131313] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Perfis analisados</div>
                    <div className="text-2xl font-bold text-white mt-1">{lastSearchStats.totalCandidates}</div>
                  </div>
                  <div className="rounded-xl bg-[#131313] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Creators encontrados</div>
                    <div className="text-2xl font-bold text-[#a2f31f] mt-1">{lastSearchStats.matched}</div>
                  </div>
                  <div className="rounded-xl bg-[#131313] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Taxa de conversão</div>
                    <div className="text-2xl font-bold text-[#ca98ff] mt-1">{lastSearchStats.totalCandidates > 0 ? Math.round((lastSearchStats.matched / lastSearchStats.totalCandidates) * 100) : 0}%</div>
                  </div>
                  <div className="rounded-xl bg-[#131313] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Creators ativos</div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {lastSearchStats.totalCandidates > 0 ? Math.round((lastSearchStats.matched / lastSearchStats.totalCandidates) * 100) : 0}%
                      <span className="text-xs font-normal text-[#adaaaa] ml-1">dos perfis</span>
                    </div>
                  </div>
                </div>

                {/* Per-keyword breakdown */}
                <div className="rounded-2xl bg-[#131313] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#262626]">
                    <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">Desempenho por Keyword</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#262626]">
                        <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Keyword</th>
                        <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Posts encontrados</th>
                        <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Perfis descobertos</th>
                        <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Creators válidos</th>
                        <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Filtrados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(lastSearchStats.keywordStats).map(([keyword, stats]) => (
                        <tr key={keyword} className="border-b border-[#262626]/50 hover:bg-[#20201f]">
                          <td className="px-4 py-2.5 text-white">{keyword}</td>
                          <td className="px-4 py-2.5 text-right text-[#adaaaa]">{stats.googleResults}</td>
                          <td className="px-4 py-2.5 text-right text-[#adaaaa]">{stats.candidates}</td>
                          <td className="px-4 py-2.5 text-right text-[#a2f31f]">{stats.matched}</td>
                          <td className="px-4 py-2.5 text-right text-[#ff946e]">{stats.filteredJob + stats.filteredRepost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#131313] overflow-hidden">
                <div className="px-6 py-12 text-center text-[#adaaaa] text-sm">
                  Realize uma busca para ver o panorama de resultados.
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
