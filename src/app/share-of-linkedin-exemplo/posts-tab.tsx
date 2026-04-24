"use client";

import { useState } from "react";
import { ALL_POSTS, SOV_POSTS, CATEGORIES, COMPANY_COLORS } from "./data";

export default function PostsTab() {
  const [companyFilter, setCompanyFilter] = useState("Todos");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [sourceFilter, setSourceFilter] = useState("own");
  const [sortBy, setSortBy] = useState<"engagement" | "rer">("engagement");
  const [expandedPost, setExpandedPost] = useState<number | null>(null);

  const companies = ["Todos", "TOTVS", "SAP Brasil", "Oracle", "Perfil oficial"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sovMapped = SOV_POSTS.map((p: any) => ({...p, category: "Share of Voice", role: p.role + " - " + p.authorCompany}));
  const base = sourceFilter === "own" ? ALL_POSTS : sourceFilter === "sov" ? sovMapped : [...ALL_POSTS, ...sovMapped];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = base
    .filter((p) => companyFilter === "Todos" ? true : companyFilter === "Perfil oficial" ? !!((p as Record<string, unknown>).official) : p.company === companyFilter)
    .filter((p) => categoryFilter === "Todas" || p.category === categoryFilter)
    .sort((a, b) => sortBy === "engagement" ? b.engagement - a.engagement : b.rer - a.rer);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1 bg-[#0B0B1A] border border-[#1E1E3A] rounded-full p-0.5">
          {companies.map((c) => (
            <button key={c} onClick={() => setCompanyFilter(c)} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${companyFilter === c ? "bg-[#E91E8C]/20 text-[#E91E8C]" : "text-gray-500 hover:text-gray-300"}`}>{c}</button>
          ))}
        </div>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-lg px-3 py-1.5 text-xs text-gray-300">
          <option value="own">Próprias</option>
          <option value="sov">Menções externas</option>
          <option value="all">Todas</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-lg px-3 py-1.5 text-xs text-gray-300">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "engagement" | "rer")} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-lg px-3 py-1.5 text-xs text-gray-300">
          <option value="engagement">Ordenar por Engajamento</option>
          <option value="rer">Ordenar por RER</option>
        </select>
        <span className="text-xs text-gray-500">{filtered.length} posts</span>
      </div>

      <div className="space-y-2">
        {filtered.map((post, i) => {
          const rerColor = post.rer >= 30 ? "text-green-400 bg-green-400/10" : post.rer >= 15 ? "text-yellow-400 bg-yellow-400/10" : "text-orange-400 bg-orange-400/10";
          const isExpanded = expandedPost === i;
          const preview = post.text.length > 100 ? post.text.slice(0, 100) + "..." : post.text;
          const sent = "sentiment" in post ? String((post as {sentiment?: string}).sentiment) : null;
          const sentColor = sent === "positivo" ? "text-green-400 bg-green-400/10" : sent === "negativo" ? "text-red-400 bg-red-400/10" : "text-yellow-400 bg-yellow-400/10";
          return (
            <div
              key={i}
              className={`bg-[#12122A] border rounded-xl px-5 py-3.5 cursor-pointer transition-colors ${isExpanded ? "border-[#E91E8C]/30" : "border-[#1E1E3A] hover:border-[#E91E8C]/20"}`}
              onClick={() => setExpandedPost(isExpanded ? null : i)}
            >
              <div className="flex items-center gap-4">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 text-gray-500 ${isExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${COMPANY_COLORS[post.company]}`}>{post.company}</span>
                {sent && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${sentColor}`}>{sent === "positivo" ? "+" : sent === "negativo" ? "-" : "~"}</span>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{isExpanded ? "" : preview}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{post.author}{post.role ? `, ${post.role}` : ""}</p>
                </div>
                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded shrink-0 hidden sm:inline">{post.category}</span>
                <span className="text-sm text-gray-300 font-medium tabular-nums w-16 text-right shrink-0">{post.engagement.toLocaleString("pt-BR")}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${rerColor}`}>RER {post.rer}%</span>
                <a href="#" onClick={(e) => e.stopPropagation()} className="text-gray-500 hover:text-[#E91E8C] transition-colors shrink-0" title="Ver post no LinkedIn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </div>
              {isExpanded && (
                <div className="mt-3 pl-8 border-t border-[#1E1E3A] pt-3">
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{post.text}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
