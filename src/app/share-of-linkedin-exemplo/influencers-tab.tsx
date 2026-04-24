"use client";

import { useState } from "react";
import { INFLUENCERS_DATA, INFLUENCER_MENTIONS, COMPANY_COLORS } from "./data";

export default function InfluencersTab() {
  const [brandFilter, setBrandFilter] = useState("Todos");
  const [expandedInf, setExpandedInf] = useState<string | null>(null);
  const filtered = INFLUENCERS_DATA.filter((inf) => brandFilter === "Todos" || inf.brands.includes(brandFilter));

  return (
    <div className="space-y-6">
      <div className="bg-[#12122A] border border-[#1E1E3A] rounded-xl px-4 py-3">
        <p className="text-xs text-gray-400">
          Pessoas externas que mencionam as marcas com frequência e têm potencial de relacionamento.
          Clique em cada influenciador para ver o histórico de menções.
        </p>
      </div>

      <div className="flex gap-1 bg-[#0B0B1A] border border-[#1E1E3A] rounded-full p-0.5 w-fit">
        {["Todos", "TOTVS", "SAP Brasil", "Oracle"].map((b) => (
          <button
            key={b}
            onClick={() => setBrandFilter(b)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${brandFilter === b ? "bg-[#E91E8C]/20 text-[#E91E8C]" : "text-gray-500 hover:text-gray-300"}`}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((inf) => {
          const isExpanded = expandedInf === inf.name;
          const mentions = INFLUENCER_MENTIONS[inf.name] || [];
          const pc =
            inf.potential === "alto"
              ? "text-green-400 bg-green-400/10"
              : inf.potential === "médio"
                ? "text-yellow-400 bg-yellow-400/10"
                : "text-gray-400 bg-gray-400/10";

          return (
            <div
              key={inf.name}
              className={`bg-[#12122A] border rounded-xl transition-colors cursor-pointer ${isExpanded ? "border-[#E91E8C]/30" : "border-[#1E1E3A] hover:border-[#E91E8C]/20"}`}
              onClick={() => setExpandedInf(isExpanded ? null : inf.name)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 text-gray-500 mt-1.5 ${isExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-white">{inf.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pc}`}>{inf.potential}</span>
                      </div>
                      <p className="text-xs text-gray-500">{inf.role} - {inf.company}</p>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-gray-400">
                        <span><strong className="text-white">{Math.round(inf.followers / 1000)}k</strong> seg.</span>
                        <span><strong className="text-white">{inf.postsAbout}</strong> menções</span>
                        <span><strong className="text-white">{inf.avgEngagement}</strong> engaj.</span>
                        <span>RER <strong className="text-white">{inf.avgRer}%</strong></span>
                        <span><strong className="text-white">{inf.frequency}</strong>/mês</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {inf.brands.map((b) => (
                          <span key={b} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${COMPANY_COLORS[b]}`}>{b}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-gray-500 border border-[#1E1E3A] rounded-lg px-3 py-1.5 hover:text-[#E91E8C] hover:border-[#E91E8C]/30 transition-colors shrink-0"
                    title="Disponível no plano Professional"
                  >
                    Conectar
                  </button>
                </div>
              </div>

              {isExpanded && mentions.length > 0 && (
                <div className="px-5 pb-5 border-t border-[#1E1E3A] pt-4 ml-7">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Histórico de menções ({mentions.length})</p>
                  <div className="space-y-3">
                    {mentions.map((m, i) => {
                      const sc = m.sentiment === "positivo" ? "border-green-500/20" : m.sentiment === "negativo" ? "border-red-500/20" : "border-yellow-500/20";
                      const si = m.sentiment === "positivo" ? "text-green-400" : m.sentiment === "negativo" ? "text-red-400" : "text-yellow-400";
                      return (
                        <div key={i} className={`bg-[#0B0B1A] border ${sc} rounded-lg p-3`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] text-gray-500">{new Date(m.date).toLocaleDateString("pt-BR")}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${COMPANY_COLORS[m.brand]}`}>{m.brand}</span>
                            <span className={`text-[10px] ${si}`}>{m.sentiment === "positivo" ? "+" : m.sentiment === "negativo" ? "-" : "~"}</span>
                          </div>
                          <p className="text-xs text-gray-300 leading-relaxed">{m.text}</p>
                          <a href="#" className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#E91E8C] mt-2 transition-colors">
                            Ver post completo
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
