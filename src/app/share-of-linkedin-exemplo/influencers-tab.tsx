"use client";

import { useState } from "react";
import { INFLUENCERS_DATA, COMPANY_COLORS } from "./data";

export default function InfluencersTab() {
  const [brandFilter, setBrandFilter] = useState("Todos");
  const filtered = INFLUENCERS_DATA.filter((inf) => brandFilter === "Todos" || inf.brands.includes(brandFilter));

  return (
    <div className="space-y-6">
      <div className="bg-[#12122A] border border-[#1E1E3A] rounded-xl px-4 py-3">
        <p className="text-xs text-gray-400">
          Pessoas externas que mencionam as marcas com frequencia e tem potencial de relacionamento.
          Filtrados por: min 2 posts/mes, min 500 engajamentos/mes, min 10k seguidores.
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
          const pc =
            inf.potential === "alto"
              ? "text-green-400 bg-green-400/10"
              : inf.potential === "medio"
                ? "text-yellow-400 bg-yellow-400/10"
                : "text-gray-400 bg-gray-400/10";
          const sc =
            inf.sentiment === "positivo"
              ? "text-green-400"
              : inf.sentiment === "negativo"
                ? "text-red-400"
                : "text-yellow-400";

          return (
            <div
              key={inf.name}
              className="bg-[#12122A] border border-[#1E1E3A] rounded-xl p-5 hover:border-[#E91E8C]/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-bold text-white">{inf.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pc}`}>
                      {inf.potential}
                    </span>
                    <span className={`text-[10px] ${sc}`}>
                      {inf.sentiment === "positivo" ? "+" : inf.sentiment === "negativo" ? "-" : "~"}{" "}
                      {inf.sentiment}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {inf.role} - {inf.company}
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-gray-400">
                    <span>
                      <strong className="text-white">{Math.round(inf.followers / 1000)}k</strong> seg.
                    </span>
                    <span>
                      <strong className="text-white">{inf.postsAbout}</strong> posts
                    </span>
                    <span>
                      <strong className="text-white">{inf.avgEngagement}</strong> engaj.
                    </span>
                    <span>
                      RER <strong className="text-white">{inf.avgRer}%</strong>
                    </span>
                    <span>
                      <strong className="text-white">{inf.frequency}</strong>/mes
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {inf.brands.map((b) => (
                      <span
                        key={b}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${COMPANY_COLORS[b]}`}
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  className="text-xs text-gray-500 border border-[#1E1E3A] rounded-lg px-3 py-1.5 hover:text-[#E91E8C] hover:border-[#E91E8C]/30 transition-colors shrink-0"
                  title="Disponivel no plano Professional"
                >
                  Conectar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
