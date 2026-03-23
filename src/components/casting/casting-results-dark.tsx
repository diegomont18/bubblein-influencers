"use client";

import { useState, useEffect, useMemo } from "react";
import { CastingProfile } from "./casting-results";

const STAGES = [
  { value: "", label: "—" },
  { value: "prospeccao", label: "1. Prospecção" },
  { value: "contato", label: "2. Contato" },
  { value: "negociacao", label: "3. Negociação" },
  { value: "contratado", label: "4. Contratado" },
  { value: "em_producao", label: "5. Em Produção" },
  { value: "publicado", label: "6. Publicado" },
  { value: "concluido", label: "7. Concluído" },
  { value: "descartado", label: "8. Descartado" },
];

interface CastingResultsDarkProps {
  profiles: CastingProfile[];
  queryTheme?: string;
  highlightSlugs?: Set<string>;
}

type SortKey = "name" | "followers" | "posts_per_month" | "avg_likes_per_post" | "creator_score";
type SortDir = "asc" | "desc";

function SortableHeader({ label, sortKey: key, activeSortKey, sortDir, onSort }: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = activeSortKey === key;
  return (
    <th
      className="px-4 py-3 font-medium text-[#adaaaa] cursor-pointer select-none hover:text-white transition-colors font-[family-name:var(--font-lexend)] text-xs uppercase tracking-wider"
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          <span className="text-[#ca98ff]">{sortDir === "asc" ? "▲" : "▼"}</span>
        ) : (
          <span className="text-[#484847]">▲</span>
        )}
      </span>
    </th>
  );
}

export function CastingResultsDark({ profiles, highlightSlugs }: CastingResultsDarkProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [stageMap, setStageMap] = useState<Record<string, string>>({});

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sortedProfiles = useMemo(() => {
    if (!sortKey) return profiles;
    return [...profiles].sort((a, b) => {
      if (sortKey === "name") {
        return sortDir === "asc"
          ? (a.name || "").localeCompare(b.name || "")
          : (b.name || "").localeCompare(a.name || "");
      }
      const getVal = (p: CastingProfile): number | null | undefined => {
        if (sortKey === "creator_score") return p.final_score ?? p.creator_score;
        return p[sortKey] as number | null | undefined;
      };
      const aVal = getVal(a);
      const bVal = getVal(b);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [profiles, sortKey, sortDir]);

  useEffect(() => { setSelected(new Set()); }, [profiles]);

  function toggleSelect(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === sortedProfiles.length) setSelected(new Set());
    else setSelected(new Set(sortedProfiles.map((p) => p.slug)));
  }

  function exportCsv() {
    const headers = ["Nome", "LinkedIn URL", "Headline", "Seguidores", "Posts/Mês", "Média Likes", "Score", "Tópicos", "Encontrado", "Etapa"];
    const escapeField = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) return '"' + val.replace(/"/g, '""') + '"';
      return val;
    };
    const rows = sortedProfiles.map((p) => [
      p.name || "", p.linkedin_url || "", p.headline || "",
      p.followers != null ? String(p.followers) : "",
      p.posts_per_month != null ? String(Math.round(p.posts_per_month)) : "",
      p.avg_likes_per_post != null ? String(Math.round(p.avg_likes_per_post)) : "",
      (() => { const s = p.final_score ?? p.creator_score; return s != null ? String(Math.round(s)) : ""; })(),
      (p.topics || []).join("; "),
      p.found_at ? new Date(p.found_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "",
      STAGES.find((s) => s.value === (stageMap[p.slug] ?? ""))?.label ?? "—",
    ].map(escapeField));
    const csv = [headers.map(escapeField).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `casting-resultados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-2xl bg-[#131313] overflow-hidden">
        <div className="px-6 py-12 text-center text-[#adaaaa] text-sm">
          Nenhum creator encontrado com esses critérios.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-full bg-[#ca98ff]/10 px-4 py-2 text-sm">
            <span className="text-[#ca98ff] font-medium font-[family-name:var(--font-lexend)]">
              {selected.size} selecionados
            </span>
            <button onClick={() => setSelected(new Set())} className="text-[#adaaaa] hover:text-white text-xs transition-colors">
              Limpar
            </button>
          </div>
        )}
        <button
          onClick={exportCsv}
          className="rounded-full bg-[#20201f] px-4 py-2 text-xs font-medium text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors ml-auto font-[family-name:var(--font-lexend)]"
        >
          Exportar CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[#131313] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1a1a1a] text-left">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={sortedProfiles.length > 0 && selected.size === sortedProfiles.length}
                    onChange={toggleSelectAll}
                    className="rounded bg-[#20201f] border-[#484847] text-[#ca98ff] focus:ring-[#ca98ff]"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">#</th>
                <th className="px-2 py-3"></th>
                <SortableHeader label="Creator" sortKey="name" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Seguidores" sortKey="followers" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Posts/mês" sortKey="posts_per_month" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Média Likes" sortKey="avg_likes_per_post" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Tópicos</th>
                <SortableHeader label="Score" sortKey="creator_score" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Encontrado</th>
                <th className="px-4 py-3 font-medium text-[#adaaaa] text-xs uppercase tracking-wider font-[family-name:var(--font-lexend)]">Etapa</th>
              </tr>
            </thead>
            <tbody>
              {sortedProfiles.map((p, idx) => {
                const score = p.final_score ?? p.creator_score;
                const isHighlighted = highlightSlugs?.has(p.slug);
                const stage = stageMap[p.slug] ?? "";
                return (
                  <tr
                    key={`${p.slug}-${idx}`}
                    className={`border-t border-[#262626] hover:bg-[#20201f] transition-colors ${
                      selected.has(p.slug) ? "bg-[#ca98ff]/5" :
                      isHighlighted ? "bg-[#ca98ff]/[0.08]" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p.slug)}
                        onChange={() => toggleSelect(p.slug)}
                        className="rounded bg-[#20201f] border-[#484847] text-[#ca98ff] focus:ring-[#ca98ff]"
                      />
                    </td>
                    <td className="px-4 py-3 text-[#adaaaa] text-xs">#{idx + 1}</td>
                    <td className="px-2 py-3">
                      {p.profile_photo ? (
                        <img
                          src={p.profile_photo}
                          alt={p.name}
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-[#ca98ff]/20"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-xs font-bold text-[#adaaaa]">
                          {(p.name || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#ca98ff] transition-colors font-medium">
                        {p.name || "—"}
                      </a>
                      {p.headline && (
                        <div className="text-xs text-[#adaaaa] mt-0.5 max-w-[250px] truncate">{p.headline}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#adaaaa]">
                      {p.followers != null ? p.followers.toLocaleString() : "—"}
                    </td>
                    <td className={`px-4 py-3 ${(p.posts_per_month ?? 0) < 3 ? "text-[#ff946e]" : "text-[#adaaaa]"}`}>
                      {p.posts_per_month != null ? String(Math.round(p.posts_per_month)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#adaaaa]">
                      {p.avg_likes_per_post != null ? String(Math.round(p.avg_likes_per_post)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.topics && p.topics.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {p.topics.slice(0, 3).map((topic, i) => (
                            <span key={i} className="inline-block rounded-full px-2 py-0.5 text-xs bg-white/5 text-[#adaaaa]">
                              {topic}
                            </span>
                          ))}
                          {p.topics.length > 3 && <span className="text-xs text-[#484847]">+{p.topics.length - 3}</span>}
                        </div>
                      ) : <span className="text-[#484847]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {score != null ? (
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${
                          score >= 70 ? "bg-[#a2f31f]/10 text-[#a2f31f]" :
                          score >= 40 ? "bg-[#ff946e]/10 text-[#ff946e]" :
                          "bg-white/5 text-[#adaaaa]"
                        }`}>
                          {Math.round(score)}
                        </span>
                      ) : <span className="text-[#484847]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#adaaaa] whitespace-nowrap">
                      {p.found_at ? new Date(p.found_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={stage}
                        onChange={(e) => setStageMap((prev) => ({ ...prev, [p.slug]: e.target.value }))}
                        className={`rounded-lg bg-[#20201f] px-2 py-1.5 text-xs outline-none border-b-2 border-transparent focus:border-[#ca98ff] transition-colors ${
                          stage === "descartado" ? "text-[#ff946e]" :
                          stage === "concluido" ? "text-[#a2f31f]" :
                          stage ? "text-[#ca98ff]" : "text-[#484847]"
                        }`}
                      >
                        {STAGES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
