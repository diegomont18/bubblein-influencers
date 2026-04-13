"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { CastingResultsView } from "@/components/casting/casting-results-view";
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
  const [userCredits, setUserCredits] = useState<number>(5);
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

  // Share management
  const [shares, setShares] = useState<Array<{
    id: string;
    token: string;
    label: string | null;
    campaign_id: string | null;
    campaigns: { name: string } | null;
    views_count: number;
    created_at: string;
  }>>([]);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareCreating, setShareCreating] = useState(false);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

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

  // Load shares
  const loadShares = useCallback(async () => {
    try {
      const res = await fetch("/api/shares");
      if (!res.ok) return;
      const json = await res.json();
      setShares(json.shares ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadShares(); }, [loadShares]);

  async function handleCreateShare(campaignId: string | null) {
    setShareCreating(true);
    try {
      const campaignName = campaignId
        ? campaigns.find((c) => c.id === campaignId)?.name ?? "Campanha"
        : "Todas as campanhas";
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, label: campaignName }),
      });
      if (res.ok) {
        const json = await res.json();
        setShares((prev) => [json.share, ...prev]);
      }
    } catch { /* ignore */ }
    setShareCreating(false);
  }

  async function handleRevokeShare(id: string) {
    try {
      const res = await fetch("/api/shares", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setShares((prev) => prev.filter((s) => s.id !== id));
      }
    } catch { /* ignore */ }
  }

  function copyShareUrl(id: string, token: string) {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedShareId(id);
    setTimeout(() => setCopiedShareId(null), 2000);
  }

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
      setSearchStep((prev) => Math.min(prev + 1, SEARCH_STEPS.length - 2)); // Stop at 80%, only go to 100% on actual completion
    }, 8000);

    const tempId = `temp-${Date.now()}`;
    const newTab: SearchTab = { id: tempId, name: "Buscando...", profiles: [], loaded: true, profileCount: 0, campaignId: activeCampaignId };
    setSearchTabs((prev) => [...prev, newTab]);
    setFilterCampaignId(activeCampaignId);

    const lang = LANGUAGES[languageIdx];
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const maxResults = resultsCount;
    const creditsBefore = userCredits;

    try {
      // 1. Trigger the search (returns immediately with searchId)
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

      const { searchId } = await res.json();

      // Update tab with real list ID
      setSearchTabs((prev) =>
        prev.map((t) => t.id === tempId ? { ...t, id: searchId } : t)
      );

      // 2. Poll for status every 5 seconds
      let searchComplete = false;
      while (!searchComplete && !controller.signal.aborted) {
        await new Promise((r) => setTimeout(r, 5000));
        if (controller.signal.aborted) break;

        try {
          const statusRes = await fetch(`/api/casting/search/${searchId}/status`, {
            signal: controller.signal,
          });
          if (!statusRes.ok) continue;

          const statusData = await statusRes.json();
          const { status, profiles: foundProfiles, found, requested, errorMessage } = statusData;

          // Update displayed profiles progressively
          if (foundProfiles && foundProfiles.length > 0) {
            setSearchTabs((prev) =>
              prev.map((t) => t.id === searchId ? { ...t, profiles: foundProfiles as CastingProfile[], profileCount: foundProfiles.length } : t)
            );
          }

          if (status === "complete") {
            searchComplete = true;

            // Show partial results warning if fewer results than requested
            if (found === 0) {
              setWarningMessage(
                `Nenhum creator encontrado para essas palavras-chave. Experimente: (1) adicionar sinônimos ou variações (ex: "marketing digital" → "growth marketing", "inbound marketing"), (2) ampliar a faixa de seguidores, ou (3) buscar em inglês caso o nicho tenha termos internacionais.`
              );
            } else if (found < requested) {
              setWarningMessage(
                `Encontramos ${found} de ${requested} creators solicitados. Para encontrar mais resultados, experimente: (1) adicionar sinônimos ou variações das palavras-chave (ex: "marketing digital" → "growth marketing", "inbound marketing"), (2) ampliar a faixa de seguidores, ou (3) buscar em inglês caso o nicho tenha termos internacionais.`
              );
            }

            // Refresh credits
            fetch("/api/auth/me")
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => {
                if (data?.user) {
                  const rawCredits = data.user.credits;
                  const newCredits = rawCredits === -1 ? 100 : rawCredits;
                  setUserCredits(newCredits);
                  window.dispatchEvent(new CustomEvent("credits-updated", { detail: rawCredits }));
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

            loadPastSearches();
          } else if (status === "error") {
            searchComplete = true;
            setError(errorMessage ?? "Busca falhou no servidor.");
          }
        } catch (pollErr) {
          if (pollErr instanceof DOMException && pollErr.name === "AbortError") break;
          // Polling error — retry on next interval
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Busca falhou");
      }
    } finally {
      if (stepIntervalRef.current) { clearInterval(stepIntervalRef.current); stepIntervalRef.current = null; }
      setSearchStep(0);
      setSearching(false);
      abortControllerRef.current = null;
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

          {!searching && (
            <>
              {/* Share button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowSharePanel((v) => !v)}
                  className="rounded-full bg-[#20201f] px-4 py-2 text-xs font-medium text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors font-[family-name:var(--font-lexend)] flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  Compartilhar
                </button>
              </div>

              {/* Share management panel */}
              {showSharePanel && (
                <div className="rounded-2xl bg-[#131313] border border-[#262626] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">Compartilhamento</h3>
                    <button onClick={() => setShowSharePanel(false)} className="text-[#adaaaa] hover:text-white text-lg leading-none">&times;</button>
                  </div>

                  {/* Create share */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-[#adaaaa] font-[family-name:var(--font-lexend)]">Criar link para:</span>
                    <button
                      onClick={() => handleCreateShare(null)}
                      disabled={shareCreating}
                      className="rounded-full bg-[#ca98ff]/10 px-3 py-1.5 text-xs font-medium text-[#ca98ff] hover:bg-[#ca98ff]/20 transition-colors font-[family-name:var(--font-lexend)] disabled:opacity-50"
                    >
                      Todas as campanhas
                    </button>
                    {campaigns.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleCreateShare(c.id)}
                        disabled={shareCreating}
                        className="rounded-full bg-[#20201f] px-3 py-1.5 text-xs font-medium text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors font-[family-name:var(--font-lexend)] disabled:opacity-50"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>

                  {/* Active shares */}
                  {shares.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Links ativos</div>
                      {shares.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{s.label || (s.campaigns?.name ?? "Todas as campanhas")}</div>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-[#adaaaa]">
                              <span>{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
                              <span>·</span>
                              <span>{s.views_count} {s.views_count === 1 ? "visualização" : "visualizações"}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => copyShareUrl(s.id, s.token)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors font-[family-name:var(--font-lexend)] whitespace-nowrap ${
                              copiedShareId === s.id
                                ? "bg-[#a2f31f]/10 text-[#a2f31f]"
                                : "bg-[#ca98ff]/10 text-[#ca98ff] hover:bg-[#ca98ff]/20"
                            }`}
                          >
                            {copiedShareId === s.id ? "Link copiado!" : "Copiar link"}
                          </button>
                          <button
                            onClick={() => handleRevokeShare(s.id)}
                            className="rounded-full bg-[#ff946e]/10 px-3 py-1.5 text-xs font-medium text-[#ff946e] hover:bg-[#ff946e]/20 transition-colors font-[family-name:var(--font-lexend)] whitespace-nowrap"
                          >
                            Revogar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <CastingResultsView
                profiles={allProfiles}
                campaigns={campaigns}
                filterCampaignId={filterCampaignId}
                onFilterCampaignChange={setFilterCampaignId}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
