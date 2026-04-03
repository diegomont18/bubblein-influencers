"use client";

import { useState, useRef, useEffect, useCallback } from "react";

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

  // Page loading state
  const [pageLoading, setPageLoading] = useState(true);

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

  useEffect(() => {
    Promise.all([loadIcpProfiles(), loadUrlProfiles()]).finally(() => setPageLoading(false));
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

  // --- Filters ---
  const [filterIcpLevel, setFilterIcpLevel] = useState<string>("all");
  const [filterEngagement, setFilterEngagement] = useState<string>("all");
  const [filterPostUrl, setFilterPostUrl] = useState<string>("all");

  // --- Scan (background + polling) ---
  async function handleScan() {
    const urls = postUrls.split("\n").map((l) => l.trim()).filter(Boolean);
    if (urls.length === 0) { setError("Insira pelo menos uma URL de post."); return; }
    const titles = icpJobTitles.split(",").map((t) => t.trim()).filter(Boolean);
    const depts = icpDepartments.split(",").map((d) => d.trim()).filter(Boolean);

    setError(null);
    setSuccessMessage(null);
    setScanning(true);
    setScanStep(0);
    setLeads([]);
    stepIntervalRef.current = setInterval(() => {
      setScanStep((prev) => Math.min(prev + 1, SCAN_STEPS.length - 1));
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

          // Update displayed leads progressively
          if (foundLeads && foundLeads.length > 0) {
            setLeads(foundLeads as Lead[]);
          }

          if (status === "complete") {
            scanComplete = true;
            if (found === 0 && totalEngagers === 0) {
              setError(`Nenhum engajador encontrado nos ${postsAnalyzed} posts analisados. Verifique se as URLs dos posts estao corretas e se os posts possuem curtidas/comentarios.`);
            } else {
              setSuccessMessage(`Encontramos ${found} leads de ${totalEngagers} engajadores analisados em ${postsAnalyzed} posts.`);
            }
            // Refresh credits
            window.dispatchEvent(new CustomEvent("credits-updated", { detail: null }));
            fetch("/api/auth/me")
              .then((r) => r.ok ? r.json() : null)
              .then((d) => { if (d?.user) window.dispatchEvent(new CustomEvent("credits-updated", { detail: d.user.credits })); })
              .catch(() => {});
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
    const headers = ["Nome", "LinkedIn URL", "Headline", "Cargo", "Empresa", "ICP Score", "ICP Nivel", "Titulos Match", "Departamentos Match", "Tipo Engajamento", "Post URL"];
    const escape = (v: string) => v.includes(",") || v.includes('"') || v.includes("\n") ? '"' + v.replace(/"/g, '""') + '"' : v;
    const rows = filteredLeads.map((l) => [
      l.name, l.linkedin_url, l.headline, l.job_title ?? "", l.company,
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

  // Filtered leads
  const filteredLeads = leads.filter((l) => {
    if (filterIcpLevel !== "all") {
      const label = icpLabel(l.icp_score).text;
      if (label !== filterIcpLevel) return false;
    }
    if (filterEngagement !== "all" && l.engagement_type !== filterEngagement) return false;
    if (filterPostUrl !== "all" && l.source_post_url !== filterPostUrl) return false;
    return true;
  });

  // Unique post URLs for filter dropdown
  const uniquePostUrls = [...new Set(leads.map((l) => l.source_post_url).filter(Boolean))];

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
        {/* URL profile selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">URLs dos Posts do LinkedIn</h3>
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
        </div>

        <div>
          <textarea
            rows={4}
            value={postUrls}
            onChange={(e) => setPostUrls(e.target.value)}
            placeholder={"https://linkedin.com/posts/...\nhttps://linkedin.com/posts/..."}
            className={`${inputClass} resize-none`}
          />
          <p className="mt-1 text-[10px] text-[#adaaaa]/60">Cole uma URL por linha. Cada post sera escaneado para encontrar quem curtiu e comentou.</p>
        </div>

        <button
          onClick={handleSaveUrl}
          className="rounded-full bg-[#20201f] px-5 py-2 text-xs font-semibold text-[#ca98ff] hover:bg-[#262626] transition-colors font-[family-name:var(--font-lexend)]"
        >
          Salvar URLs
        </button>
      </div>

      {/* Scan button */}
      <button
        onClick={handleScan}
        disabled={scanning}
        className="w-full rounded-full bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] px-6 py-3.5 text-sm font-semibold text-[#46007d] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all font-[family-name:var(--font-lexend)]"
      >
        {scanning ? "Escaneando..." : "Escanear Posts"}
      </button>

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
      {leads.length > 0 && (
        <div ref={resultsRef} className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-lexend)]">
              Leads Encontrados
              <span className="ml-2 text-sm font-normal text-[#adaaaa]">{filteredLeads.length}{filteredLeads.length !== leads.length ? ` de ${leads.length}` : ""} leads</span>
              {scanning && <span className="ml-2 text-xs text-[#ca98ff] animate-pulse">(atualizando...)</span>}
            </h2>
            <button
              onClick={exportCsv}
              className="rounded-full bg-[#20201f] px-4 py-2 text-xs font-medium text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors font-[family-name:var(--font-lexend)]"
            >
              Exportar CSV
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select value={filterIcpLevel} onChange={(e) => setFilterIcpLevel(e.target.value)} className="rounded-lg bg-[#20201f] px-3 py-1.5 text-xs text-white outline-none border border-[#333] focus:border-[#ca98ff]">
              <option value="all">ICP: Todos</option>
              <option value="Alto">ICP: Alto</option>
              <option value="Medio">ICP: Medio</option>
              <option value="Baixo">ICP: Baixo</option>
            </select>
            <select value={filterEngagement} onChange={(e) => setFilterEngagement(e.target.value)} className="rounded-lg bg-[#20201f] px-3 py-1.5 text-xs text-white outline-none border border-[#333] focus:border-[#ca98ff]">
              <option value="all">Engajamento: Todos</option>
              <option value="both">Curtiu + Comentou</option>
              <option value="comment">Comentou</option>
              <option value="reaction">Curtiu</option>
            </select>
            {uniquePostUrls.length > 1 && (
              <select value={filterPostUrl} onChange={(e) => setFilterPostUrl(e.target.value)} className="rounded-lg bg-[#20201f] px-3 py-1.5 text-xs text-white outline-none border border-[#333] focus:border-[#ca98ff] max-w-[300px] truncate">
                <option value="all">Post: Todos</option>
                {uniquePostUrls.map((url) => (
                  <option key={url} value={url}>{url.split("/posts/")[1]?.split("-activity")[0] ?? url.slice(-40)}</option>
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
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Empresa</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">ICP Score</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Engajamento</th>
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
                            {lead.headline && <div className="text-xs text-[#adaaaa] mt-0.5 max-w-[280px] truncate">{lead.headline}</div>}
                          </td>
                          <td className="px-4 py-3 text-[#adaaaa] text-sm max-w-[200px] truncate">{lead.job_title || "—"}</td>
                          <td className="px-4 py-3 text-[#adaaaa] text-sm">{lead.company || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold ${label.cls}`}>
                              {label.text}
                            </span>
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
