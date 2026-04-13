"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

interface Lead {
  slug: string;
  name: string;
  headline: string;
  job_title: string;
  company: string;
  location: string;
  followers: number;
  linkedin_url: string;
  profile_photo: string;
  icp_score: number;
  matched_titles: string[];
  matched_departments: string[];
  company_size_match: boolean;
  engagement_type: "reaction" | "comment" | "both";
  source_post_url: string;
  role_level?: "decisor" | "influenciador" | "observador";
}

interface ProfilePost {
  id: number;
  url: string;
  text: string;
  reactions: number;
  comments: number;
  date: string;
}

interface IcpProfile {
  id: string;
  name: string;
  job_titles: string[];
  departments: string[];
  company_sizes: string[];
  created_at: string;
}

interface UrlProfile {
  id: string;
  name: string;
  post_urls: string[];
  created_at: string;
}

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001+"];

const SCAN_STEPS = [
  "Coletando engajamentos dos posts...",
  "Identificando perfis que interagiram...",
  "Analisando perfis no LinkedIn...",
  "Calculando match com ICP...",
  "Finalizando resultados...",
];

export default function LeadsPage() {
  // ICP profiles
  const [icpProfiles, setIcpProfiles] = useState<IcpProfile[]>([]);
  const [activeIcpId, setActiveIcpId] = useState<string | null>(null);
  const [editingIcpName, setEditingIcpName] = useState<string | null>(null);

  // URL profiles
  const [urlProfiles, setUrlProfiles] = useState<UrlProfile[]>([]);
  const [activeUrlId, setActiveUrlId] = useState<string | null>(null);
  const [editingUrlName, setEditingUrlName] = useState<string | null>(null);

  // ICP form fields
  const [icpJobTitles, setIcpJobTitles] = useState("");
  const [icpDepartments, setIcpDepartments] = useState("");
  const [icpCompanySizes, setIcpCompanySizes] = useState<string[]>(["51-200"]);

  // URL form
  const [postUrls, setPostUrls] = useState("");
  const [userCredits, setUserCredits] = useState<number>(5);
  const [inputMode, setInputMode] = useState<"posts" | "profile">("posts");
  const [profileUrl, setProfileUrl] = useState("");
  const [profilePosts, setProfilePosts] = useState<ProfilePost[]>([]);
  const [selectedProfilePosts, setSelectedProfilePosts] = useState<Set<number>>(new Set());
  const [loadingProfilePosts, setLoadingProfilePosts] = useState(false);

  // Post-centric view
  const [selectedPostUrl, setSelectedPostUrl] = useState<string>("__all__");
  const [filterRoleLevel, setFilterRoleLevel] = useState<string>("all");
  const [postTextMap, setPostTextMap] = useState<Record<string, string>>({});

  // Page loading state
  const [pageLoading, setPageLoading] = useState(true);

  // Past scans
  const [pastScans, setPastScans] = useState<Array<{ id: string; created_at: string; post_urls: string[]; matched_leads: number; status: string; leads: Lead[] }>>([]);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const inputClass = "w-full rounded-xl bg-[#20201f] px-4 py-3 text-sm text-white placeholder-white/30 outline-none border-b-2 border-transparent focus:border-[#ca98ff] transition-colors";
  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2 font-[family-name:var(--font-lexend)]";

  // --- Load ICP profiles ---
  const loadIcpProfiles = useCallback(async () => {
    const res = await fetch("/api/leads/icp-profiles");
    if (!res.ok) return;
    const json = await res.json();
    const list = json.icpProfiles as IcpProfile[];
    setIcpProfiles(list);

    if (list.length === 0) {
      // Auto-create "ICP 1"
      const createRes = await fetch("/api/leads/icp-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "ICP 1", job_titles: [], departments: [], company_sizes: ["51-200"] }),
      });
      if (createRes.ok) {
        const data = await createRes.json();
        setIcpProfiles([data.icpProfile]);
        setActiveIcpId(data.icpProfile.id);
        loadIcpFields(data.icpProfile);
      }
    } else if (!activeIcpId || !list.find((p) => p.id === activeIcpId)) {
      setActiveIcpId(list[0].id);
      loadIcpFields(list[0]);
    }
  }, [activeIcpId]);

  function loadIcpFields(profile: IcpProfile) {
    setIcpJobTitles((profile.job_titles ?? []).join(", "));
    setIcpDepartments((profile.departments ?? []).join(", "));
    setIcpCompanySizes(profile.company_sizes?.length > 0 ? profile.company_sizes : ["51-200"]);
  }

  // --- Load URL profiles ---
  const loadUrlProfiles = useCallback(async () => {
    const res = await fetch("/api/leads/url-profiles");
    if (!res.ok) return;
    const json = await res.json();
    const list = json.urlProfiles as UrlProfile[];
    setUrlProfiles(list);

    if (list.length === 0) {
      const createRes = await fetch("/api/leads/url-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Profiles 1", post_urls: [] }),
      });
      if (createRes.ok) {
        const data = await createRes.json();
        setUrlProfiles([data.urlProfile]);
        setActiveUrlId(data.urlProfile.id);
      }
    } else if (!activeUrlId || !list.find((p) => p.id === activeUrlId)) {
      setActiveUrlId(list[0].id);
      setPostUrls((list[0].post_urls ?? []).join("\n"));
    }
  }, [activeUrlId]);

  // --- Load past scans ---
  const loadPastScans = useCallback(async () => {
    const res = await fetch("/api/leads/scans");
    if (!res.ok) return;
    const json = await res.json();
    const scans = json.scans ?? [];
    setPastScans(scans);
    // If we have past scans and no active scan, load the most recent one
    if (scans.length > 0 && !activeScanId && leads.length === 0) {
      const latest = scans[0];
      setActiveScanId(latest.id);
      setLeads((latest.leads ?? []).filter((l: Lead) => l.name && l.name !== "Unknown" && l.name.length >= 2));
    }
  }, [activeScanId, leads.length]);

  useEffect(() => {
    Promise.all([loadIcpProfiles(), loadUrlProfiles(), loadPastScans()]).finally(() => setPageLoading(false));
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.user) {
        const c = d.user.credits === -1 ? Infinity : d.user.credits;
        setUserCredits(c);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- ICP profile actions ---
  function handleSelectIcp(id: string) {
    setActiveIcpId(id);
    const profile = icpProfiles.find((p) => p.id === id);
    if (profile) loadIcpFields(profile);
  }

  async function handleCreateIcp() {
    const existingNumbers = icpProfiles.map((p) => { const m = p.name.match(/^ICP (\d+)$/); return m ? parseInt(m[1]) : 0; });
    const nextNum = Math.max(0, ...existingNumbers) + 1;
    const name = `ICP ${nextNum}`;
    const res = await fetch("/api/leads/icp-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, job_titles: [], departments: [], company_sizes: ["51-200"] }),
    });
    if (res.ok) {
      const data = await res.json();
      setIcpProfiles((prev) => [...prev, data.icpProfile]);
      setActiveIcpId(data.icpProfile.id);
      loadIcpFields(data.icpProfile);
    }
  }

  async function handleSaveIcp() {
    if (!activeIcpId) return;
    const titles = icpJobTitles.split(",").map((t) => t.trim()).filter(Boolean);
    const depts = icpDepartments.split(",").map((d) => d.trim()).filter(Boolean);
    await fetch("/api/leads/icp-profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeIcpId, job_titles: titles, departments: depts, company_sizes: icpCompanySizes }),
    });
    setIcpProfiles((prev) =>
      prev.map((p) => p.id === activeIcpId ? { ...p, job_titles: titles, departments: depts, company_sizes: icpCompanySizes } : p)
    );
    setSuccessMessage("ICP salvo com sucesso.");
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  async function handleRenameIcp(newName: string) {
    if (!activeIcpId || !newName.trim()) { setEditingIcpName(null); return; }
    await fetch("/api/leads/icp-profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeIcpId, name: newName.trim() }),
    });
    setIcpProfiles((prev) => prev.map((p) => p.id === activeIcpId ? { ...p, name: newName.trim() } : p));
    setEditingIcpName(null);
  }

  // --- URL profile actions ---
  function handleSelectUrl(id: string) {
    setActiveUrlId(id);
    const profile = urlProfiles.find((p) => p.id === id);
    if (profile) setPostUrls((profile.post_urls ?? []).join("\n"));
  }

  async function handleCreateUrl() {
    const existingNumbers = urlProfiles.map((p) => { const m = p.name.match(/^Profiles (\d+)$/); return m ? parseInt(m[1]) : 0; });
    const nextNum = Math.max(0, ...existingNumbers) + 1;
    const name = `Profiles ${nextNum}`;
    const res = await fetch("/api/leads/url-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, post_urls: [] }),
    });
    if (res.ok) {
      const data = await res.json();
      setUrlProfiles((prev) => [...prev, data.urlProfile]);
      setActiveUrlId(data.urlProfile.id);
      setPostUrls("");
    }
  }

  async function handleSaveUrl() {
    if (!activeUrlId) return;
    const urls = postUrls.split("\n").map((u) => u.trim()).filter(Boolean);
    await fetch("/api/leads/url-profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeUrlId, post_urls: urls }),
    });
    setUrlProfiles((prev) =>
      prev.map((p) => p.id === activeUrlId ? { ...p, post_urls: urls } : p)
    );
    setSuccessMessage("URLs salvas com sucesso.");
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  async function handleRenameUrl(newName: string) {
    if (!activeUrlId || !newName.trim()) { setEditingUrlName(null); return; }
    await fetch("/api/leads/url-profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeUrlId, name: newName.trim() }),
    });
    setUrlProfiles((prev) => prev.map((p) => p.id === activeUrlId ? { ...p, name: newName.trim() } : p));
    setEditingUrlName(null);
  }

  // --- Company size toggle ---
  function toggleCompanySize(size: string) {
    setIcpCompanySizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  }

  // --- Select past scan ---
  function handleSelectScan(scanId: string) {
    const scan = pastScans.find((s) => s.id === scanId);
    if (scan) {
      setActiveScanId(scanId);
      setLeads((scan.leads ?? []).filter((l: Lead) => l.name && l.name !== "Unknown" && l.name.length >= 2));
      setFilterIcpLevel("all");
      setFilterEngagement("all");
      setFilterPostUrl("all");
      setFilterRoleLevel("all");
      setSelectedPostUrl("__all__");
      setExpandedSourceRow(null);
    }
  }

  // --- Filters ---
  const [filterIcpLevel, setFilterIcpLevel] = useState<string>("all");
  const [filterEngagement, setFilterEngagement] = useState<string>("all");
  const [filterPostUrl, setFilterPostUrl] = useState<string>("all");
  const [expandedSourceRow, setExpandedSourceRow] = useState<string | null>(null);
  const [expandedHeadlineRow, setExpandedHeadlineRow] = useState<string | null>(null);

  // --- Scan (background + polling) ---
  async function handleScan() {
    const urls = postUrls.split("\n").map((l) => l.trim()).filter(Boolean);
    if (urls.length === 0) { setError("Insira pelo menos uma URL de post."); return; }
    if (userCredits !== Infinity) {
      const maxPosts = Math.floor(userCredits / 15);
      if (maxPosts === 0) { setError("Créditos insuficientes. São necessários pelo menos 15 créditos por link de post."); return; }
      if (urls.length > maxPosts) { setError(`Você pode analisar no máximo ${maxPosts} post(s) com seus ${userCredits} créditos (15 créditos por link).`); return; }
    }
    const titles = icpJobTitles.split(",").map((t) => t.trim()).filter(Boolean);
    const depts = icpDepartments.split(",").map((d) => d.trim()).filter(Boolean);

    setError(null);
    setSuccessMessage(null);
    setScanning(true);
    setScanStep(0);
    setLeads([]);
    setSelectedPostUrl("__all__");
    stepIntervalRef.current = setInterval(() => {
      setScanStep((prev) => Math.min(prev + 1, SCAN_STEPS.length - 2)); // Stop at 80%, only go to 100% on actual completion
    }, 8000);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1. Trigger the scan (returns immediately with scanId)
      const res = await fetch("/api/leads/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postUrls: urls,
          icpJobTitles: titles,
          icpDepartments: depts,
          icpCompanySizes,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Erro (${res.status})`);
      }

      const { scanId } = await res.json();
      setActiveScanId(scanId);

      // 2. Poll for status every 5 seconds
      let scanComplete = false;
      while (!scanComplete && !controller.signal.aborted) {
        await new Promise((r) => setTimeout(r, 5000));
        if (controller.signal.aborted) break;

        try {
          const statusRes = await fetch(`/api/leads/scan/${scanId}/status`, {
            signal: controller.signal,
          });
          if (!statusRes.ok) continue;

          const statusData = await statusRes.json();
          const { status, leads: foundLeads, found, totalEngagers, postsAnalyzed, errorMessage } = statusData;

          // Update displayed leads progressively (filter out Unknown)
          if (foundLeads && foundLeads.length > 0) {
            setLeads((foundLeads as Lead[]).filter((l: Lead) => l.name && l.name !== "Unknown" && l.name.length >= 2));
          }

          if (status === "complete") {
            scanComplete = true;
            if (found === 0 && totalEngagers === 0) {
              setError(`Nenhum engajador encontrado nos ${postsAnalyzed} posts analisados. Verifique se as URLs dos posts estao corretas e se os posts possuem curtidas/comentarios.`);
            } else {
              setSuccessMessage(`Encontramos ${found} leads de ${totalEngagers} engajadores analisados em ${postsAnalyzed} posts.`);
            }
            // Refresh credits and reload past scans
            window.dispatchEvent(new CustomEvent("credits-updated", { detail: null }));
            fetch("/api/auth/me")
              .then((r) => r.ok ? r.json() : null)
              .then((d) => {
                if (d?.user) {
                  window.dispatchEvent(new CustomEvent("credits-updated", { detail: d.user.credits }));
                  setUserCredits(d.user.credits === -1 ? Infinity : d.user.credits);
                }
              })
              .catch(() => {});
            loadPastScans();
          } else if (status === "error") {
            scanComplete = true;
            setError(errorMessage ?? "Erro durante a busca no servidor.");
          }
        } catch (pollErr) {
          if (pollErr instanceof DOMException && pollErr.name === "AbortError") break;
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Erro na busca");
      }
    } finally {
      if (stepIntervalRef.current) { clearInterval(stepIntervalRef.current); stepIntervalRef.current = null; }
      setScanStep(0);
      setScanning(false);
      abortRef.current = null;
    }
  }

  function exportCsv() {
    const headers = ["Nome", "LinkedIn URL", "Cargo", "Especialidades", "Empresa", "ICP Score", "ICP Nivel", "Titulos Match", "Departamentos Match", "Tipo Engajamento", "Post URL"];
    const escape = (v: string) => v.includes(",") || v.includes('"') || v.includes("\n") ? '"' + v.replace(/"/g, '""') + '"' : v;
    const rows = filteredLeads.map((l) => [
      l.name, l.linkedin_url, l.job_title ?? "", l.headline ?? "", l.company,
      String(l.icp_score), icpLabel(l.icp_score).text,
      (l.matched_titles ?? []).join("; "), (l.matched_departments ?? []).join("; "),
      l.engagement_type, l.source_post_url,
    ].map(escape));
    const csv = [headers.map(escape).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function icpLabel(score: number) {
    if (score >= 70) return { text: "Alto", cls: "bg-[#a2f31f]/10 text-[#a2f31f]" };
    if (score >= 40) return { text: "Medio", cls: "bg-[#ff946e]/10 text-[#ff946e]" };
    return { text: "Baixo", cls: "bg-white/5 text-[#adaaaa]" };
  }

  const activeIcp = icpProfiles.find((p) => p.id === activeIcpId);
  const activeUrl = urlProfiles.find((p) => p.id === activeUrlId);

  // Filtered leads — always exclude Unknown/empty names
  const filteredLeads = leads.filter((l) => {
    if (!l.name || l.name === "Unknown" || l.name.length < 2) return false;
    if (filterIcpLevel !== "all") {
      const label = icpLabel(l.icp_score).text;
      if (label !== filterIcpLevel) return false;
    }
    if (filterEngagement !== "all" && l.engagement_type !== filterEngagement) return false;
    if (filterPostUrl !== "all" && l.source_post_url !== filterPostUrl) return false;
    if (filterRoleLevel !== "all" && l.role_level !== filterRoleLevel) return false;
    if (selectedPostUrl && selectedPostUrl !== "__all__" && l.source_post_url !== selectedPostUrl) return false;
    return true;
  });

  // Unique post URLs for filter dropdown
  const uniquePostUrls = Array.from(new Set(leads.map((l) => l.source_post_url).filter(Boolean)));

  // Post stats with RER
  const postStats = useMemo(() => {
    const validLeads = leads.filter((l) => l.name && l.name !== "Unknown" && l.name.length >= 2);
    const stats = new Map<string, { total: number; decisor: number; influenciador: number; observador: number; rer: number }>();
    for (const lead of validLeads) {
      const url = lead.source_post_url;
      if (!url) continue;
      const s = stats.get(url) || { total: 0, decisor: 0, influenciador: 0, observador: 0, rer: 0 };
      s.total++;
      if (lead.role_level === "decisor") s.decisor++;
      else if (lead.role_level === "influenciador") s.influenciador++;
      else s.observador++;
      stats.set(url, s);
    }
    Array.from(stats.entries()).forEach(([url, s]) => {
      s.rer = s.total > 0 ? Math.round((s.decisor / s.total) * 100) : 0;
      stats.set(url, s);
    });
    return stats;
  }, [leads]);

  // Extract short label from post URL (username or slug)
  function shortPostLabel(url: string): string {
    if (!url) return "—";
    // /posts/username_title-activity-... → @username
    const postsMatch = url.match(/\/posts\/([^_/?#]+)/);
    if (postsMatch) return `@${postsMatch[1]}`;
    // /feed/update/urn:li:share:... → Post #last6digits
    const shareMatch = url.match(/urn:li:(?:share|activity):(\d+)/);
    if (shareMatch) return `Post #${shareMatch[1].slice(-6)}`;
    // /in/username → @username
    const inMatch = url.match(/\/in\/([^/?#]+)/);
    if (inMatch) return `@${inMatch[1]}`;
    return url.slice(-30);
  }

  async function handleFetchProfilePosts() {
    if (!profileUrl.trim()) return;
    setLoadingProfilePosts(true);
    setProfilePosts([]);
    setSelectedProfilePosts(new Set());
    try {
      const res = await fetch("/api/leads/profile-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrl: profileUrl.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfilePosts(data.posts ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoadingProfilePosts(false); }
  }

  function handleScanSelectedPosts() {
    const selected = profilePosts.filter((p) => selectedProfilePosts.has(p.id));
    if (selected.length === 0) return;
    const urls = selected.map((p) => p.url);
    // Save post text for display in post cards
    const textMap: Record<string, string> = {};
    for (const p of selected) {
      textMap[p.url] = p.text;
    }
    setPostTextMap((prev) => ({ ...prev, ...textMap }));
    setPostUrls(urls.join("\n"));
    setInputMode("posts");
    setProfilePosts([]);
    setSelectedProfilePosts(new Set());
  }

  function roleLevelLabel(level?: string) {
    if (level === "decisor") return { text: "Decisor", cls: "bg-[#ca98ff]/10 text-[#ca98ff]" };
    if (level === "influenciador") return { text: "Influenciador", cls: "bg-[#5b9bff]/10 text-[#5b9bff]" };
    return { text: "Observador", cls: "bg-white/5 text-[#adaaaa]" };
  }

  if (pageLoading) {
    return (
      <div className="space-y-8 cursor-wait">
        <div className="relative">
          <h1 className="text-4xl font-extrabold text-white tracking-tight font-[family-name:var(--font-lexend)]">
            Leads
          </h1>
          <p className="mt-2 text-[#adaaaa] max-w-xl font-[family-name:var(--font-be-vietnam-pro)]">
            Encontre leads qualificados a partir de quem engajou com posts no LinkedIn.
          </p>
        </div>
        <div className="rounded-2xl bg-[#131313] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-4 w-48 bg-[#20201f] rounded animate-pulse" />
            <div className="ml-auto h-7 w-24 bg-[#20201f] rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-24 bg-[#20201f] rounded-xl animate-pulse" />
            <div className="h-24 bg-[#20201f] rounded-xl animate-pulse" />
            <div className="h-24 bg-[#20201f] rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="rounded-2xl bg-[#131313] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-4 w-56 bg-[#20201f] rounded animate-pulse" />
            <div className="ml-auto h-7 w-24 bg-[#20201f] rounded-lg animate-pulse" />
          </div>
          <div className="h-28 bg-[#20201f] rounded-xl animate-pulse" />
        </div>
        <div className="h-12 bg-[#20201f] rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative">
        <h1 className="text-4xl font-extrabold text-white tracking-tight font-[family-name:var(--font-lexend)]">
          Leads
        </h1>
        <p className="mt-2 text-[#adaaaa] max-w-xl font-[family-name:var(--font-be-vietnam-pro)]">
          Encontre leads qualificados a partir de quem engajou com posts no LinkedIn. Defina seu ICP e cole as URLs dos posts.
        </p>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ca98ff]/5 rounded-full blur-[80px] pointer-events-none" />
      </div>

      {/* ICP Section */}
      <div className="rounded-2xl bg-[#131313] p-6 space-y-5">
        {/* ICP profile selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">Perfil Ideal de Cliente (ICP)</h3>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={activeIcpId ?? ""}
              onChange={(e) => handleSelectIcp(e.target.value)}
              className="rounded-lg bg-[#20201f] px-3 py-1.5 text-xs text-white outline-none border border-[#333] focus:border-[#ca98ff] transition-colors font-[family-name:var(--font-lexend)]"
            >
              {icpProfiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={handleCreateIcp}
              className="rounded-lg bg-[#20201f] px-2.5 py-1.5 text-xs text-[#ca98ff] hover:bg-[#262626] transition-colors font-bold"
              title="Criar novo ICP"
            >
              +
            </button>
            {activeIcp && (
              editingIcpName !== null ? (
                <input
                  autoFocus
                  defaultValue={activeIcp.name}
                  className="rounded-lg bg-[#20201f] px-2 py-1 text-xs text-white outline-none border border-[#ca98ff] w-24"
                  onBlur={(e) => handleRenameIcp(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRenameIcp((e.target as HTMLInputElement).value); if (e.key === "Escape") setEditingIcpName(null); }}
                />
              ) : (
                <button
                  onClick={() => setEditingIcpName(activeIcp.name)}
                  className="text-[10px] text-[#adaaaa] hover:text-[#ca98ff] transition-colors"
                  title="Renomear"
                >
                  Renomear
                </button>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Cargos</label>
            <textarea
              rows={3}
              value={icpJobTitles}
              onChange={(e) => setIcpJobTitles(e.target.value)}
              placeholder="CEO, CTO, VP Marketing..."
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1 text-[10px] text-[#adaaaa]/60">Separe por virgula</p>
          </div>
          <div>
            <label className={labelClass}>Departamentos</label>
            <textarea
              rows={3}
              value={icpDepartments}
              onChange={(e) => setIcpDepartments(e.target.value)}
              placeholder="Marketing, Sales, Engineering..."
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1 text-[10px] text-[#adaaaa]/60">Separe por virgula</p>
          </div>
          <div>
            <label className={labelClass}>Tamanho da Empresa</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COMPANY_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => toggleCompanySize(size)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    icpCompanySizes.includes(size)
                      ? "bg-[#ca98ff]/20 text-[#ca98ff] border border-[#ca98ff]"
                      : "bg-[#20201f] text-[#adaaaa] border border-transparent hover:border-[#333]"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-[#adaaaa]/60">Selecione um ou mais</p>
          </div>
        </div>

        <button
          onClick={handleSaveIcp}
          className="rounded-full bg-[#20201f] px-5 py-2 text-xs font-semibold text-[#ca98ff] hover:bg-[#262626] transition-colors font-[family-name:var(--font-lexend)]"
        >
          Salvar ICP
        </button>
      </div>

      {/* URL Profiles Section */}
      <div className="rounded-2xl bg-[#131313] p-6 space-y-5">
        {/* Mode toggle + URL profile selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-full bg-[#20201f] p-0.5 mr-2">
            <button
              onClick={() => setInputMode("posts")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all font-[family-name:var(--font-lexend)] ${inputMode === "posts" ? "bg-[#ca98ff] text-[#46007d]" : "text-[#adaaaa] hover:text-white"}`}
            >
              Posts
            </button>
            <button
              onClick={() => setInputMode("profile")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all font-[family-name:var(--font-lexend)] ${inputMode === "profile" ? "bg-[#ca98ff] text-[#46007d]" : "text-[#adaaaa] hover:text-white"}`}
            >
              Perfil
            </button>
          </div>
          <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">
            {inputMode === "posts" ? "URLs dos Posts do LinkedIn" : "Perfil do LinkedIn"}
          </h3>
          {inputMode === "posts" && (
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={activeUrlId ?? ""}
                onChange={(e) => handleSelectUrl(e.target.value)}
                className="rounded-lg bg-[#20201f] px-3 py-1.5 text-xs text-white outline-none border border-[#333] focus:border-[#ca98ff] transition-colors font-[family-name:var(--font-lexend)]"
              >
                {urlProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={handleCreateUrl}
                className="rounded-lg bg-[#20201f] px-2.5 py-1.5 text-xs text-[#ca98ff] hover:bg-[#262626] transition-colors font-bold"
                title="Criar novo perfil de URLs"
              >
                +
              </button>
              {activeUrl && (
                editingUrlName !== null ? (
                  <input
                    autoFocus
                    defaultValue={activeUrl.name}
                    className="rounded-lg bg-[#20201f] px-2 py-1 text-xs text-white outline-none border border-[#ca98ff] w-24"
                    onBlur={(e) => handleRenameUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRenameUrl((e.target as HTMLInputElement).value); if (e.key === "Escape") setEditingUrlName(null); }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingUrlName(activeUrl.name)}
                    className="text-[10px] text-[#adaaaa] hover:text-[#ca98ff] transition-colors"
                    title="Renomear"
                  >
                    Renomear
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {inputMode === "posts" ? (
          <>
            <div>
              <textarea
                rows={4}
                value={postUrls}
                onChange={(e) => setPostUrls(e.target.value)}
                placeholder={"https://linkedin.com/posts/...\nhttps://linkedin.com/posts/..."}
                className={`${inputClass} resize-none`}
              />
              <p className="mt-1 text-[10px] text-[#adaaaa]/60">
                Cole uma URL por linha. Cada post sera escaneado para encontrar quem curtiu e comentou.
                {userCredits !== Infinity && (
                  <span className="ml-1 text-[#ca98ff]">
                    Você pode analisar até {Math.floor(userCredits / 15)} post(s) com {userCredits} créditos (15 créditos/link).
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleSaveUrl}
              className="rounded-full bg-[#20201f] px-5 py-2 text-xs font-semibold text-[#ca98ff] hover:bg-[#262626] transition-colors font-[family-name:var(--font-lexend)]"
            >
              Salvar URLs
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-3">
              <input
                type="text"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://linkedin.com/in/nome-do-perfil"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={handleFetchProfilePosts}
                disabled={loadingProfilePosts || !profileUrl.trim()}
                className="rounded-full bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] px-5 py-2 text-xs font-semibold text-[#46007d] hover:opacity-90 disabled:opacity-50 transition-all font-[family-name:var(--font-lexend)] whitespace-nowrap"
              >
                {loadingProfilePosts ? "Buscando..." : "Buscar posts"}
              </button>
            </div>
            <p className="text-[10px] text-[#adaaaa]/60">Cole o link do perfil do LinkedIn para ver seus posts recentes.</p>

            {profilePosts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#adaaaa] font-[family-name:var(--font-lexend)]">{profilePosts.length} posts encontrados</span>
                  <button
                    onClick={handleScanSelectedPosts}
                    disabled={selectedProfilePosts.size === 0}
                    className="rounded-full bg-[#ca98ff]/10 px-3 py-1.5 text-xs font-medium text-[#ca98ff] hover:bg-[#ca98ff]/20 disabled:opacity-50 transition-colors font-[family-name:var(--font-lexend)]"
                  >
                    Escanear {selectedProfilePosts.size} post(s) selecionado(s)
                  </button>
                </div>
                {profilePosts.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-start gap-3 rounded-xl p-3 cursor-pointer transition-colors ${selectedProfilePosts.has(p.id) ? "bg-[#ca98ff]/5 border border-[#ca98ff]/30" : "bg-[#1a1a1a] border border-[#262626] hover:border-[#333]"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProfilePosts.has(p.id)}
                      onChange={() => {
                        setSelectedProfilePosts((prev) => {
                          const next = new Set(prev);
                          if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                          return next;
                        });
                      }}
                      className="mt-1 rounded bg-[#20201f] border-[#484847] text-[#ca98ff] focus:ring-[#ca98ff]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white line-clamp-2">{p.text || "Post sem texto"}</p>
                      <div className="flex gap-3 mt-1 text-[10px] text-[#adaaaa]">
                        <span>{p.reactions} reactions</span>
                        <span>{p.comments} comments</span>
                        {p.date && <span>{p.date}</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Scan button — only show in posts mode or when scanning */}
      {(inputMode === "posts" || scanning) && (
        <button
          onClick={handleScan}
          disabled={scanning}
          className="w-full rounded-full bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] px-6 py-3.5 text-sm font-semibold text-[#46007d] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all font-[family-name:var(--font-lexend)]"
        >
          {scanning ? "Escaneando..." : "Escanear Posts"}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-[#ff946e]/10 px-4 py-3 text-sm text-[#ff946e]">{error}</div>
      )}

      {/* Success */}
      {successMessage && (
        <div className="rounded-xl bg-[#a2f31f]/10 px-4 py-3 text-sm text-[#a2f31f] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>{successMessage}</span>
            {leads.length > 0 && (
              <button
                onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-full bg-[#a2f31f]/20 px-3 py-1 text-xs font-semibold text-[#a2f31f] hover:bg-[#a2f31f]/30 transition-colors whitespace-nowrap font-[family-name:var(--font-lexend)]"
              >
                &#8595; Ver resultados
              </button>
            )}
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-[#a2f31f]/60 hover:text-[#a2f31f] ml-3 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Progress steps */}
      {scanning && (
        <div className="rounded-2xl bg-[#131313] p-6 space-y-4">
          <div className="space-y-3">
            {SCAN_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3 transition-all duration-300">
                {i < scanStep ? (
                  <span className="text-[#a2f31f] text-sm">&#10003;</span>
                ) : i === scanStep ? (
                  <span className="animate-pulse text-[#ca98ff] text-sm">&#9679;</span>
                ) : (
                  <span className="text-[#adaaaa]/30 text-sm">&#9675;</span>
                )}
                <span className={`text-sm transition-colors duration-300 ${i <= scanStep ? "text-white" : "text-[#adaaaa]/30"}`}>
                  {step}
                </span>
              </div>
            ))}
          </div>
          <div className="text-center pt-2">
            <button
              onClick={() => abortRef.current?.abort()}
              className="rounded-full bg-[#ff946e]/10 px-4 py-2 text-xs font-medium text-[#ff946e] hover:bg-[#ff946e]/20 transition-colors font-[family-name:var(--font-lexend)]"
            >
              Parar Busca
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {(leads.length > 0 || pastScans.length > 0) && (
        <div ref={resultsRef} className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-lexend)]">
                Leads Encontrados
                <span className="ml-2 text-sm font-normal text-[#adaaaa]">{filteredLeads.length}{filteredLeads.length !== leads.length ? ` de ${leads.length}` : ""} leads</span>
                {scanning && <span className="ml-2 text-xs text-[#ca98ff] animate-pulse">(atualizando...)</span>}
              </h2>
              {pastScans.length > 0 && (
                <select
                  value={activeScanId ?? ""}
                  onChange={(e) => handleSelectScan(e.target.value)}
                  className="rounded-lg bg-[#20201f] px-3 py-1.5 text-xs text-white outline-none border border-[#333] focus:border-[#ca98ff] font-[family-name:var(--font-lexend)]"
                >
                  {pastScans.map((s) => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.created_at).toLocaleDateString("pt-BR")} {new Date(s.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — {s.matched_leads ?? 0} leads
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              onClick={exportCsv}
              className="rounded-full bg-[#20201f] px-4 py-2 text-xs font-medium text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors font-[family-name:var(--font-lexend)]"
            >
              Exportar CSV
            </button>
          </div>

          {/* Post cards — horizontal scrollable, always visible */}
          {uniquePostUrls.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {/* Ver todos card */}
              {(() => {
                const allTotal = Array.from(postStats.values()).reduce((a, s) => a + s.total, 0);
                const allDecisor = Array.from(postStats.values()).reduce((a, s) => a + s.decisor, 0);
                const allInfluen = Array.from(postStats.values()).reduce((a, s) => a + s.influenciador, 0);
                const allObserv = Array.from(postStats.values()).reduce((a, s) => a + s.observador, 0);
                const allRer = allTotal > 0 ? Math.round((allDecisor / allTotal) * 100) : 0;
                const isActive = selectedPostUrl === "__all__";
                return (
                  <button
                    onClick={() => setSelectedPostUrl("__all__")}
                    className={`min-w-[200px] shrink-0 rounded-xl p-4 text-left transition-colors ${isActive ? "bg-[#ca98ff]/10 border-2 border-[#ca98ff]" : "bg-[#131313] border border-[#262626] hover:border-[#ca98ff]/30"}`}
                  >
                    <p className="text-xs text-[#ca98ff] font-medium mb-1">Todos</p>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-xl font-bold text-white">{allRer}%</span>
                      <span className="text-[10px] text-[#adaaaa] uppercase tracking-wider">RER</span>
                    </div>
                    <div className="flex gap-1.5 text-[10px] flex-wrap">
                      <span className="rounded-full bg-[#ca98ff]/10 text-[#ca98ff] px-1.5 py-0.5">{allDecisor} dec.</span>
                      <span className="rounded-full bg-[#5b9bff]/10 text-[#5b9bff] px-1.5 py-0.5">{allInfluen} inf.</span>
                      <span className="rounded-full bg-white/5 text-[#adaaaa] px-1.5 py-0.5">{allObserv} obs.</span>
                    </div>
                    <p className="text-[10px] text-[#adaaaa] mt-1.5">{allTotal} engajamentos</p>
                  </button>
                );
              })()}
              {/* Individual post cards */}
              {uniquePostUrls.map((url) => {
                const s = postStats.get(url);
                if (!s) return null;
                const isActive = selectedPostUrl === url;
                return (
                  <button
                    key={url}
                    onClick={() => setSelectedPostUrl(url)}
                    className={`min-w-[200px] shrink-0 rounded-xl p-4 text-left transition-colors ${isActive ? "bg-[#ca98ff]/10 border-2 border-[#ca98ff]" : "bg-[#131313] border border-[#262626] hover:border-[#ca98ff]/30"}`}
                  >
                    <p className="text-xs text-[#ca98ff] font-medium mb-1">{shortPostLabel(url)}</p>
                    {postTextMap[url] && (
                      <p className="text-[10px] text-[#adaaaa] truncate mb-1">{postTextMap[url].slice(0, 40)}{postTextMap[url].length > 40 ? "..." : ""}</p>
                    )}
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-xl font-bold text-white">{s.rer}%</span>
                      <span className="text-[10px] text-[#adaaaa] uppercase tracking-wider">RER</span>
                    </div>
                    <div className="flex gap-1.5 text-[10px] flex-wrap">
                      <span className="rounded-full bg-[#ca98ff]/10 text-[#ca98ff] px-1.5 py-0.5">{s.decisor} dec.</span>
                      <span className="rounded-full bg-[#5b9bff]/10 text-[#5b9bff] px-1.5 py-0.5">{s.influenciador} inf.</span>
                      <span className="rounded-full bg-white/5 text-[#adaaaa] px-1.5 py-0.5">{s.observador} obs.</span>
                    </div>
                    <p className="text-[10px] text-[#adaaaa] mt-1.5">{s.total} engajamentos</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select value={filterIcpLevel} onChange={(e) => setFilterIcpLevel(e.target.value)} className="rounded-lg bg-[#20201f] px-3 py-1.5 text-xs text-white outline-none border border-[#333] focus:border-[#ca98ff]">
              <option value="all">ICP: Todos</option>
              <option value="Alto">ICP: Alto</option>
              <option value="Medio">ICP: Medio</option>
              <option value="Baixo">ICP: Baixo</option>
            </select>
            <select value={filterRoleLevel} onChange={(e) => setFilterRoleLevel(e.target.value)} className="rounded-lg bg-[#20201f] px-3 py-1.5 text-xs text-white outline-none border border-[#333] focus:border-[#ca98ff]">
              <option value="all">Decisor: Todos</option>
              <option value="decisor">Decisor</option>
              <option value="influenciador">Influenciador</option>
              <option value="observador">Observador</option>
            </select>
            <select value={filterEngagement} onChange={(e) => setFilterEngagement(e.target.value)} className="rounded-lg bg-[#20201f] px-3 py-1.5 text-xs text-white outline-none border border-[#333] focus:border-[#ca98ff]">
              <option value="all">Engajamento: Todos</option>
              <option value="both">Curtiu + Comentou</option>
              <option value="comment">Comentou</option>
              <option value="reaction">Curtiu</option>
            </select>
            {selectedPostUrl === "__all__" && (
              <select value={filterPostUrl} onChange={(e) => setFilterPostUrl(e.target.value)} className="rounded-lg bg-[#20201f] px-3 py-1.5 text-xs text-white outline-none border border-[#333] focus:border-[#ca98ff] max-w-[300px] truncate">
                <option value="all">Fonte: Todas ({uniquePostUrls.length})</option>
                {uniquePostUrls.map((url) => (
                  <option key={url} value={url}>{postTextMap[url] ? postTextMap[url].slice(0, 30) + "..." : shortPostLabel(url)}</option>
                ))}
              </select>
            )}
          </div>

          <div className="rounded-2xl bg-[#131313] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1a1a1a] text-left">
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">#</th>
                    <th className="px-2 py-3"></th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Lead</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Cargo</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Especialidades</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Empresa</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">ICP Score</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Decisor</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Engajamento</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads
                    .sort((a, b) => b.icp_score - a.icp_score)
                    .map((lead, idx) => {
                      const label = icpLabel(lead.icp_score);
                      return (
                        <tr key={lead.slug} className="border-t border-[#262626] hover:bg-[#20201f] transition-colors">
                          <td className="px-4 py-3 text-[#adaaaa] text-xs">#{idx + 1}</td>
                          <td className="px-2 py-3">
                            {lead.profile_photo ? (
                              <img src={lead.profile_photo} alt={lead.name} className="w-8 h-8 rounded-full object-cover ring-2 ring-[#ca98ff]/20" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1e1e3a] to-[#262626] ring-2 ring-[#ca98ff]/10 flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#adaaaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#ca98ff] transition-colors font-medium">
                              {lead.name}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-[#adaaaa] text-sm max-w-[180px] truncate">{lead.job_title || "—"}</td>
                          <td className="px-4 py-3 text-[#adaaaa] text-xs max-w-[220px]">
                            {lead.headline ? (
                              expandedHeadlineRow === lead.slug ? (
                                <div>
                                  <span className="break-words">{lead.headline}</span>
                                  <button onClick={() => setExpandedHeadlineRow(null)} className="block mt-1 text-[10px] text-[#ca98ff] hover:text-white">recolher</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setExpandedHeadlineRow(lead.slug)}
                                  className="text-left hover:text-[#ca98ff] transition-colors"
                                  title={lead.headline}
                                >
                                  <span className="line-clamp-2">{lead.headline}</span>
                                  {lead.headline.length > 60 && <span className="text-[10px] text-[#ca98ff] mt-0.5 block">ver mais</span>}
                                </button>
                              )
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-[#adaaaa] text-sm">{lead.company || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold ${label.cls}`}>
                              {label.text}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {(() => { const rl = roleLevelLabel(lead.role_level); return (
                              <span className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold ${rl.cls}`}>
                                {rl.text}
                              </span>
                            ); })()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                              lead.engagement_type === "both" ? "bg-[#ca98ff]/10 text-[#ca98ff]" :
                              lead.engagement_type === "comment" ? "bg-[#a2f31f]/10 text-[#a2f31f]" :
                              "bg-white/5 text-[#adaaaa]"
                            }`}>
                              {lead.engagement_type === "both" ? "Curtiu + Comentou" :
                               lead.engagement_type === "comment" ? "Comentou" : "Curtiu"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {expandedSourceRow === lead.slug ? (
                              <div>
                                <a href={lead.source_post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#ca98ff] hover:underline break-all">
                                  {lead.source_post_url}
                                </a>
                                <button onClick={() => setExpandedSourceRow(null)} className="block mt-1 text-[10px] text-[#adaaaa] hover:text-white">recolher</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setExpandedSourceRow(lead.slug)}
                                className="text-xs text-[#adaaaa] hover:text-[#ca98ff] transition-colors truncate max-w-[120px] block"
                                title={lead.source_post_url}
                              >
                                {shortPostLabel(lead.source_post_url)}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
