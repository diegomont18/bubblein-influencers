"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { CastingResultsDark } from "@/components/casting/casting-results-dark";
import { CastingProfile } from "@/components/casting/casting-results";

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
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Campaigns
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [filterCampaignId, setFilterCampaignId] = useState<string | null>(null); // null = all

  // Search tabs
  const [searchTabs, setSearchTabs] = useState<SearchTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
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

  useEffect(() => {
    if (!activeTabId) return;
    const tab = searchTabs.find((t) => t.id === activeTabId);
    if (tab && !tab.loaded && !tab.id.startsWith("temp-")) {
      loadTabProfiles(tab.id);
    }
  }, [activeTabId, searchTabs]);

  // Filtered tabs by campaign
  const filteredTabs = useMemo(() => {
    if (!filterCampaignId) return searchTabs;
    return searchTabs.filter((t) => t.campaignId === filterCampaignId);
  }, [searchTabs, filterCampaignId]);

  const allProfiles = useMemo(() => {
    return filteredTabs.filter((t) => t.loaded).flatMap((t) => t.profiles);
  }, [filteredTabs]);

  const highlightSlugs = useMemo(() => {
    if (activeTabId == null) return new Set<string>();
    const tab = searchTabs.find((t) => t.id === activeTabId);
    return new Set(tab?.profiles.map((p) => p.slug) ?? []);
  }, [searchTabs, activeTabId]);

  async function handleSearch() {
    if (userCredits <= 0) { setError("Sem créditos. Compre mais para continuar buscando."); return; }
    if (!activeCampaignId) { setError("Selecione uma campanha."); return; }
    const themeLines = themes.split("\n").map((l) => l.trim()).filter(Boolean);
    if (themeLines.length === 0) { setError("Insira pelo menos uma palavra-chave."); return; }
    setError(null);
    setSearching(true);

    const tempId = `temp-${Date.now()}`;
    const newTab: SearchTab = { id: tempId, name: "Buscando...", profiles: [], loaded: true, profileCount: 0, campaignId: activeCampaignId };
    setSearchTabs((prev) => [...prev, newTab]);
    setActiveTabId(tempId);
    setFilterCampaignId(activeCampaignId);

    const lang = LANGUAGES[languageIdx];
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const maxResults = resultsCount;
    let dbListId: string | null = null;

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
      let buffer = "";
      let count = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "profile" && count < maxResults) {
              count++;
              const profile = event.data as CastingProfile;
              setSearchTabs((prev) =>
                prev.map((t) => t.id === tempId ? { ...t, profiles: [...t.profiles, profile], profileCount: t.profileCount + 1 } : t)
              );
            } else if (event.type === "done") {
              dbListId = event.data.listId ?? null;
            } else if (event.type === "error") {
              setError(event.data.message ?? "Busca falhou");
            }
          } catch { /* skip */ }
        }
      }
      if (buffer.trim()) {
        try { const event = JSON.parse(buffer); if (event.type === "done") dbListId = event.data.listId ?? null; } catch { /* ignore */ }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Busca falhou");
      }
    } finally {
      setSearching(false);
      abortControllerRef.current = null;
      if (dbListId) {
        setSearchTabs((prev) =>
          prev.map((t) => t.id === tempId ? { ...t, id: dbListId! } : t)
        );
        setActiveTabId(dbListId);
        loadPastSearches();
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

  async function handleTabRename(tabId: string, newName: string) {
    setSearchTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, name: newName } : t));
    setEditingTabId(null);
    if (!tabId.startsWith("temp-")) {
      try {
        await fetch("/api/casting/lists", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tabId, name: newName }),
        });
      } catch { /* ignore */ }
    }
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
            <label className={labelClass}>Campanha</label>
            <select
              value={activeCampaignId ?? ""}
              onChange={(e) => setActiveCampaignId(e.target.value || null)}
              className={inputClass}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
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
            <label className={labelClass}>Palavras-chave</label>
            <textarea
              rows={4}
              value={themes}
              onChange={(e) => setThemes(e.target.value)}
              placeholder={"ex: marketing digital, liderança,\ncriação de conteúdo..."}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Right: Filters */}
          <div className="lg:col-span-4 space-y-4 rounded-xl bg-[#1a1a1a] p-5">
            <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">Filtros</h3>

            <div>
              <label className={labelClass}>Idioma</label>
              <select value={languageIdx} onChange={(e) => setLanguageIdx(Number(e.target.value))} className={inputClass}>
                {LANGUAGES.map((l, i) => <option key={l.value} value={i}>{l.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Faixa de Seguidores</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={minFollowers} onChange={(e) => setMinFollowers(Number(e.target.value))} min={0} placeholder="Min" className={inputClass} />
                <input type="number" value={maxFollowers} onChange={(e) => setMaxFollowers(Number(e.target.value))} min={0} placeholder="Max" className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Resultados Desejados</label>
              <input type="number" value={resultsCount} onChange={(e) => setResultsCount(Math.min(Number(e.target.value), userCredits))} min={1} max={userCredits} className={inputClass} />
              {userCredits < 100 && resultsCount >= userCredits && (
                <a
                  href="https://wa.me/5511941238555?text=Ola!%20Tenho%20interesse%20em%20comprar%20creditos%20no%20BubbleIn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#a2f31f]/30 bg-[#a2f31f]/10 px-3 py-1.5 text-xs font-semibold text-[#a2f31f] hover:bg-[#a2f31f]/20 transition-colors font-[family-name:var(--font-lexend)]"
                >
                  <span>✦</span> Comprar mais créditos
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Search Button */}
        <div>
          {noCredits ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-[#ff946e]">Sem créditos disponíveis.</p>
              <a
                href="https://wa.me/5511941238555?text=Ola!%20Tenho%20interesse%20em%20comprar%20creditos%20no%20BubbleIn"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#a2f31f]/30 bg-[#a2f31f]/10 px-5 py-3 text-sm font-semibold text-[#a2f31f] hover:bg-[#a2f31f]/20 transition-colors font-[family-name:var(--font-lexend)]"
              >
                <span>✦</span> Comprar créditos para começar
              </a>
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

      {/* Success message */}
      {successMessage && (
        <div className="rounded-xl bg-[#a2f31f]/10 px-4 py-3 text-sm text-[#a2f31f] flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-[#a2f31f]/60 hover:text-[#a2f31f] ml-3 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Results */}
      {(filteredTabs.length > 0 || searching) && (
        <div ref={resultsRef} className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-lexend)]">
              Resultados da Busca
              <span className="ml-2 text-sm font-normal text-[#adaaaa]">{allProfiles.length} resultados</span>
            </h2>

            {/* Campaign filter */}
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
          </div>

          {/* Search Tabs */}
          {filteredTabs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filteredTabs.map((tab) => (
                <div key={tab.id} className="flex items-center">
                  {editingTabId === tab.id ? (
                    <input
                      type="text"
                      value={editingTabName}
                      onChange={(e) => setEditingTabName(e.target.value)}
                      onBlur={() => handleTabRename(tab.id, editingTabName || tab.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleTabRename(tab.id, editingTabName || tab.name);
                        if (e.key === "Escape") setEditingTabId(null);
                      }}
                      autoFocus
                      className="rounded-full bg-[#ca98ff]/20 px-3 py-1.5 text-xs text-white outline-none border border-[#ca98ff]/40 font-[family-name:var(--font-lexend)]"
                    />
                  ) : (
                    <button
                      onClick={() => setActiveTabId(tab.id)}
                      onDoubleClick={() => { setEditingTabId(tab.id); setEditingTabName(tab.name); }}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all font-[family-name:var(--font-lexend)] ${
                        activeTabId === tab.id
                          ? "bg-[#ca98ff] text-[#46007d]"
                          : "bg-[#20201f] text-[#adaaaa] hover:bg-[#262626] hover:text-white"
                      }`}
                      title="Duplo clique para renomear"
                    >
                      {tab.name}
                      <span className="ml-1.5 text-[10px] opacity-70">({tab.profileCount})</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {searching && (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-[#ca98ff] animate-pulse">
                Buscando creators no LinkedIn...
                {(() => {
                  const currentTab = searchTabs.find((t) => t.id === activeTabId);
                  return currentTab && currentTab.profiles.length > 0
                    ? ` (${currentTab.profiles.length} encontrados)`
                    : "";
                })()}
              </p>
              <button
                onClick={handleStopSearch}
                className="rounded-full bg-[#ff946e]/10 px-4 py-2 text-xs font-medium text-[#ff946e] hover:bg-[#ff946e]/20 transition-colors font-[family-name:var(--font-lexend)]"
              >
                Parar Busca
              </button>
            </div>
          )}

          <CastingResultsDark
            profiles={allProfiles}
            queryTheme={themes}
            highlightSlugs={highlightSlugs}
          />
        </div>
      )}
    </div>
  );
}
