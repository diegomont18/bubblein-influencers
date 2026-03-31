"use client";

import { useState, useRef } from "react";

interface Lead {
  slug: string;
  name: string;
  headline: string;
  company: string;
  location: string;
  followers: number;
  followers_range: string;
  linkedin_url: string;
  profile_photo: string;
  icp_score: number;
  matched_titles: string[];
  matched_departments: string[];
  company_size_match: boolean;
  engagement_type: "reaction" | "comment" | "both";
  source_post_url: string;
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
  const [icpJobTitles, setIcpJobTitles] = useState("");
  const [icpDepartments, setIcpDepartments] = useState("");
  const [icpCompanySize, setIcpCompanySize] = useState("51-200");
  const [postUrls, setPostUrls] = useState("");

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
    const bufferedLeads: Lead[] = [];

    try {
      const res = await fetch("/api/leads/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postUrls: urls,
          icpJobTitles: titles,
          icpDepartments: depts,
          icpCompanySize,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Erro (${res.status})`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            if (event.type === "lead") {
              bufferedLeads.push(event.data as Lead);
            } else if (event.type === "done") {
              const d = event.data;
              setSuccessMessage(`Encontramos ${d.matchedLeads} leads de ${d.totalEngagers} engajadores analisados.`);
            } else if (event.type === "error") {
              setError(event.data.message ?? "Erro durante a busca");
            }
          } catch { /* skip */ }
        }
      }

      setLeads(bufferedLeads);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Erro na busca");
      }
    } finally {
      if (stepIntervalRef.current) { clearInterval(stepIntervalRef.current); stepIntervalRef.current = null; }
      setScanStep(0);
      setScanning(false);
      abortRef.current = null;
      // Refresh credits
      window.dispatchEvent(new CustomEvent("credits-updated", { detail: null }));
      fetch("/api/auth/me")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.user) window.dispatchEvent(new CustomEvent("credits-updated", { detail: d.user.credits })); })
        .catch(() => {});
    }
  }

  function exportCsv() {
    const headers = ["Nome", "LinkedIn URL", "Headline", "Empresa", "ICP Score", "Títulos Match", "Departamentos Match", "Tipo Engajamento", "Post URL"];
    const escape = (v: string) => v.includes(",") || v.includes('"') || v.includes("\n") ? '"' + v.replace(/"/g, '""') + '"' : v;
    const rows = leads.map((l) => [
      l.name, l.linkedin_url, l.headline, l.company,
      String(l.icp_score), l.matched_titles.join("; "), l.matched_departments.join("; "),
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
    if (score >= 40) return { text: "Médio", cls: "bg-[#ff946e]/10 text-[#ff946e]" };
    return { text: "Baixo", cls: "bg-white/5 text-[#adaaaa]" };
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

      {/* ICP + Post URLs */}
      <div className="rounded-2xl bg-[#131313] p-6 space-y-6">
        <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">Perfil Ideal de Cliente (ICP)</h3>

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
            <p className="mt-1 text-[10px] text-[#adaaaa]/60">Separe por vírgula</p>
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
            <p className="mt-1 text-[10px] text-[#adaaaa]/60">Separe por vírgula</p>
          </div>
          <div>
            <label className={labelClass}>Tamanho da Empresa</label>
            <select value={icpCompanySize} onChange={(e) => setIcpCompanySize(e.target.value)} className={inputClass}>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>{s} funcionários</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>URLs dos Posts do LinkedIn</label>
          <textarea
            rows={4}
            value={postUrls}
            onChange={(e) => setPostUrls(e.target.value)}
            placeholder={"https://linkedin.com/posts/...\nhttps://linkedin.com/posts/..."}
            className={`${inputClass} resize-none`}
          />
          <p className="mt-1 text-[10px] text-[#adaaaa]/60">Cole uma URL por linha. Cada post será escaneado para encontrar quem curtiu e comentou.</p>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="w-full rounded-full bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] px-6 py-3.5 text-sm font-semibold text-[#46007d] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all font-[family-name:var(--font-lexend)]"
        >
          {scanning ? "Escaneando..." : "Escanear Posts"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-[#ff946e]/10 px-4 py-3 text-sm text-[#ff946e]">{error}</div>
      )}

      {/* Success */}
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
      {!scanning && leads.length > 0 && (
        <div ref={resultsRef} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-lexend)]">
              Leads Encontrados
              <span className="ml-2 text-sm font-normal text-[#adaaaa]">{leads.length} leads</span>
            </h2>
            <button
              onClick={exportCsv}
              className="rounded-full bg-[#20201f] px-4 py-2 text-xs font-medium text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors font-[family-name:var(--font-lexend)]"
            >
              Exportar CSV
            </button>
          </div>

          <div className="rounded-2xl bg-[#131313] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1a1a1a] text-left">
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">#</th>
                    <th className="px-2 py-3"></th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Lead</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Empresa</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Seguidores</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">ICP Score</th>
                    <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Engajamento</th>
                  </tr>
                </thead>
                <tbody>
                  {leads
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
                            {lead.headline && <div className="text-xs text-[#adaaaa] mt-0.5 max-w-[250px] truncate">{lead.headline}</div>}
                          </td>
                          <td className="px-4 py-3 text-[#adaaaa] text-sm">{lead.company || "—"}</td>
                          <td className="px-4 py-3 text-[#adaaaa]">{lead.followers_range}</td>
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
