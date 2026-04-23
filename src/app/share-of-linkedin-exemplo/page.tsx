"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/navbar";

/* ========== SHARED COMPONENTS ========== */

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-3.5 h-3.5 rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white flex items-center justify-center text-[9px] font-bold leading-none"
        aria-label="Mais informações"
      >
        i
      </button>
      {open && (
        <span role="tooltip" className="absolute z-50 left-5 top-1/2 -translate-y-1/2 w-64 rounded-lg bg-[#1a1919] border border-[#ca98ff]/30 px-3 py-2 text-[11px] text-white/80 font-normal normal-case tracking-normal shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          {text}
        </span>
      )}
    </span>
  );
}

function AlertIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2L1 21h22L12 2z" fill="currentColor" opacity="0.15" />
      <path d="M12 2L1 21h22L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function InactiveAlert({ tooltipText }: { tooltipText: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="text-amber-400 hover:text-amber-300 transition-colors"
        aria-label="Alerta"
      >
        <AlertIcon size={16} />
      </button>
      {open && (
        <span role="tooltip" className="absolute z-50 left-6 top-1/2 -translate-y-1/2 w-56 rounded-lg bg-[#1a1919] border border-amber-500/30 px-3 py-2 text-[11px] text-white/80 font-normal shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          {tooltipText}
        </span>
      )}
    </span>
  );
}

function CompanyTabs({ active, onChange }: { active: string; onChange: (v: string) => void }) {
  const tabs = ["TOTVS", "SAP Brasil", "Oracle"];
  return (
    <div className="flex gap-1 bg-[#0B0B1A] border border-[#1E1E3A] rounded-full p-0.5 w-fit mb-4">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${active === t ? "bg-[#E91E8C]/20 text-[#E91E8C]" : "text-gray-500 hover:text-gray-300"}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Collapsible({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs text-[#E91E8C]/70 hover:text-[#E91E8C] transition-colors select-none flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90 shrink-0"><path d="m9 18 6-6-6-6"/></svg>
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function ContentBar({ label, segments }: { label: string; segments: { name: string; pct: number; color: string }[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-gray-300">{label}</p>
      <div className="flex h-6 rounded-full overflow-hidden">
        {segments.map((s) => (
          <div key={s.name} className={`${s.color} flex items-center justify-center`} style={{ width: `${s.pct}%` }}>
            {s.pct >= 15 && <span className="text-[9px] font-bold text-white/90">{s.pct}%</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
        {segments.map((s) => (
          <span key={s.name} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${s.color}`} />
            {s.name} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

/* ========== REPORT NAV ========== */

const NAV_ANALYSIS = [
  { id: "insights", label: "Insights" },
  { id: "recomendacoes", label: "Recomendações" },
  { id: "alerta", label: "Movimentos" },
  { id: "traducao", label: "Tradução Negócio" },
];

const NAV_CONTENT = [
  { id: "ranking", label: "Ranking" },
  { id: "analise", label: "Análise Conteúdo" },
  { id: "colaboradores", label: "Colaboradores" },
  { id: "decisores", label: "Decisores" },
];

const NAV_SECTIONS = [...NAV_ANALYSIS, ...NAV_CONTENT];

function ReportNav({ activeId, sections }: { activeId: string; sections: Array<{ id: string; label: string }> }) {
  return (
    <nav className="hidden lg:block sticky top-24 self-start space-y-1 pr-4">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`block text-xs py-1.5 px-3 rounded-lg transition-colors ${activeId === s.id ? "text-[#E91E8C] bg-[#E91E8C]/10 font-medium" : "text-gray-500 hover:text-gray-300"}`}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

/* ========== OLD REPORT ========== */
function OldReport() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 px-5 py-3 flex items-center gap-3">
        <span className="text-[#f59e0b] text-lg">&#9888;</span>
        <p className="text-sm text-[#f59e0b] font-medium">Exemplo ilustrativo — estes dados são fictícios para demonstrar o formato do relatório semanal</p>
      </div>
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white font-[family-name:var(--font-lexend)]">Relatório Semanal — Share of LinkedIn</h1>
        <p className="text-sm text-gray-400 mt-1">Semana de 14/04 a 21/04 · Empresa: TechNova Solutions</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Share of LinkedIn", value: "18%", color: "border-[#E91E8C]/20", valueColor: "text-[#E91E8C]", sub: "Líder: TechCloud Solutions 32%" },
          { label: "RER Médio", value: "38%", color: "border-green-500/20", valueColor: "text-green-400", sub: "+13% vs média" },
          { label: "Posts analisados", value: "247", color: "border-[#1E1E3A]", valueColor: "text-white", sub: "de 8 empresas" },
          { label: "Decisores engajados", value: "89", color: "border-[#1E1E3A]", valueColor: "text-white", sub: "decisores únicos identificados" },
        ].map((k) => (
          <div key={k.label} className={`bg-[#12122A] border ${k.color} rounded-xl p-5`}>
            <p className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">{k.label}</p>
            <p className={`text-3xl font-black ${k.valueColor}`}>{k.value}</p>
            <p className="text-[10px] text-gray-500 mt-2">{k.sub}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6">
        <h3 className="text-lg font-bold text-white mb-4">Diagnóstico Competitivo</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[650px]">
            <thead><tr className="border-b border-white/10">
              {["#", "Empresa", "Colab. ativos", "Posts/mês", "Engaj. médio", "RER", "Top Tema"].map((h) => (
                <th key={h} className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {[
                { pos: 1, name: "TechCloud Solutions", colabs: 8, posts: 22, engaj: 310, rer: 42, tema: "IA Generativa", hl: false },
                { pos: 2, name: "TechNova Solutions", colabs: 5, posts: 12, engaj: 142, rer: 38, tema: "Cloud Computing", hl: true },
                { pos: 3, name: "DataBridge Corp", colabs: 6, posts: 18, engaj: 195, rer: 28, tema: "Transformação Digital", hl: false },
                { pos: 4, name: "InfraNext", colabs: 4, posts: 8, engaj: 89, rer: 22, tema: "Segurança em Nuvem", hl: false },
                { pos: 5, name: "CloudSync Brasil", colabs: 3, posts: 6, engaj: 55, rer: 15, tema: "Migração Cloud", hl: false },
              ].map((r) => (
                <tr key={r.pos} className={r.hl ? "bg-[#E91E8C]/[0.06]" : ""}>
                  <td className="py-3 pr-3 text-xs font-black text-gray-600">{r.pos}</td>
                  <td className={`py-3 font-medium ${r.hl ? "text-[#E91E8C]" : "text-gray-300"}`}>{r.name}</td>
                  <td className="py-3 text-center text-gray-400">{r.colabs}</td>
                  <td className="py-3 text-center text-gray-400">{r.posts}</td>
                  <td className="py-3 text-center text-gray-400">{r.engaj}</td>
                  <td className="py-3 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.rer >= 30 ? "text-green-400 bg-green-400/10" : "text-yellow-400 bg-yellow-400/10"}`}>{r.rer}%</span></td>
                  <td className="py-3 text-gray-500 text-xs">{r.tema}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6">
        <h3 className="text-lg font-bold text-white mb-4">Top Posts da Semana</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { company: "TechCloud Solutions", author: "Ana Silva, CEO", text: "Reduzimos o custo de infraestrutura cloud em 40% para um cliente do setor financeiro usando FinOps...", likes: 342, comments: 47, rer: 52 },
            { company: "TechNova Solutions", author: "Pedro Santos, CTO", text: "A migração para multi-cloud não é sobre tecnologia — é sobre estratégia de negócios...", likes: 189, comments: 31, rer: 45 },
            { company: "DataBridge Corp", author: "Carlos Lima, Head of Data", text: "IA generativa está mudando a forma como processamos dados não-estruturados...", likes: 267, comments: 38, rer: 41 },
          ].map((p, i) => (
            <div key={i} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between"><div><p className="text-xs font-medium text-[#E91E8C]">{p.company}</p><p className="text-[10px] text-gray-500">{p.author}</p></div><span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">RER {p.rer}%</span></div>
              <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{p.text}</p>
              <div className="flex items-center gap-4 text-[10px] text-gray-600 pt-1 border-t border-white/5"><span>{p.likes} curtidas</span><span>{p.comments} comentários</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6">
        <h3 className="text-lg font-bold text-white mb-4">Recomendações de Conteúdo</h3>
        <div className="space-y-4">
          {[
            { num: "01", tema: "Otimização de custos com FinOps", angulo: "Publique um case study mostrando como sua equipe reduziu custos em cloud.", just: "TechCloud publicou 3 posts sobre FinOps com RER acima de 40%." },
            { num: "02", tema: "IA generativa aplicada a dados corporativos", angulo: "Crie um tutorial prático mostrando resultados mensuráveis.", just: "Nenhum concorrente está abordando IA generativa aplicada a dados." },
            { num: "03", tema: "Erros comuns na migração para nuvem", angulo: "Compartilhe os 5 erros mais frequentes em projetos de migração cloud.", just: "3 concorrentes publicaram sobre migração com alto engajamento." },
          ].map((r) => (
            <div key={r.num} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl p-5">
              <div className="flex items-start gap-4">
                <span className="text-3xl font-black text-[#E91E8C]/30 leading-none shrink-0">{r.num}</span>
                <div className="space-y-2"><p className="text-base font-bold text-white">{r.tema}</p><p className="text-sm text-gray-400">{r.angulo}</p><div className="bg-green-400/5 border border-green-400/15 rounded-lg px-4 py-2.5"><p className="text-xs text-green-400/80">{r.just}</p></div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6">
          <h3 className="text-base font-bold text-white mb-4">Lacunas Temáticas</h3>
          <div className="flex flex-wrap gap-2">
            {["FinOps para PMEs", "IA + compliance", "Cloud soberana", "Sustentabilidade DC", "Edge computing", "Dados tempo real", "Governança multi-cloud"].map((t) => (
              <span key={t} className="bg-green-400/10 border border-green-400/20 text-green-400 text-xs font-medium px-3 py-1.5 rounded-full">{t}</span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6">
          <h3 className="text-base font-bold text-white mb-4">Tendências em Alta</h3>
          <div className="flex flex-wrap gap-2">
            {[{ t: "IA Generativa", p: "+52%" }, { t: "FinOps", p: "+34%" }, { t: "Zero Trust", p: "+28%" }, { t: "Observabilidade", p: "+24%" }, { t: "Platform Eng.", p: "+19%" }].map((x) => (
              <span key={x.t} className="bg-[#E91E8C]/10 border border-[#E91E8C]/20 text-[#E91E8C] text-xs font-medium px-3 py-1.5 rounded-full">{x.t} <span className="text-green-400 font-bold">{x.p}</span></span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========== DATA ========== */

const HIGHLIGHT_POSTS: Record<string, { positive: { title: string; author: string; rer: number; reactions: number; comments: number; why: string }; negative: { title: string; author: string; rer: number; reactions: number; comments: number; why: string }; unexpected: { title: string; author: string; reactions: number; detail: string; why: string } }> = {
  TOTVS: {
    positive: { title: "Reforma tributária: os 3 erros que já vemos nas empresas grandes", author: "Dennis Herszkowicz (CEO TOTVS)", rer: 51, reactions: 2347, comments: 89, why: "Tese específica, acionável, ancorada em autoridade de quem tem contexto. Replicar o formato \"N erros que vemos\" em outros temas." },
    negative: { title: "Integração nativa ERP-CRM: como nossa plataforma resolve", author: "Juliano Tubino (VP Comercial TOTVS)", rer: 12, reactions: 84, comments: 6, why: "Tom institucional (\"nossa plataforma resolve\"), sem dor específica do leitor, sem dado, sem case. Audiência de decisor ignora comunicação de venda." },
    unexpected: { title: "TOTVS 42 anos — o que aprendemos nessas 4 décadas", author: "Página oficial TOTVS", reactions: 1847, detail: "4x a média", why: "A audiência está aquecida para conteúdo humano/identitário e fria para tese técnica. Sinal de que o mix de conteúdo está desbalanceado." },
  },
  "SAP Brasil": {
    positive: { title: "Como IA generativa está redefinindo o planejamento de supply chain", author: "Marcos Vidal (VP Inovação SAP Brasil)", rer: 48, reactions: 1890, comments: 72, why: "Tese com caso concreto de aplicação, dados de resultado e posicionamento claro. Formato que atrai CIOs e diretores de operações." },
    negative: { title: "Estamos contratando! Venha fazer parte do time de IA da SAP", author: "SAP Brasil (Página oficial)", rer: 8, reactions: 320, comments: 12, why: "Post de vaga disfarçado de thought leadership. Engajamento alto em volume (funcionários curtindo), mas RER mínimo — decisores ignoram." },
    unexpected: { title: "Meu primeiro ano como estagiário na SAP: o que aprendi sobre enterprise software", author: "Lucas Mendonça (Estagiário SAP)", reactions: 2100, detail: "5x a média de VP", why: "Autenticidade e vulnerabilidade vencem polish corporativo. Post humaniza a marca de forma que a comunicação oficial não consegue." },
  },
  Oracle: {
    positive: { title: "Migramos 100% do ERP do Bradesco para cloud em 8 meses — o que aprendemos", author: "Ricardo Torres (CTO Oracle Brasil)", rer: 44, reactions: 1650, comments: 58, why: "Case real com cliente de peso, números específicos e timeline. Formato que gera confiança com buyers enterprise." },
    negative: { title: "5 razões para migrar seu ERP para a nuvem em 2026", author: "Oracle Brasil (Página oficial)", rer: 10, reactions: 180, comments: 8, why: "Whitepaper genérico reciclado como post. Sem ponto de vista, sem dado original, sem voz humana. Decisores já viram esse conteúdo 100 vezes." },
    unexpected: { title: "Por que a SAP está certa sobre IA em ERP (e o que falta no argumento deles)", author: "Roberto Lima (CEO Oracle Brasil)", reactions: 1500, detail: "3x a média", why: "CEO elogiando competitor gera curiosidade e debate. Posicionamento de maturidade que atrai decisores seniores." },
  },
};

const COLLAB_DATA: Record<string, Array<{ name: string; role: string; posts: number; engPct: string; cat: string; badge: string; badgeColor: string; note: string }>> = {
  TOTVS: [
    { name: "TOTVS", role: "Página oficial", posts: 6, engPct: "21%", cat: "Institucional/Vagas", badge: "Média", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Alto volume mas baixo RER — conteúdo institucional" },
    { name: "Dennis Herszkowicz", role: "CEO", posts: 12, engPct: "52%", cat: "Reforma Tributária", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "RER 51% no post sobre reforma" },
    { name: "Juliano Tubino", role: "VP Comercial", posts: 8, engPct: "19%", cat: "Produto/Plataforma", badge: "Média", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Tom institucional reduz impacto" },
    { name: "Gustavo Bastos", role: "CFO", posts: 4, engPct: "8%", cat: "Gestão Financeira", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Engaja CFOs e Controllers" },
    { name: "Marcelo Cosentino", role: "VP Tecnologia", posts: 0, engPct: "0%", cat: "—", badge: "Inativo 45d", badgeColor: "text-gray-500 bg-gray-500/10", note: "Voz técnica ausente (CIO/CTO)" },
    { name: "Sergio Campos", role: "VP Produto", posts: 0, engPct: "0%", cat: "—", badge: "Inativo 60d", badgeColor: "text-gray-500 bg-gray-500/10", note: "Território de produto sem voz" },
  ],
  "SAP Brasil": [
    { name: "SAP Brasil", role: "Página oficial", posts: 4, engPct: "12%", cat: "Institucional/Vagas", badge: "Baixa", badgeColor: "text-red-400 bg-red-400/10", note: "Vagas e institucional, RER abaixo da média" },
    { name: "Maria Santos", role: "VP Inovação", posts: 15, engPct: "22%", cat: "IA + Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Principal voz em IA" },
    { name: "Carlos Ferreira", role: "Dir. Produto", posts: 12, engPct: "18%", cat: "Produto", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Conteúdo técnico consistente" },
    { name: "Ana Rodrigues", role: "Head Marketing", posts: 10, engPct: "15%", cat: "Institucional", badge: "Média", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Foco institucional, baixo RER" },
    { name: "Pedro Almeida", role: "Dir. Engenharia", posts: 8, engPct: "13%", cat: "Tech/Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Engaja público técnico CTO" },
    { name: "Lucas Mendes", role: "Head CS", posts: 6, engPct: "10%", cat: "Cases", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Cases reais com clientes" },
  ],
  Oracle: [
    { name: "Oracle Brasil", role: "Página oficial", posts: 2, engPct: "8%", cat: "Institucional", badge: "Baixa", badgeColor: "text-red-400 bg-red-400/10", note: "Pouca atividade na página oficial" },
    { name: "Roberto Lima", role: "CEO", posts: 14, engPct: "71%", cat: "ERP Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Concentração extrema de engajamento" },
    { name: "Fernanda Costa", role: "Dir. Comercial", posts: 3, engPct: "18%", cat: "Vendas", badge: "Média", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Poucos posts, foco comercial" },
    { name: "André Souza", role: "Head Tech", posts: 1, engPct: "11%", cat: "Cloud", badge: "Baixa", badgeColor: "text-red-400 bg-red-400/10", note: "Quase inativo, baixa aderência" },
  ],
};

/* ========== POSTS DATA ========== */
const ALL_POSTS = [
  { company: "TOTVS", text: "Reforma tributária: os 3 erros que já vemos nas empresas grandes. Depois de acompanhar mais de 200 empresas na transição, identificamos três padrões que se repetem: (1) subestimar o impacto no fluxo de caixa da transição de créditos, (2) não revisar contratos com fornecedores que terão carga tributária alterada, e (3) deixar para atualizar o ERP nos últimos 60 dias. O erro #3 é o mais caro — empresas que começam a adaptar agora economizam em média 40% no custo da migração.", author: "Dennis Herszkowicz", role: "CEO", category: "Produto e negócio", engagement: 2436, rer: 51 },
  { company: "TOTVS", text: "TOTVS 42 anos — o que aprendemos nessas 4 décadas. Quando começamos em 1983, software de gestão era coisa de multinacional. Hoje, mais de 70 mil empresas brasileiras rodam na nossa plataforma. O que aprendemos: tecnologia brasileira precisa resolver problemas brasileiros. Não adianta copiar modelo americano. A complexidade fiscal daqui não existe em nenhum outro lugar do mundo. É isso que nos faz únicos — e é isso que vamos continuar fazendo pelos próximos 42 anos.", author: "Página oficial", role: "", official: true, category: "Institucional", engagement: 1847, rer: 15 },
  { company: "TOTVS", text: "Integração nativa ERP-CRM: como nossa plataforma resolve o desafio que toda empresa enfrenta. Com a integração nativa, eliminamos a necessidade de middleware e reduzimos o tempo de implementação em 60%. Nossa plataforma conecta vendas, financeiro e operações em um único ambiente, sem fricção de dados entre sistemas. Conheça mais sobre como podemos ajudar sua empresa a crescer com eficiência.", author: "Juliano Tubino", role: "VP Comercial", category: "Produto e negócio", engagement: 90, rer: 12 },
  { company: "TOTVS", text: "Estamos contratando! Vagas abertas em tecnologia na TOTVS. Procuramos desenvolvedores Python, engenheiros de dados e especialistas em IA para nosso time de inovação. Oferecemos trabalho remoto, plano de carreira acelerado e a chance de impactar milhares de empresas brasileiras. Se você quer construir tecnologia que transforma negócios reais, venha fazer parte do nosso time. Inscreva-se pelo link na bio.", author: "Página oficial", role: "", official: true, category: "Vagas e RH", engagement: 520, rer: 5 },
  { company: "TOTVS", text: "O futuro da gestão financeira no Brasil passa por três pilares: automação fiscal inteligente, real-time analytics e compliance preditivo. Na última década, o CFO deixou de ser o guardião dos números para se tornar o estrategista do crescimento. Empresas que adotam essas três capacidades estão crescendo 2,3x mais rápido que a média do setor. Como CFO, vejo isso acontecer todos os dias nos nossos clientes.", author: "Gustavo Bastos", role: "CFO", category: "Produto e negócio", engagement: 380, rer: 44 },
  { company: "TOTVS", text: "TOTVS no evento SAP Sapphire — o que aprendemos observando a concorrência. Passamos 3 dias imersos no evento da SAP e voltamos com insights valiosos. Primeiro: eles estão apostando pesado em IA generativa, mas ainda sem cases concretos no Brasil. Segundo: o discurso de plataforma global não ressoa com o mid-market brasileiro. Terceiro: a oportunidade para ERPs brasileiros nunca foi tão clara.", author: "Dennis Herszkowicz", role: "CEO", category: "Institucional", engagement: 890, rer: 28 },
  { company: "TOTVS", text: "Resultado do 4T25: crescimento de 18% em receita recorrente, superando guidance. A receita recorrente atingiu R$ 1,2 bilhão no trimestre, impulsionada pela migração de clientes para cloud e pela expansão da base de PMEs. O churn caiu para 0,8% — o menor da história. Estamos confiantes que 2026 será o ano de maior crescimento orgânico da TOTVS, com foco em IA aplicada e reforma tributária.", author: "Página oficial", role: "", official: true, category: "Institucional", engagement: 1200, rer: 22 },
  { company: "SAP Brasil", text: "Como IA generativa está redefinindo o planejamento de supply chain. Na semana passada, apresentamos para um cliente do setor automotivo como nosso módulo de IA generativa reduziu o tempo de planejamento de demanda de 5 dias para 4 horas. O modelo analisa 340 variáveis simultaneamente — clima, câmbio, sazonalidade, redes sociais — e gera cenários probabilísticos que nenhum analista humano conseguiria produzir. Isso não é futuro. É agora.", author: "Marcos Vidal", role: "VP Inovação", category: "Produto e negócio", engagement: 1962, rer: 48 },
  { company: "SAP Brasil", text: "Estamos contratando! Venha fazer parte do time de IA da SAP Brasil. Buscamos cientistas de dados, engenheiros de ML e product managers para nosso hub de inovação em São Paulo. Trabalhe com os maiores datasets de gestão empresarial do mundo e ajude a construir o futuro do ERP inteligente. Benefícios globais, cultura de inovação e impacto real em milhares de empresas.", author: "Página oficial", role: "", official: true, category: "Vagas e RH", engagement: 332, rer: 8 },
  { company: "SAP Brasil", text: "Meu primeiro ano como estagiário na SAP: o que aprendi sobre enterprise software. Entrei achando que ERP era só planilha glorificada. Saí entendendo que por trás de cada linha de código existe uma empresa real, com pessoas reais tomando decisões que afetam empregos e famílias. O que mais me surpreendeu: a complexidade do mercado brasileiro. Cada estado tem regras diferentes, cada setor tem particularidades. Nunca mais vou subestimar um sistema de gestão.", author: "Lucas Mendonça", role: "Estagiário", category: "Outros", engagement: 2100, rer: 6 },
  { company: "SAP Brasil", text: "O papel da IA preditiva na gestão de inventário: resultados reais de 3 clientes brasileiros. Cliente 1 (varejo): redução de 34% em ruptura de estoque. Cliente 2 (indústria): diminuição de 28% em capital imobilizado. Cliente 3 (distribuição): aumento de 19% no giro de estoque. Em todos os casos, o ROI foi positivo em menos de 6 meses. IA não é buzzword quando tem número real por trás.", author: "Maria Santos", role: "VP Inovação", category: "Produto e negócio", engagement: 1450, rer: 42 },
  { company: "SAP Brasil", text: "SAP Sapphire 2026: 3 tendências que vão mudar o ERP para sempre. Tendência 1: Business AI — IA embutida em cada transação, não como módulo separado. Tendência 2: Green Ledger — contabilidade de carbono integrada ao financeiro. Tendência 3: Composable ERP — empresas montam seu ERP como Lego, escolhendo módulos best-of-breed. O futuro do ERP não é monolítico. É inteligente, sustentável e modular.", author: "Carlos Ferreira", role: "Dir. Produto", category: "Produto e negócio", engagement: 980, rer: 38 },
  { company: "SAP Brasil", text: "Customer success: como ajudamos a Ambev a transformar sua operação fiscal em 90 dias. O desafio: 14 plantas, 27 estados, milhares de SKUs com regras tributárias diferentes. A solução: automação fiscal com IA que classifica automaticamente cada operação. O resultado: 92% de redução em erros de classificação e R$ 12M economizados em contingências fiscais no primeiro ano. Esse é o tipo de impacto que nos motiva.", author: "Lucas Mendes", role: "Head CS", category: "Produto e negócio", engagement: 720, rer: 35 },
  { company: "SAP Brasil", text: "Diversidade na SAP: nosso relatório anual de inclusão revela avanços e desafios. Em 2025, atingimos 42% de mulheres em cargos de liderança no Brasil — acima da meta de 40%. Pessoas negras representam 28% do quadro total, com programa de aceleração de carreira que já formou 150 profissionais. Ainda temos muito a evoluir, mas acreditamos que transparência é o primeiro passo.", author: "Ana Rodrigues", role: "Head Marketing", category: "Institucional", engagement: 1100, rer: 12 },
  { company: "Oracle", text: "Migramos 100% do ERP do Bradesco para cloud em 8 meses — o que aprendemos nessa jornada. Foram 2.400 processos mapeados, 180 integrações reconfiguradas e zero downtime na virada. A chave foi a abordagem lift-and-shift no primeiro momento, seguida de otimização cloud-native nos 6 meses seguintes. O resultado: 45% de redução no TCO e performance 3x maior nos fechamentos contábeis. Enterprise migration não precisa levar 3 anos.", author: "Ricardo Torres", role: "CTO", category: "Produto e negócio", engagement: 1708, rer: 44 },
  { company: "Oracle", text: "5 razões para migrar seu ERP para a nuvem em 2026. Razão 1: custo de infraestrutura on-premise só aumenta. Razão 2: atualizações automáticas eliminam projetos de upgrade. Razão 3: escalabilidade elástica para picos de demanda. Razão 4: segurança enterprise-grade sem investimento adicional. Razão 5: acesso a IA e analytics nativos da plataforma. A pergunta não é se você vai migrar, mas quando.", author: "Página oficial", role: "", official: true, category: "Produto e negócio", engagement: 188, rer: 10 },
  { company: "Oracle", text: "Por que a SAP está certa sobre IA em ERP (e o que falta no argumento deles). Concordo com a tese da SAP de que IA vai transformar o ERP. Mas tem um ponto cego: eles falam de IA generativa como se fosse mágica, sem discutir governança de dados, viés algorítmico e compliance regulatório. IA em ERP é poderosa, mas precisa de guardrails que ninguém está discutindo. Esse é o debate adulto que o mercado precisa ter.", author: "Roberto Lima", role: "CEO", category: "Produto e negócio", engagement: 1500, rer: 32 },
  { company: "Oracle", text: "Oracle Cloud World: keynotes e novidades para o Brasil. Destaques do evento: lançamento do Oracle Fusion AI para mercado brasileiro, parceria com Embratel para cloud soberana, e programa de aceleração para ISVs locais. O Brasil é o 4º maior mercado da Oracle globalmente e estamos investindo R$ 500M em infraestrutura local nos próximos 2 anos. Cloud enterprise no Brasil vai ser diferente.", author: "Fernanda Costa", role: "Dir. Comercial", category: "Institucional", engagement: 450, rer: 18 },
];

const CATEGORIES = ["Todas", "Produto e negócio", "Institucional", "Vagas e RH", "Outros"];
const COMPANY_COLORS: Record<string, string> = { TOTVS: "text-[#E91E8C] bg-[#E91E8C]/10", "SAP Brasil": "text-blue-400 bg-blue-400/10", Oracle: "text-orange-400 bg-orange-400/10" };

function LikeDislike({ id, votes, setVotes }: { id: number; votes: Record<number, "like" | "dislike" | null>; setVotes: React.Dispatch<React.SetStateAction<Record<number, "like" | "dislike" | null>>> }) {
  const v = votes[id] ?? null;
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setVotes((prev) => ({ ...prev, [id]: prev[id] === "like" ? null : "like" })); }}
        className={`p-1.5 rounded-lg transition-colors ${v === "like" ? "text-green-400 bg-green-400/10" : "text-gray-600 hover:text-gray-400"}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setVotes((prev) => ({ ...prev, [id]: prev[id] === "dislike" ? null : "dislike" })); }}
        className={`p-1.5 rounded-lg transition-colors ${v === "dislike" ? "text-red-400 bg-red-400/10" : "text-gray-600 hover:text-gray-400"}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
      </button>
    </div>
  );
}

/* ========== POSTS TAB ========== */
function PostsTab() {
  const [companyFilter, setCompanyFilter] = useState("Todos");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [sortBy, setSortBy] = useState<"engagement" | "rer">("engagement");
  const [expandedPost, setExpandedPost] = useState<number | null>(null);

  const companies = ["Todos", "TOTVS", "SAP Brasil", "Oracle", "Perfil oficial"];

  const filtered = ALL_POSTS
    .filter((p) => companyFilter === "Todos" ? true : companyFilter === "Perfil oficial" ? !!(p as Record<string, unknown>).official : p.company === companyFilter)
    .filter((p) => categoryFilter === "Todas" || p.category === categoryFilter)
    .sort((a, b) => sortBy === "engagement" ? b.engagement - a.engagement : b.rer - a.rer);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1 bg-[#0B0B1A] border border-[#1E1E3A] rounded-full p-0.5">
          {companies.map((c) => (
            <button key={c} onClick={() => setCompanyFilter(c)} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${companyFilter === c ? "bg-[#E91E8C]/20 text-[#E91E8C]" : "text-gray-500 hover:text-gray-300"}`}>{c}</button>
          ))}
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-lg px-3 py-1.5 text-xs text-gray-300">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "engagement" | "rer")} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-lg px-3 py-1.5 text-xs text-gray-300">
          <option value="engagement">Ordenar por Engajamento</option>
          <option value="rer">Ordenar por RER</option>
        </select>
        <span className="text-xs text-gray-500">{filtered.length} posts</span>
      </div>

      {/* Post list */}
      <div className="space-y-2">
        {filtered.map((post, i) => {
          const rerColor = post.rer >= 30 ? "text-green-400 bg-green-400/10" : post.rer >= 15 ? "text-yellow-400 bg-yellow-400/10" : "text-orange-400 bg-orange-400/10";
          const isExpanded = expandedPost === i;
          const preview = post.text.length > 100 ? post.text.slice(0, 100) + "..." : post.text;
          return (
            <div
              key={i}
              className={`bg-[#12122A] border rounded-xl px-5 py-3.5 cursor-pointer transition-colors ${isExpanded ? "border-[#E91E8C]/30" : "border-[#1E1E3A] hover:border-[#E91E8C]/20"}`}
              onClick={() => setExpandedPost(isExpanded ? null : i)}
            >
              <div className="flex items-center gap-4">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 text-gray-500 ${isExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${COMPANY_COLORS[post.company]}`}>{post.company}</span>
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

/* ========== NEW REPORT ========== */
function NewReport() {
  const [reportTab, setReportTab] = useState<"analysis" | "content" | "posts">("analysis");
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [highlightTab, setHighlightTab] = useState("TOTVS");
  const [collabTab, setCollabTab] = useState("TOTVS");
  const [activeSection, setActiveSection] = useState("insights");
  const [chartTab, setChartTab] = useState<"share" | "engagement" | "posts">("share");
  const [recVotes, setRecVotes] = useState<Record<number, "like" | "dislike" | null>>({});

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    for (const id of NAV_SECTIONS.map((s) => s.id)) {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const setRef = (id: string) => (el: HTMLElement | null) => { sectionRefs.current[id] = el; };

  const posts = HIGHLIGHT_POSTS[highlightTab];
  const collabs = COLLAB_DATA[collabTab];

  return (
    <div>
      {/* 1. Header */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Relatório Mensal — Share of LinkedIn</h1>
          <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full shrink-0">exemplo</span>
        </div>

        <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] text-gray-500 uppercase mb-1">Sua Marca</p>
              <p className="text-xl font-bold text-white">TOTVS</p>
              <p className="text-xs text-gray-500 mt-0.5">1 perfil da empresa + 5 colaboradores</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] text-gray-500 uppercase mb-1">Concorrentes</p>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-lg font-bold text-white">SAP Brasil</p>
                  <p className="text-xs text-gray-500">1 perfil + 5 colaboradores</p>
                </div>
                <span className="text-gray-600">·</span>
                <div>
                  <p className="text-lg font-bold text-white">Oracle</p>
                  <p className="text-xs text-gray-500">1 perfil + 3 colaboradores</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] text-gray-500 uppercase mb-1">Período</p>
              <p className="text-lg font-bold text-white">Março de 2026</p>
              <p className="text-xs text-gray-500">Relatório mensal</p>
            </div>
          </div>

          {/* Expandable collaborators */}
          <div className="mt-4 pt-3 border-t border-[#1E1E3A]">
            <button
              onClick={() => setHeaderExpanded((v) => !v)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-[#E91E8C] transition-colors w-full"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 ${headerExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
              <span className="font-medium">16 perfis monitorados (3 empresas + 13 colaboradores)</span>
            </button>

            {headerExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                {(["TOTVS", "SAP Brasil", "Oracle"] as const).map((company) => (
                  <div key={company}>
                    <p className="text-xs font-semibold text-white mb-2">{company} ({COLLAB_DATA[company].length})</p>
                    <div className="space-y-1">
                      {COLLAB_DATA[company].map((c) => (
                        <p key={c.name} className="text-xs text-gray-400 flex items-center gap-1.5">
                          {c.role === "Página oficial" && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#E91E8C] shrink-0"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>
                          )}
                          <span className={c.role === "Página oficial" ? "text-[#E91E8C]" : "text-gray-300"}>{c.name}</span>
                          <span className="text-gray-600"> — {c.role}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report tabs */}
      <div className="flex border-b border-[#1E1E3A] mb-6">
        {([["analysis", "Análise"], ["content", "Conteúdo"], ["posts", "Posts"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setReportTab(key)} className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${reportTab === key ? "border-[#E91E8C] text-[#E91E8C]" : "border-transparent text-gray-500 hover:text-gray-300"}`}>{label}</button>
        ))}
      </div>

      {reportTab === "posts" ? <PostsTab /> : (
      <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-8">
        <ReportNav activeId={activeSection} sections={reportTab === "content" ? NAV_CONTENT : NAV_ANALYSIS} />
        <div className="space-y-8 min-w-0">

        {reportTab === "analysis" && (<>
        {/* 2. Insights Estratégicos */}
        <section id="insights" ref={setRef("insights")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 scroll-mt-20">
          {/* Gráfico comparativo */}
          {(() => {
            const chartData: Record<string, Array<{ name: string; value: number; highlight: boolean }>> = {
              share: [
                { name: "SAP Brasil", value: 2900000, highlight: false },
                { name: "TOTVS", value: 1100000, highlight: true },
                { name: "Oracle", value: 600000, highlight: false },
              ],
              engagement: [
                { name: "SAP Brasil", value: 44970, highlight: false },
                { name: "TOTVS", value: 29376, highlight: true },
                { name: "Oracle", value: 18408, highlight: false },
              ],
              posts: [
                { name: "SAP Brasil", value: 142, highlight: false },
                { name: "TOTVS", value: 87, highlight: true },
                { name: "Oracle", value: 58, highlight: false },
              ],
            };
            const tabs: Array<{ key: "share" | "engagement" | "posts"; label: string; tip: string }> = [
              { key: "share", label: "Share of LinkedIn", tip: "Índice composto que mede a presença qualificada da marca. Calculado como: Posts engajados × RER (% de decisores) × Engajamentos totais. Quanto maior, mais a marca está dominando as conversas relevantes." },
              { key: "engagement", label: "Engajamento", tip: "Volume total de engajamento (curtidas, comentários, compartilhamentos) gerado pelos perfis monitorados de cada empresa. Não filtra por decisores — mede alcance bruto." },
              { key: "posts", label: "Número de Posts", tip: "Total de posts publicados no período pelos perfis monitorados (oficial + colaboradores). Exclui reposts sem comentário." },
            ];
            const bars = chartData[chartTab];
            const maxVal = Math.max(...bars.map((b) => b.value));

            return (
              <div className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl p-5 mb-6">
                {/* Tabs */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {tabs.map((t) => (
                    <span key={t.key} className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setChartTab(t.key)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${chartTab === t.key ? "bg-gradient-to-r from-[#E91E8C] to-[#C724D1] text-white" : "text-gray-500 hover:text-gray-300 border border-[#1E1E3A]"}`}
                      >
                        {t.label}
                      </button>
                      <InfoTooltip text={t.tip} />
                    </span>
                  ))}
                </div>

                {/* Bars */}
                <div className="space-y-4">
                  {bars.map((bar) => (
                    <div key={bar.name} className="flex items-center gap-3">
                      <span className={`text-sm w-24 shrink-0 text-right ${bar.highlight ? "text-[#E91E8C] font-bold" : "text-gray-400"}`}>{bar.name}</span>
                      <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${bar.highlight ? "bg-gradient-to-r from-[#E91E8C] to-[#C724D1]" : "bg-gray-600/60"}`}
                          style={{ width: `${Math.max((bar.value / maxVal) * 100, 3)}%` }}
                        />
                      </div>
                      <span className={`text-sm w-28 shrink-0 tabular-nums ${bar.highlight ? "text-white font-bold" : "text-gray-400"}`}>
                        {maxVal >= 1000000
                          ? (bar.value / 1000000).toFixed(1)
                          : maxVal >= 1000
                            ? (bar.value / 1000).toFixed(1)
                            : bar.value.toString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <h3 className="text-lg font-bold text-white mb-4">Insights Estratégicos</h3>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Positivos */}
            <div className="bg-green-400/5 border border-green-400/15 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>
                Positivos
              </p>
              <div className="space-y-2.5">
                <div>
                  <p className="text-sm text-white font-semibold">Liderança em Reforma Tributária mantida</p>
                  <p className="text-xs text-gray-400">Post do Dennis Herszkowicz sobre os 3 erros da reforma tributária foi o post com maior RER do mês em todo o set competitivo (51%, 2.347 reações, 89 comentários de decisores). Nenhum concorrente publicou sobre o tema com engajamento comparável. A TOTVS é a referência percebida neste território.</p>
                </div>
                <div>
                  <p className="text-sm text-white font-semibold">Domínio no buyer financeiro (CFO/Controller)</p>
                  <p className="text-xs text-gray-400">6 dos 8 decisores que engajaram com a TOTVS no mês são do setor financeiro (CFOs, Controllers, Heads Fiscais). Empresas como Gerdau, Ambev, Raízen e Vale tiveram decisores financeiros ativos em nosso conteúdo. Este é o canal de pipeline mais qualificado da marca.</p>
                </div>
              </div>
            </div>

            {/* Pontos de atenção */}
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertIcon size={14} />
                Pontos de Atenção
              </p>
              <div className="space-y-2.5">
                <div>
                  <p className="text-sm text-white font-semibold">SAP assumiu liderança no tema IA+ERP (−3% SoL)</p>
                  <p className="text-xs text-gray-400">SAP publicou 42 posts sobre IA aplicada a ERP no mês (3,2x a média), ativou 8 colaboradores no tema e atraiu 47 decisores de TI que não interagiram com TOTVS no mesmo período. A associação &ldquo;IA em ERP = SAP&rdquo; está se consolidando. Se não for contestada em 30 dias, pode virar permanente.</p>
                </div>
                <div>
                  <p className="text-sm text-white font-semibold">Oracle construindo autoridade em ERP Cloud sem resposta</p>
                  <p className="text-xs text-gray-400">Oracle publicou 18 posts sobre ERP Cloud Enterprise, todos com RER acima de 35%. O CEO fez um post provocativo elogiando a SAP que gerou 1.500 reações e posicionou a Oracle como voz madura no debate. A TOTVS não tem nenhum colaborador ativo publicando sobre cloud enterprise.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recomendações Estratégicas (unificadas) */}
        <section id="recomendacoes" ref={setRef("recomendacoes")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-white mb-4">Recomendações Estratégicas</h3>
          <div className="space-y-3">
            {[
              { id: 1, title: "Defender território IA+ERP", tag: "DEFENSIVA", tagColor: "text-red-400 bg-red-400/10 border-red-400/20", urgency: "alta urgência", desc: "Dennis publica tese sobre 'IA brasileira para gestão brasileira' + ativar Izabel Branco (Head de IA) como voz técnica complementar.", who: "Dennis + Izabel Branco + Marcelo Cosentino", details: "Tese: SAP está construindo a associação de que 'IA em ERP é coisa de plataforma global'. Se não respondermos em 30 dias, vira permanente.\n\nJustificativa: SAP cresceu 5% de SoL puxada por esse tema. 47 decisores de TI engajaram com eles, 0 conosco.\n\nTópicos sugeridos:\n• Casos reais de IA preditiva em clientes do varejo e indústria\n• Diferença entre 'IA como chatbot' e 'IA como inteligência de processo'\n• Limites honestos da IA em ERP — hype vs realidade\n• Soberania de dados: IA em servidor brasileiro" },
              { id: 2, title: "Case de IA preditiva em cliente do varejo", tag: "CONTEÚDO", tagColor: "text-blue-400 bg-blue-400/10 border-blue-400/20", urgency: "alta urgência", desc: "Como um cliente reduziu ruptura de estoque em X% usando IA preditiva da TOTVS. Case real com número fura narrativa abstrata da SAP.", who: "Diretor de Produto + cliente marcado no post", details: "Justificativa: SAP está todo discurso e nenhum case concreto no mês. Case real com número específico é a melhor resposta. Formato que gera confiança com buyers enterprise." },
              { id: 3, title: "Reforma tributária: 5 decisões que sua empresa precisa tomar", tag: "CONTEÚDO", tagColor: "text-blue-400 bg-blue-400/10 border-blue-400/20", urgency: "média urgência", desc: "Checklist de decisões fiscais-tributárias com prazo curto. Formato 'N coisas com prazo' converte bem em comentários.", who: "Ricardo Oliveira (Head Fiscal) + Dennis amplifica", details: "Justificativa: Duplicar aposta em pauta que já ganhamos (Dennis RER 51%). Formato de checklist com prazo gera urgência e engajamento de decisores financeiros." },
              { id: 4, title: "Responder Oracle em ERP Cloud Enterprise", tag: "OFENSIVA", tagColor: "text-amber-400 bg-amber-400/10 border-amber-400/20", urgency: "média urgência", desc: "Publicar cases reais de migração cloud em clientes enterprise brasileiros. Contestar narrativa da Oracle com dados concretos.", who: "Marcelo Cosentino (VP Tech) + cliente enterprise", details: "Tópicos sugeridos:\n• Diferenças estruturais entre ERP on-premise e cloud enterprise\n• Custos escondidos na migração com vendor lock-in\n• Cases reais de migração cloud em clientes brasileiros\n• Compliance e soberania de dados em ERP cloud" },
              { id: 5, title: "ERP para PME ≠ ERP enterprise menor", tag: "CONTEÚDO", tagColor: "text-blue-400 bg-blue-400/10 border-blue-400/20", urgency: "média urgência", desc: "Diferenças estruturais de produto, operação e custo. Entrar no território que Oracle construiu sem resposta.", who: "Ana Paula Motta (Dir. PMEs) + líder de cliente PME", details: "Justificativa: Oracle construiu 6 meses de autoridade no tema sem resposta nossa. Entrar agora corta crescimento deles e recupera território." },
              { id: 6, title: "IA em ERP: o que é real e o que é marketing", tag: "CONTEÚDO", tagColor: "text-blue-400 bg-blue-400/10 border-blue-400/20", urgency: "média urgência", desc: "Tese provocativa — ceticismo maduro que funciona com CIO/CTO. Responde ao aumento de 3,2x nos posts de IA da SAP.", who: "Marcelo Cosentino (VP Tech — reativação)", details: "Justificativa: Responde diretamente ao aumento de 3,2x nos posts de IA da SAP. Posicionamento de ceticismo maduro funciona com buyer técnico (CIO/CTO — público que não estamos capturando)." },
              { id: 7, title: "Manter cadência Reforma Tributária", tag: "CONSOLIDAÇÃO", tagColor: "text-green-400 bg-green-400/10 border-green-400/20", urgency: "baixa urgência", desc: "Atualizações mensais + checklists + série por setor. Território já dominado — manter, não intensificar.", who: "Ricardo Oliveira (Head Fiscal) + Dennis 1x/mês", details: "Tópicos sugeridos:\n• Atualizações mensais sobre regulamentação\n• Checklists de decisões com prazo\n• O que muda para cada setor (varejo, indústria, serviços)\n• Perguntas que os CFOs estão fazendo e respostas práticas" },
            ].map((rec) => (
              <div key={rec.id} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl font-black text-[#E91E8C]/20 leading-none shrink-0 w-6 text-center">{rec.id}</span>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white">{rec.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rec.tagColor}`}>{rec.tag} · {rec.urgency}</span>
                    </div>
                    <p className="text-xs text-gray-400">{rec.desc}</p>
                    <p className="text-xs text-gray-500"><strong className="text-gray-400">Quem publica:</strong> {rec.who}</p>
                    <Collapsible summary="Ver detalhes">
                      <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans">{rec.details}</pre>
                    </Collapsible>
                  </div>
                  <LikeDislike id={rec.id} votes={recVotes} setVotes={setRecVotes} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 italic mt-3">Lacunas não cobertas: ESG em gestão, Open Finance para ERP, IA para compliance. Monitorando para meses seguintes.</p>
        </section>

        {/* 3. Movimentos Estratégicos */}
        <section id="alerta" ref={setRef("alerta")} className="rounded-2xl bg-amber-500/5 border border-amber-500/30 p-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
            <AlertIcon size={22} className="text-amber-400" />
            Movimentos estratégicos observados
          </h3>
          <div className="space-y-4">
            {[
              { company: "SAP Brasil", text: "42 posts sobre IA Generativa aplicada a ERP no mês — 3,2x a média histórica. 8 colaboradores diferentes publicaram sobre o tema, incluindo 3 que raramente postam. Padrão típico de coordenação pré-lançamento." },
              { company: "SAP Brasil", text: "Ativação massiva de employee advocacy: 12 colaboradores além da C-suite publicaram no mês, o dobro do trimestre anterior. Indica programa estruturado em expansão." },
              { company: "SAP Brasil", text: "3 posts com menção direta a TOTVS em tom comparativo (\"diferente de ERPs locais...\"). Posicionamento agressivo que antes não existia — sinal de que nos veem como ameaça real." },
              { company: "Oracle", text: "CEO publicou post elogiando a SAP e provocando debate sobre IA em ERP — 1.500 reações, 3x a média. Movimento atípico que posiciona a Oracle como \"adulto na sala\" entre os dois líderes." },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${item.company === "SAP Brasil" ? "text-blue-400 bg-blue-400/10" : "text-orange-400 bg-orange-400/10"}`}>{item.company}</span>
                <p className="text-sm text-gray-300">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        </>)}

        {reportTab === "content" && (<>
        {/* 4. Ranking Competitivo */}
        <section id="ranking" ref={setRef("ranking")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-white mb-4">Ranking Competitivo</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[750px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2.5 pr-3 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase w-16">#</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Empresa</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">SoL <InfoTooltip text="Share of LinkedIn — percentual da presença qualificada da marca no LinkedIn do nicho." /></th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">RER <InfoTooltip text="Revenue Engagement Rate — % do engajamento que vem de decisores." /></th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">Posts <InfoTooltip text="Total de posts publicados no período." /></th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">Decisores <InfoTooltip text="Pessoas únicas do ICP que engajaram." /></th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Top Temas <InfoTooltip text="Temas com maior engajamento qualificado no período." /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { pos: "1", mov: "↑1", name: "SAP Brasil", sov: "41%", sovD: "+5%", rer: "45%", rerD: "+3%", posts: "142", postsD: "+48", dec: "287", decD: "+52%", temas: ["IA + ERP", "Cloud Enterprise", "Transformação Digital"], hl: false },
                  { pos: "2", mov: "↓1", name: "TOTVS", sov: "34%", sovD: "−3%", rer: "42%", rerD: "+5%", posts: "87", postsD: "−6", dec: "198", decD: "−8%", temas: ["Reforma Tributária", "Gestão Financeira", "Produto/Plataforma"], hl: true },
                  { pos: "3", mov: "=", name: "Oracle", sov: "18%", sovD: "+2%", rer: "38%", rerD: "+4%", posts: "58", postsD: "+12", dec: "94", decD: "+31%", temas: ["ERP Cloud Enterprise", "IA Generativa", "Migração Cloud"], hl: false },
                ].map((row) => (
                  <tr key={row.name} className={row.hl ? "bg-[#E91E8C]/[0.06]" : ""}>
                    <td className="py-3 pr-3">
                      <span className="text-xs font-black text-gray-400">{row.pos}</span>
                      <span className={`ml-1 text-[10px] font-bold ${row.mov.includes("↑") ? "text-green-400" : row.mov.includes("↓") ? "text-red-400" : "text-gray-600"}`}>{row.mov}</span>
                    </td>
                    <td className={`py-3 font-medium ${row.hl ? "text-[#E91E8C]" : "text-gray-300"}`}>{row.name}</td>
                    <td className="py-3 text-center text-gray-300">{row.sov} <span className={`text-[10px] ${row.sovD.startsWith("−") ? "text-red-400" : "text-green-400"}`}>({row.sovD})</span></td>
                    <td className="py-3 text-center text-gray-300">{row.rer} <span className="text-[10px] text-green-400">({row.rerD})</span></td>
                    <td className="py-3 text-center text-gray-300">{row.posts} <span className={`text-[10px] ${row.postsD.startsWith("−") ? "text-red-400" : "text-green-400"}`}>({row.postsD})</span></td>
                    <td className="py-3 text-center text-gray-300">{row.dec} <span className={`text-[10px] ${row.decD.startsWith("−") ? "text-red-400" : "text-green-400"}`}>({row.decD})</span></td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.temas.map((t) => (
                          <span key={t} className="text-[10px] text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 italic mt-4">SAP assume liderança pela primeira vez em 9 meses, puxada pela aposta em IA. Oracle cresce de forma consistente há 6 meses consecutivos.</p>
        </section>

        {/* 5. Análise de Conteúdo */}
        <section id="analise" ref={setRef("analise")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 space-y-6 scroll-mt-20">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Análise de Conteúdo por Empresa</h3>
            <p className="text-xs text-gray-500 mb-5">Composição do conteúdo publicado no mês</p>
            <div className="space-y-5">
              <ContentBar label="TOTVS — 87 posts" segments={[{ name: "🏢 Institucional", pct: 38, color: "bg-blue-500" }, { name: "💼 Vagas e RH", pct: 22, color: "bg-purple-500" }, { name: "📊 Produto e negócio", pct: 34, color: "bg-green-500" }, { name: "📎 Outros", pct: 6, color: "bg-gray-600" }]} />
              <ContentBar label="SAP Brasil — 142 posts" segments={[{ name: "🏢 Institucional", pct: 28, color: "bg-blue-500" }, { name: "💼 Vagas e RH", pct: 18, color: "bg-purple-500" }, { name: "📊 Produto e negócio", pct: 49, color: "bg-green-500" }, { name: "📎 Outros", pct: 5, color: "bg-gray-600" }]} />
              <ContentBar label="Oracle — 58 posts" segments={[{ name: "🏢 Institucional", pct: 20, color: "bg-blue-500" }, { name: "💼 Vagas e RH", pct: 12, color: "bg-purple-500" }, { name: "📊 Produto e negócio", pct: 62, color: "bg-green-500" }, { name: "📎 Outros", pct: 6, color: "bg-gray-600" }]} />
            </div>
            <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-400/90"><strong>&#9888; TOTVS publica 60% de conteúdo que não constrói pipeline</strong> (institucional + vagas). SAP está em 46%. Oracle em 32%.</p>
            </div>
          </div>

          {/* Posts em destaque com abas */}
          <div>
            <h4 className="text-base font-bold text-white mb-3">Posts em destaque do mês</h4>
            <CompanyTabs active={highlightTab} onChange={setHighlightTab} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Positivo */}
              <div className="bg-[#0B0B1A] border border-green-500/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><path d="M20 6 9 17l-5-5"/></svg>
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Destaque positivo</span>
                </div>
                <p className="text-sm font-semibold text-white">&ldquo;{posts.positive.title}&rdquo;</p>
                <p className="text-[10px] text-gray-500">{posts.positive.author}</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="text-green-400 font-bold bg-green-400/10 px-2 py-0.5 rounded-full">RER {posts.positive.rer}%</span>
                  <span>{posts.positive.reactions.toLocaleString("pt-BR")} reações</span>
                  <span>{posts.positive.comments} comentários</span>
                </div>
                <p className="text-xs text-gray-400"><strong className="text-white">Por que funciona:</strong> {posts.positive.why}</p>
              </div>

              {/* Negativo */}
              <div className="bg-[#0B0B1A] border border-red-500/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Destaque negativo</span>
                </div>
                <p className="text-sm font-semibold text-white">&ldquo;{posts.negative.title}&rdquo;</p>
                <p className="text-[10px] text-gray-500">{posts.negative.author}</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="text-red-400 font-bold bg-red-400/10 px-2 py-0.5 rounded-full">RER {posts.negative.rer}%</span>
                  <span>{posts.negative.reactions} reações</span>
                  <span>{posts.negative.comments} comentários</span>
                </div>
                <p className="text-xs text-gray-400"><strong className="text-white">Por que falhou:</strong> {posts.negative.why}</p>
              </div>

              {/* Inesperado */}
              <div className="bg-[#0B0B1A] border border-blue-500/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Destaque inesperado</span>
                </div>
                <p className="text-sm font-semibold text-white">&ldquo;{posts.unexpected.title}&rdquo;</p>
                <p className="text-[10px] text-gray-500">{posts.unexpected.author}</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span>{posts.unexpected.reactions.toLocaleString("pt-BR")} reações</span>
                  <span className="text-blue-400 font-bold">({posts.unexpected.detail})</span>
                </div>
                <p className="text-xs text-gray-400"><strong className="text-white">O que nos diz:</strong> {posts.unexpected.why}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Desempenho dos Colaboradores */}
        <section id="colaboradores" ref={setRef("colaboradores")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 space-y-4 scroll-mt-20">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Desempenho dos Colaboradores Monitorados</h3>
            <p className="text-xs text-gray-500 mb-3">Aderência e impacto de cada colaborador por categoria temática</p>
          </div>

          <CompanyTabs active={collabTab} onChange={setCollabTab} />

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[750px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Colaborador</th>
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">Posts</th>
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">% Engaj.</th>
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Categoria principal</th>
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">Aderência ICP</th>
                  <th className="py-2 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Destaque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {collabs.map((p) => (
                  <tr key={p.name} className={p.posts === 0 ? "opacity-50" : ""}>
                    <td className="py-2.5">
                      <span className="text-sm text-white font-medium">{p.name}</span>
                      <span className="text-[10px] text-gray-500 ml-1.5">{p.role}</span>
                    </td>
                    <td className="py-2.5 text-center text-gray-400">{p.posts}</td>
                    <td className="py-2.5 text-center text-gray-400">{p.engPct}</td>
                    <td className="py-2.5 text-gray-400 text-xs">{p.cat}</td>
                    <td className="py-2.5 text-center">
                      {p.posts === 0 ? (
                        <InactiveAlert tooltipText="Veja sugestões de conteúdo para reativar este colaborador na seção Sugestões de Conteúdos abaixo." />
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.badgeColor}`}>{p.badge}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-gray-500 text-xs">{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {collabTab === "TOTVS" && (
            <div className="space-y-3 mt-2">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-400/90"><strong>&#9888; Diagnóstico:</strong> 79% do engajamento concentrado em 2 pessoas. Categorias técnicas (IA, Cloud) sem representante ativo — justamente onde SAP está ganhando terreno.</p>
              </div>
              <div className="bg-[#E91E8C]/5 border border-[#E91E8C]/20 rounded-xl px-4 py-3">
                <p className="text-xs text-[#E91E8C] font-bold mb-2">&#127919; Oportunidade — colaboradores NÃO monitorados que já publicam:</p>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <p><strong className="text-white">Izabel Branco</strong> (Head de IA) — posta 3x/mês, ativa no tema IA+ERP <span className="text-amber-400">(território que estamos perdendo)</span></p>
                  <p><strong className="text-white">Ricardo Oliveira</strong> (Head Fiscal) — 2 posts/mês sobre reforma tributária</p>
                  <p><strong className="text-white">Ana Paula Motta</strong> (Dir. PMEs) — 4 posts/mês sobre PMEs</p>
                  <p><strong className="text-white">Fernando Gomes</strong> (Head CS) — 2 posts/mês com cases reais</p>
                </div>
              </div>
            </div>
          )}

          {collabTab === "SAP Brasil" && (
            <div className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl px-4 py-3 text-xs text-gray-400 mt-2">
              <p>Distribuição saudável: top-3 = <strong className="text-white">58% do engajamento</strong>. <strong className="text-white">12 colaboradores adicionais</strong> além da C-suite postam regularmente — programa de employee advocacy estruturado.</p>
            </div>
          )}

          {collabTab === "Oracle" && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400/90 mt-2">
              <p>Concentração extrema: CEO gera <strong>71% de todo o engajamento</strong>. Sem programa de advocacy visível — dependência total da voz do CEO.</p>
            </div>
          )}

          <div className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl px-4 py-3 text-xs text-gray-400 italic">
            SAP tem o programa de employee advocacy mais maduro do set — voz distribuída, reduz risco. TOTVS e Oracle são CEO-dependentes. Para a TOTVS: <strong className="text-white not-italic">risco</strong> (concentração) e <strong className="text-white not-italic">oportunidade</strong> (ativar 4 colaboradores = +30-40% SoL estimado).
          </div>
        </section>

        {/* 7. Decisores em Destaque */}
        <section id="decisores" ref={setRef("decisores")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 scroll-mt-20">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Decisores em Destaque</h3>
              <p className="text-xs text-gray-500">Principais decisores do ICP que interagiram com posts da TOTVS no mês</p>
            </div>
            <button
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 border border-[#1E1E3A] rounded-lg px-3 py-1.5 transition-colors shrink-0"
              title="Disponível no plano Professional"
              onClick={() => alert("Disponível no plano Professional")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[650px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Decisor</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Empresa</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Comportamento</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Setor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { name: "Alessandro Braga", role: "CFO", company: "Gerdau", behavior: "3 comentários em posts sobre reforma tributária", sector: "Indústria" },
                  { name: "Júlia Martins", role: "Controller", company: "Ambev", behavior: "Compartilhou 2 posts da TOTVS", sector: "Bebidas" },
                  { name: "Roberto Tavares", role: "Head Fiscal", company: "Vale", behavior: "5 curtidas em posts de reforma tributária", sector: "Mineração" },
                  { name: "Camila Duarte", role: "VP de TI", company: "Localiza", behavior: "2 comentários em post sobre cloud", sector: "Serviços" },
                  { name: "Eduardo Prado", role: "CIO", company: "Mercado Livre", behavior: "Curtiu post sobre integração ERP-CRM", sector: "Varejo" },
                  { name: "Mariana Souza", role: "Dir. Financeira", company: "Natura", behavior: "Compartilhou post sobre reforma tributária", sector: "Consumo" },
                  { name: "Paulo Ribeiro", role: "CFO", company: "Raízen", behavior: "2 curtidas e 1 comentário em post do Dennis", sector: "Energia" },
                  { name: "Luciana Marques", role: "Controller", company: "Magazine Luiza", behavior: "Comentou em post fiscal", sector: "Varejo" },
                ].map((d) => (
                  <tr key={d.name}>
                    <td className="py-2.5">
                      <a href="#" className="text-sm text-white font-medium hover:text-[#E91E8C] transition-colors">{d.name}</a>
                      <span className="text-[10px] text-gray-500 ml-1.5">{d.role}</span>
                    </td>
                    <td className="py-2.5 text-gray-300 text-sm">{d.company}</td>
                    <td className="py-2.5 text-gray-400 text-xs">{d.behavior}</td>
                    <td className="py-2.5 text-gray-500 text-xs">{d.sector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 italic mt-4">Padrão claro: decisores financeiros dominam nosso engajamento — 6 dos 8. Para capturar o buyer tecnológico, é preciso conteúdo que fale diretamente com CIO/CTO.</p>
        </section>
        </>)}

        {reportTab === "analysis" && (<>
        {/* Tradução para Negócio */}
        <section id="traducao" ref={setRef("traducao")} className="rounded-2xl bg-gradient-to-br from-[#E91E8C]/10 to-[#C724D1]/10 border border-[#E91E8C]/20 p-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-white mb-4">O que esses números significam para a TOTVS</h3>
          <div className="space-y-2.5 text-sm text-gray-300">
            <p><strong className="text-white">142 decisores engajados</strong> representam <strong className="text-white">47 contas</strong> do seu ICP Enterprise — destas, 12 já são clientes e 35 são contas-alvo.</p>
            <p>O <strong className="text-white">RER de 42%</strong> está <strong className="text-white">14% acima da média do setor</strong> de software B2B no Brasil.</p>
            <p>Os <strong className="text-white">5 decisores que engajaram com a SAP</strong> movimentam <strong className="text-white">~R$ 80M em budget anual de tecnologia</strong>.</p>
            <p>A perda de <strong className="text-white">3% de SoL</strong> em IA+ERP equivale a <strong className="text-white">~20 oportunidades de top-of-funnel</strong> deixadas na mesa.</p>
          </div>
        </section>

        {/* 11. CTA */}
        <div className="text-center py-6 space-y-4">
          <p className="text-lg font-bold text-white max-w-2xl mx-auto">
            Sua marca está perdendo espaço em temas estratégicos. E se você pudesse ativar dezenas de vozes do LinkedIn que já falam direto com seu ICP?
          </p>
          <p className="text-sm text-gray-400 max-w-xl mx-auto">
            Com a Busca da BubbleIn, você encontra creators B2B rankeados pela composição da audiência — não por volume de seguidores.
          </p>
          <Link
            href="/share-of-linkedin#planos"
            className="inline-block bg-gradient-to-r from-[#E91E8C] to-[#C724D1] text-white font-semibold px-8 py-3.5 rounded-full text-sm hover:opacity-90 transition-opacity"
          >
            Encontrar creators para minha campanha
          </Link>
          <p className="text-xs text-gray-600">Também disponível: receber o relatório automaticamente no primeiro dia útil de cada mês por e-mail.</p>
        </div>
        </>)}
      </div>
    </div>
    )}
    </div>
  );
}

/* ========== MAIN PAGE ========== */
export default function ShareOfLinkedInExemploPage() {
  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-6">
        {/* Back link */}
        <Link href="/share-of-linkedin" className="text-xs text-gray-400 hover:text-[#E91E8C] transition-colors">
          ← Voltar para Share of LinkedIn
        </Link>

        <NewReport />

        {/* Footer */}
        <footer className="border-t border-[#1E1E3A] py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Image src="/logo.png" alt="BubbleIn" width={100} height={36} />
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span>&copy; {new Date().getFullYear()} BubbleIn. Todos os direitos reservados.</span>
              <span className="text-gray-700">·</span>
              <a href="/termos-de-uso" className="hover:text-[#E91E8C] transition-colors">Termos de Uso</a>
              <span className="text-gray-700">·</span>
              <a href="/politica-de-privacidade" className="hover:text-[#E91E8C] transition-colors">Política de Privacidade</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
