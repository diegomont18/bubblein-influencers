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

const NAV_SECTIONS = [
  { id: "insights", label: "Insights" },
  { id: "alerta", label: "Alerta" },
  { id: "ranking", label: "Ranking" },
  { id: "analise", label: "Análise de Conteúdo" },
  { id: "colaboradores", label: "Colaboradores" },
  { id: "decisores", label: "Decisores" },
  { id: "recomendacoes", label: "Recomendações" },
  { id: "marca", label: "Marca no LinkedIn" },
  { id: "traducao", label: "Tradução Negócio" },
];

function ReportNav({ activeId }: { activeId: string }) {
  return (
    <nav className="hidden lg:block sticky top-24 space-y-1 pr-4">
      {NAV_SECTIONS.map((s) => (
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
          { label: "Share of Voice", value: "18%", color: "border-[#E91E8C]/20", valueColor: "text-[#E91E8C]", sub: "Líder: TechCloud Solutions 32%" },
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
    { name: "Dennis Herszkowicz", role: "CEO", posts: 12, engPct: "52%", cat: "Reforma Tributária", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "RER 51% no post sobre reforma" },
    { name: "Juliano Tubino", role: "VP Comercial", posts: 8, engPct: "19%", cat: "Produto/Plataforma", badge: "Média", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Tom institucional reduz impacto" },
    { name: "Gustavo Bastos", role: "CFO", posts: 4, engPct: "8%", cat: "Gestão Financeira", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Engaja CFOs e Controllers" },
    { name: "Marcelo Cosentino", role: "VP Tecnologia", posts: 0, engPct: "0%", cat: "—", badge: "Inativo 45d", badgeColor: "text-gray-500 bg-gray-500/10", note: "Voz técnica ausente (CIO/CTO)" },
    { name: "Sergio Campos", role: "VP Produto", posts: 0, engPct: "0%", cat: "—", badge: "Inativo 60d", badgeColor: "text-gray-500 bg-gray-500/10", note: "Território de produto sem voz" },
  ],
  "SAP Brasil": [
    { name: "Maria Santos", role: "VP Inovação", posts: 15, engPct: "22%", cat: "IA + Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Principal voz em IA" },
    { name: "Carlos Ferreira", role: "Dir. Produto", posts: 12, engPct: "18%", cat: "Produto", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Conteúdo técnico consistente" },
    { name: "Ana Rodrigues", role: "Head Marketing", posts: 10, engPct: "15%", cat: "Institucional", badge: "Média", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Foco institucional, baixo RER" },
    { name: "Pedro Almeida", role: "Dir. Engenharia", posts: 8, engPct: "13%", cat: "Tech/Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Engaja público técnico CTO" },
    { name: "Lucas Mendes", role: "Head CS", posts: 6, engPct: "10%", cat: "Cases", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Cases reais com clientes" },
  ],
  Oracle: [
    { name: "Roberto Lima", role: "CEO", posts: 14, engPct: "71%", cat: "ERP Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Concentração extrema de engajamento" },
    { name: "Fernanda Costa", role: "Dir. Comercial", posts: 3, engPct: "18%", cat: "Vendas", badge: "Média", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Poucos posts, foco comercial" },
    { name: "André Souza", role: "Head Tech", posts: 1, engPct: "11%", cat: "Cloud", badge: "Baixa", badgeColor: "text-red-400 bg-red-400/10", note: "Quase inativo, baixa aderência" },
  ],
};

/* ========== NEW REPORT ========== */
function NewReport() {
  const [highlightTab, setHighlightTab] = useState("TOTVS");
  const [collabTab, setCollabTab] = useState("TOTVS");
  const [activeSection, setActiveSection] = useState("insights");

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
    <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-8">
      <ReportNav activeId={activeSection} />

      <div className="space-y-8 min-w-0">

        {/* 1. Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">Relatório Mensal — Share of LinkedIn</h1>
            <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full shrink-0">exemplo</span>
          </div>
          <p className="text-sm text-gray-400">TOTVS · Março de 2026 · Set competitivo: SAP Brasil, Oracle</p>
          <p className="text-sm text-gray-500 italic mt-2">&ldquo;Mês de perda de terreno em IA+ERP, defesa consistente em reforma tributária.&rdquo;</p>
        </div>

        {/* 2. Insights Estratégicos */}
        <section id="insights" ref={setRef("insights")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 scroll-mt-20">
          {/* KPIs no topo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Share of Voice", value: "34%", delta: "−3%", neg: true, tip: "Percentual da conversa total do nicho capturada pela empresa. Calculado como: (engajamento qualificado dos perfis da empresa ÷ engajamento qualificado total do set competitivo) × 100." },
              { label: "RER", value: "42%", delta: "+5%", neg: false, tip: "Revenue Engagement Rate — percentual do engajamento total que vem de decisores do seu ICP (C-level, diretores, heads). Benchmark do setor de software B2B no Brasil: 28%." },
              { label: "Posts analisados", value: "187", delta: "−6", neg: true, tip: "Total de posts publicados no período pelos perfis monitorados (oficial + colaboradores). Exclui reposts sem comentário." },
              { label: "Decisores engajados", value: "142", delta: "−8%", neg: true, tip: "Pessoas únicas do ICP (C-level, diretores, heads) que curtiram, comentaram ou compartilharam pelo menos um post no período. Deduplicado por pessoa." },
            ].map((k) => (
              <div key={k.label} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl p-4">
                <p className="text-[10px] font-bold tracking-[0.15em] text-gray-500 uppercase mb-1">
                  {k.label}
                  <InfoTooltip text={k.tip} />
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">{k.value}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${k.neg ? "text-red-400 bg-red-400/10" : "text-green-400 bg-green-400/10"}`}>{k.delta}</span>
                </div>
              </div>
            ))}
          </div>

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
                  <p className="text-sm text-white font-semibold">O que defendemos</p>
                  <p className="text-xs text-gray-400">Território de reforma tributária segue nosso. Post do Dennis Herszkowicz foi o mais engajado do mês entre os três (RER 51%).</p>
                </div>
                <div>
                  <p className="text-sm text-white font-semibold">Buyer financeiro dominado</p>
                  <p className="text-xs text-gray-400">Ganhando no buyer financeiro (CFO, Controller). 6 dos 8 decisores engajados são do setor financeiro.</p>
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
                  <p className="text-sm text-white font-semibold">Perda em IA+ERP</p>
                  <p className="text-xs text-gray-400">SAP assumiu liderança em IA aplicada a ERP (−3% de SoV). Triplicou frequência de posts e atraiu 47 decisores de TI que não tocamos.</p>
                </div>
                <div>
                  <p className="text-sm text-white font-semibold">Ameaça silenciosa — Oracle</p>
                  <p className="text-xs text-gray-400">Oracle construiu autoridade em &ldquo;ERP Cloud Enterprise&rdquo; sem resposta nossa — 18 posts no mês, todos acima de 35% de RER.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Sinal de Alerta */}
        <section id="alerta" ref={setRef("alerta")} className="rounded-2xl bg-amber-500/5 border border-amber-500/30 p-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
            <AlertIcon size={22} className="text-amber-400" />
            Movimento incomum — SAP Brasil
          </h3>
          <div className="space-y-2 text-sm text-gray-300">
            <p><strong className="text-white">O que observamos:</strong> 42 posts sobre IA Generativa aplicada a ERP no mês — <strong className="text-amber-400">3,2x a média histórica</strong> da SAP no tema.</p>
            <p><strong className="text-white">Quem está publicando:</strong> 8 colaboradores diferentes postaram sobre IA, incluindo 3 que raramente postam (Diretor de Produto, VP de Inovação, Head de Customer Success).</p>
            <p><strong className="text-white">Padrão típico de:</strong> semana pré-lançamento ou pré-evento. Coordenação de topo.</p>
            <p><strong className="text-white">Recomendação:</strong> monitorar os próximos 30 dias de perto.</p>
          </div>
        </section>

        {/* 4. Ranking Competitivo */}
        <section id="ranking" ref={setRef("ranking")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-white mb-4">Ranking Competitivo</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[750px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2.5 pr-3 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase w-16">#</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Empresa</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">SoV <InfoTooltip text="Share of Voice — percentual da conversa total do nicho." /></th>
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
            SAP tem o programa de employee advocacy mais maduro do set — voz distribuída, reduz risco. TOTVS e Oracle são CEO-dependentes. Para a TOTVS: <strong className="text-white not-italic">risco</strong> (concentração) e <strong className="text-white not-italic">oportunidade</strong> (ativar 4 colaboradores = +30-40% SoV estimado).
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

        {/* 8. Recomendações Estratégicas */}
        <section id="recomendacoes" ref={setRef("recomendacoes")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 space-y-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-white">Recomendações Estratégicas</h3>

          {/* Estratégica */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Estratégica</span>
            </div>
            <div className="bg-[#0B0B1A] border border-purple-500/20 rounded-xl p-5 space-y-3">
              <p className="text-base font-bold text-white">Defender o território de IA+ERP antes que vire categoria da SAP</p>
              <p className="text-sm text-gray-400"><strong className="text-white">Recomendação:</strong> Dennis Herszkowicz publica tese sobre &ldquo;IA brasileira para gestão brasileira&rdquo; + ativar Izabel Branco (Head de IA, não monitorada) como voz técnica complementar.</p>
              <Collapsible summary="Ver detalhes (tese e justificativa)">
                <div className="space-y-2 text-sm text-gray-400">
                  <p><strong className="text-white">Tese:</strong> SAP está construindo a associação de que &ldquo;IA em ERP é coisa de plataforma global&rdquo;. Se não respondermos em 30 dias, a associação vira permanente no mercado.</p>
                  <p><strong className="text-white">Justificativa:</strong> SAP cresceu 5% de SoV no mês puxada por esse tema. 47 decisores de TI engajaram com eles, 0 conosco. É o território com maior custo de perda.</p>
                </div>
              </Collapsible>
            </div>
          </div>

          {/* Sugestões de Conteúdos */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Sugestões de Conteúdos</span>
            </div>
            <div className="space-y-3">
              {[
                { num: "01", tema: "Case de IA preditiva em cliente do varejo", desc: "Como um cliente reduziu ruptura de estoque em X% usando IA preditiva da TOTVS", just: "SAP está todo discurso e nenhum case concreto no mês. Case real com número fura narrativa abstrata.", who: "Diretor de Produto + cliente marcado no post" },
                { num: "02", tema: "Reforma tributária: 5 decisões que sua empresa precisa tomar ainda em abril", desc: "Checklist de decisões fiscais-tributárias com prazo curto", just: "Duplicar aposta em pauta que já ganhamos (Dennis RER 51%). Formato \"N coisas com prazo\" converte bem.", who: "Ricardo Oliveira (Head Fiscal) + Dennis amplifica" },
                { num: "03", tema: "Por que ERP para PME não é \"ERP enterprise menor\"", desc: "Diferenças estruturais de produto, operação e custo entre ERP enterprise e ERP PME", just: "Oracle construiu 6 meses de autoridade no tema sem resposta nossa. Entrar agora corta crescimento.", who: "Ana Paula Motta (Dir. PMEs) + líder de cliente PME" },
                { num: "04", tema: "IA em ERP: o que é real e o que é marketing", desc: "Tese provocativa separando aplicações reais de IA em ERP das \"prometidas mas não entregues\"", just: "Responde ao aumento de 3,2x nos posts de IA da SAP. Ceticismo maduro funciona com CIO/CTO.", who: "Marcelo Cosentino (VP Tecnologia — reativação)" },
              ].map((p) => (
                <div key={p.num} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl font-black text-[#E91E8C]/20 leading-none shrink-0">{p.num}</span>
                    <div className="space-y-1.5 flex-1">
                      <p className="text-sm font-bold text-white">{p.tema}</p>
                      <p className="text-xs text-gray-400">{p.desc}</p>
                      <p className="text-xs text-gray-500"><strong className="text-gray-400">Quem publica:</strong> {p.who}</p>
                      <Collapsible summary="Ver justificativa">
                        <p className="text-xs text-green-400/80">{p.just}</p>
                      </Collapsible>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. Recomendações para a Marca no LinkedIn */}
        <section id="marca" ref={setRef("marca")} className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6 space-y-4 scroll-mt-20">
          <h3 className="text-lg font-bold text-white">Recomendações para a Marca no LinkedIn</h3>

          {[
            {
              title: "IA + ERP",
              tag: "DEFENSIVA",
              urgency: "alta urgência",
              tagColor: "text-red-400 bg-red-400/10 border-red-400/20",
              desc: "Território em disputa ativa. SAP liderando a narrativa com 3,2x mais posts que a média. Custo de perder: alto (categoria inteira vira SAP).",
              topics: [
                "Casos reais de IA preditiva em clientes do varejo e indústria (com número)",
                "Diferença entre \"IA como chatbot\" e \"IA como inteligência de processo\"",
                "Limites honestos da IA em ERP — o que é hype e o que é realidade",
                "Soberania de dados: por que empresa brasileira deveria preferir IA em servidor brasileiro",
              ],
              who: "Dennis (tese), Marcelo Cosentino (técnico), Izabel Branco (aprofundamento), cliente (case)",
            },
            {
              title: "ERP Cloud Enterprise",
              tag: "OFENSIVA",
              urgency: "média urgência",
              tagColor: "text-amber-400 bg-amber-400/10 border-amber-400/20",
              desc: "Oracle construiu 6 meses de autoridade sozinha nesse território. TOTVS tem cases reais de migração cloud em clientes enterprise.",
              topics: [
                "Diferenças estruturais entre ERP on-premise e ERP cloud para enterprise",
                "Custos escondidos na migração cloud com vendor lock-in",
                "Cases reais de migração cloud em clientes enterprise brasileiros",
                "Compliance e soberania de dados em ERP cloud para o mercado brasileiro",
              ],
              who: "Marcelo Cosentino (VP Tech) + cliente enterprise + líder de produto",
            },
            {
              title: "Reforma Tributária",
              tag: "CONSOLIDAÇÃO",
              urgency: "baixa urgência",
              tagColor: "text-green-400 bg-green-400/10 border-green-400/20",
              desc: "Território já dominado pela TOTVS (Dennis com RER 51%). Manter cadência, não precisa intensificar.",
              topics: [
                "Atualizações mensais sobre o andamento da regulamentação",
                "Checklists de decisões com prazo",
                "O que muda para cada setor (séries: varejo, indústria, serviços)",
                "Perguntas que os CFOs estão fazendo e respostas práticas",
              ],
              who: "Ricardo Oliveira (Head Fiscal) + Dennis amplifica 1x/mês",
            },
          ].map((aposta) => (
            <div key={aposta.title} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-white">{aposta.title}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${aposta.tagColor}`}>{aposta.tag} · {aposta.urgency}</span>
              </div>
              <p className="text-sm text-gray-400">{aposta.desc}</p>
              <p className="text-xs text-gray-500"><strong className="text-gray-400">Quem publica:</strong> {aposta.who}</p>
              <Collapsible summary={`Ver tópicos sugeridos (${aposta.topics.length})`}>
                <ul className="space-y-1">
                  {aposta.topics.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-xs text-gray-400">
                      <span className="text-[#E91E8C] mt-0.5 shrink-0">•</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </Collapsible>
            </div>
          ))}

          <p className="text-xs text-gray-600 italic">Lacunas não cobertas: ESG em gestão, Open Finance para ERP, IA para compliance. Monitorando para meses seguintes.</p>
        </section>

        {/* 10. Tradução para Negócio */}
        <section id="traducao" ref={setRef("traducao")} className="rounded-2xl bg-gradient-to-br from-[#E91E8C]/10 to-[#C724D1]/10 border border-[#E91E8C]/20 p-6 scroll-mt-20">
          <h3 className="text-lg font-bold text-white mb-4">O que esses números significam para a TOTVS</h3>
          <div className="space-y-2.5 text-sm text-gray-300">
            <p><strong className="text-white">142 decisores engajados</strong> representam <strong className="text-white">47 contas</strong> do seu ICP Enterprise — destas, 12 já são clientes e 35 são contas-alvo.</p>
            <p>O <strong className="text-white">RER de 42%</strong> está <strong className="text-white">14% acima da média do setor</strong> de software B2B no Brasil.</p>
            <p>Os <strong className="text-white">5 decisores que engajaram com a SAP</strong> movimentam <strong className="text-white">~R$ 80M em budget anual de tecnologia</strong>.</p>
            <p>A perda de <strong className="text-white">3% de SoV</strong> em IA+ERP equivale a <strong className="text-white">~20 oportunidades de top-of-funnel</strong> deixadas na mesa.</p>
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
      </div>
    </div>
  );
}

/* ========== MAIN PAGE ========== */
export default function ShareOfLinkedInExemploPage() {
  const [tab, setTab] = useState<"new" | "old">("new");

  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-6">
        {/* Back link */}
        <Link href="/share-of-linkedin" className="text-xs text-gray-400 hover:text-[#E91E8C] transition-colors">
          ← Voltar para Share of LinkedIn
        </Link>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#12122A] border border-[#1E1E3A] rounded-full p-1 w-fit">
          <button
            onClick={() => setTab("new")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${tab === "new" ? "bg-gradient-to-r from-[#E91E8C] to-[#C724D1] text-white" : "text-gray-400 hover:text-white"}`}
          >
            Novo
          </button>
          <button
            onClick={() => setTab("old")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${tab === "old" ? "bg-[#1E1E3A] text-white" : "text-gray-400 hover:text-white"}`}
          >
            Old
          </button>
        </div>

        {/* Content */}
        {tab === "new" ? <NewReport /> : <OldReport />}

        {/* Footer */}
        <footer className="border-t border-[#1E1E3A] py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Image src="/logo.png" alt="BubbleIn" width={100} height={36} />
            <p className="text-sm text-gray-600">&copy; {new Date().getFullYear()} BubbleIn. Todos os direitos reservados.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
