"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/navbar";

const ICONS: Record<string, React.ReactNode> = {
  eye: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  search: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  trending: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  lightbulb: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" /><path d="M10 22h4" />
    </svg>
  ),
  target: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  megaphone: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
  calendar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  folder: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  ),
  share: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
};

function Icon({ name, size = 40, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <div
      className={`bg-gradient-accent rounded-xl flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {ICONS[name]}
    </div>
  );
}

function PlanTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-4 h-4 rounded-full bg-gray-700/50 text-gray-400 hover:bg-gray-600 hover:text-white flex items-center justify-center text-[9px] font-bold leading-none transition-colors"
        aria-label="Mais informações"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-6 top-1/2 -translate-y-1/2 w-56 rounded-lg bg-[#0B0B1A] border border-[#E91E8C]/30 px-3 py-2 text-[11px] text-gray-300 font-normal normal-case tracking-normal shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        >
          {text}
        </span>
      )}
    </span>
  );
}

const AUDIENCE_TAGS = [
  "Marketing B2B",
  "Growth",
  "Founders",
  "Vendas & SDRs",
  "Agências B2B",
  "Consultores",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <Navbar />

      {/* 1. Hero */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
        <div className="absolute -top-20 right-[10%] w-72 h-72 bg-[#E91E8C]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-[5%] w-60 h-60 bg-[#C724D1]/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <p className="inline-block text-xs md:text-sm font-semibold uppercase tracking-widest text-[#E91E8C] mb-5 border border-[#E91E8C]/30 rounded-full px-4 py-1.5">
            Plataforma B2B para LinkedIn
          </p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Impulsione sua empresa B2B no{" "}
            <span className="text-gradient">LinkedIn</span> com inteligência
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-4">
            Mapeie o cenário competitivo do seu nicho e amplifique sua presença com os creators B2B certos — tudo em uma só plataforma.
          </p>
          <p className="text-sm text-gray-500 mb-10">
            Share of LinkedIn + Inteligência de Casting de Influencers em um único plano.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="#planos"
              className="inline-block bg-gradient-accent text-white font-semibold px-8 py-4 rounded-full text-sm hover:opacity-90 transition-opacity shadow-[0_4px_24px_rgba(233,30,140,0.3)]"
            >
              Ver planos
            </a>
            <Link
              href="/share-of-linkedin-exemplo"
              className="inline-flex items-center gap-2 border-2 border-[#E91E8C]/40 text-[#E91E8C] font-semibold px-8 py-4 rounded-full text-sm hover:bg-[#E91E8C]/10 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              Ver exemplo de relatório
            </Link>
          </div>
        </div>
      </section>

      {/* 2. O problema */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                O LinkedIn B2B é onde seus decisores estão — mas operar nele é um{" "}
                <span className="text-gradient">ponto cego</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Sua empresa publica, mas provavelmente sem saber o que concorrentes estão fazendo, quais temas engajam decisores do seu nicho ou quais creators B2B amplificam as pautas que importam.
              </p>
              <p className="text-gray-400 leading-relaxed">
                Enquanto isso, seu mercado é moldado por vozes que você nem monitora.
              </p>
            </div>
            <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <Icon name="check" size={32} className="rounded-full mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Concorrentes publicam sem você saber</p>
                    <p className="text-gray-500 text-sm">Posts que engajam decisores do seu mercado passam despercebidos</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Icon name="check" size={32} className="rounded-full mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Creators B2B difíceis de encontrar</p>
                    <p className="text-gray-500 text-sm">Não existe uma base curada de influencers B2B por nicho e relevância</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Icon name="check" size={32} className="rounded-full mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Decisões por intuição, não por dados</p>
                    <p className="text-gray-500 text-sm">Conteúdo e parcerias escolhidos sem saber o que de fato gera impacto</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. A plataforma: overview das 2 funcionalidades */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute top-40 left-[10%] w-80 h-80 bg-[#E91E8C]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#E91E8C] mb-3">
              A plataforma
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Primeiro você <span className="text-gradient">mapeia</span>.<br />
              Depois você <span className="text-gradient">amplifica</span>.
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Duas funcionalidades que trabalham juntas: uma te dá o diagnóstico do seu mercado, a outra te dá os meios para agir sobre ele.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-16 items-stretch relative">
            {/* Seta de conexão */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-gradient-accent items-center justify-center shadow-[0_0_30px_rgba(233,30,140,0.4)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
              </svg>
            </div>

            {/* Card 1: Share of LinkedIn */}
            <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-8 md:p-10 hover:border-[#E91E8C]/30 transition-colors flex flex-col">
              <div className="flex items-center gap-4 mb-5">
                <span className="text-4xl font-bold text-gradient">1</span>
                <Icon name="eye" size={44} />
              </div>
              <h3 className="text-2xl font-bold mb-3">Share of LinkedIn</h3>
              <p className="text-[#E91E8C]/90 text-sm font-medium mb-4 uppercase tracking-wide">
                Mapeie o cenário competitivo
              </p>
              <p className="text-gray-400 leading-relaxed mb-6 flex-1">
                Rastreia os executivos da sua empresa e dos concorrentes no LinkedIn. Identifica o que publicam, quais temas engajam decisores do seu nicho e onde estão as lacunas de conteúdo. Entrega recomendações estratégicas toda semana.
              </p>
              <Link
                href="/share-of-linkedin"
                className="inline-flex items-center gap-2 text-[#E91E8C] font-semibold text-sm hover:text-[#C724D1] transition-colors"
              >
                Saiba mais
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </Link>
            </div>

            {/* Card 2: Casting */}
            <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-8 md:p-10 hover:border-[#C724D1]/30 transition-colors flex flex-col">
              <div className="flex items-center gap-4 mb-5">
                <span className="text-4xl font-bold text-gradient">2</span>
                <Icon name="search" size={44} />
              </div>
              <h3 className="text-2xl font-bold mb-3">Inteligência de Casting</h3>
              <p className="text-[#C724D1]/90 text-sm font-medium mb-4 uppercase tracking-wide">
                Amplifique com os creators certos
              </p>
              <p className="text-gray-400 leading-relaxed mb-6 flex-1">
                Com o mapa em mãos, encontra os creators B2B ideais para amplificar sua voz. Busca semântica com IA, ranqueamento por relevância, frequência de publicação e qualidade de audiência. Organiza tudo em campanhas exportáveis.
              </p>
              <Link
                href="/auth?redirectUrl=/casting"
                className="inline-flex items-center gap-2 text-[#C724D1] font-semibold text-sm hover:text-[#E91E8C] transition-colors"
              >
                Começar agora
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Share of LinkedIn em detalhe */}
      <section id="share-of-linkedin" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#E91E8C] mb-3">
              Passo 1 — O diagnóstico
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              O que você <span className="text-gradient">descobre</span> com Share of LinkedIn
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Um retrato vivo do LinkedIn do seu mercado — atualizado toda semana, sem planilhas nem garimpo manual.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: "users",
                title: "Mapa de executivos",
                description: "Quem publica ativamente na sua empresa e nos concorrentes — e quanto cada voz pesa no LinkedIn do nicho.",
              },
              {
                icon: "trending",
                title: "Engajamento com decisores",
                description: "RER (Revenue Engagement Rate): quais posts geram reação real de decisores, não só curtidas vazias.",
              },
              {
                icon: "lightbulb",
                title: "Lacunas de conteúdo",
                description: "Temas relevantes no seu nicho que ninguém está abordando com profundidade — suas oportunidades de posicionamento.",
              },
              {
                icon: "calendar",
                title: "Recomendações semanais",
                description: "A IA analisa tudo e entrega um plano de conteúdo toda semana, com justificativa e referências do seu mercado.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-6 hover:border-[#E91E8C]/30 transition-colors"
              >
                <div className="mb-4">
                  <Icon name={c.icon} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{c.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{c.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-500 italic max-w-xl mx-auto">
              Com o mapa em mãos, chega a hora de ampliar sua presença onde ela falta.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Casting em detalhe */}
      <section id="casting" className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute top-40 right-[5%] w-80 h-80 bg-[#C724D1]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#C724D1] mb-3">
              Passo 2 — A amplificação
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Encontre os <span className="text-gradient">creators B2B</span> certos para ocupar os temas que importam
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Com os temas e lacunas identificados pelo Share of LinkedIn, use a inteligência de casting para achar as vozes que vão amplificar sua marca exatamente onde você precisa.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: "search",
                title: "Busca semântica com IA",
                description: "Busque creators por tema, não só por palavra-chave. A IA entende o contexto do seu nicho e retorna perfis relevantes de verdade.",
              },
              {
                icon: "target",
                title: "Ranqueamento por relevância",
                description: "Score composto (relevância 60% + frequência de publicação 25% + audiência 15%) traz os creators certos no topo.",
              },
              {
                icon: "folder",
                title: "Organização em campanhas",
                description: "Salve buscas em listas de casting nomeadas, compare candidatos e construa uma pipeline de parcerias.",
              },
              {
                icon: "share",
                title: "Exportação e compartilhamento",
                description: "Exporte listas, compartilhe via link público com o time ou cliente e acelere a decisão.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-6 hover:border-[#C724D1]/30 transition-colors"
              >
                <div className="mb-4">
                  <Icon name={c.icon} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{c.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{c.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 bg-gradient-to-br from-[#E91E8C]/10 to-[#C724D1]/10 border border-[#E91E8C]/20 rounded-2xl p-6 md:p-8 text-center max-w-3xl mx-auto">
            <p className="text-gray-300">
              <strong className="text-white">3 créditos = 1 influencer encontrado.</strong>{" "}
              Créditos já inclusos no seu plano da plataforma — renovam todo mês.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Para quem é */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Para empresas que querem <span className="text-gradient">dominar</span> o LinkedIn B2B
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10">
            Se sua empresa vende para outras empresas e precisa estar na frente de decisores, a Bubble In foi feita para você.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {AUDIENCE_TAGS.map((tag) => (
              <span
                key={tag}
                className="bg-[#12122A] border border-[#1E1E3A] rounded-full px-5 py-2 text-sm text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Planos */}
      <section id="planos" className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute top-20 left-[15%] w-80 h-80 bg-[#E91E8C]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Um plano, a <span className="text-gradient">plataforma inteira</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Todos os planos incluem Share of LinkedIn e créditos para casting. Cancele quando quiser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Starter */}
            <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-8 hover:border-[#E91E8C]/20 transition-colors flex flex-col">
              <p className="text-sm text-gray-400 font-medium mb-2">Starter</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-white">R$199</span>
                <span className="text-gray-500 text-sm">/mês</span>
              </div>
              <p className="text-gray-500 text-sm mb-8">Comece a enxergar seu mercado</p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  { text: "Sua marca + 1 concorrente", sub: "Através dos colaboradores de ambos", tip: "A análise de cada empresa é feita através dos posts de seus colaboradores no LinkedIn — rastreamos o que publicam e como decisores reagem." },
                  { text: "4 colaboradores rastreados", tip: "Colaboradores da sua empresa e do concorrente que publicam ativamente. No LinkedIn, a presença de uma empresa é a soma das vozes dos seus colaboradores." },
                  { text: "2 influencers rastreados", tip: "Influencers B2B do seu nicho que publicam conteúdo relevante. Identificamos quem tem maior impacto entre decisores do seu mercado." },
                  { text: "9 créditos/mês", tip: "Use créditos para extrair leads (1 crédito cada) ou encontrar novos influencers (3 créditos cada). Créditos do plano renovam mensalmente." },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-3 text-sm text-gray-300">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E91E8C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M20 6 9 17l-5-5" /></svg>
                    <span>
                      {f.text}<PlanTooltip text={f.tip} />
                      {"sub" in f && f.sub && <span className="block text-xs text-[#E91E8C]/80 mt-0.5">{f.sub}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth?redirectUrl=/casting/share-of-linkedin"
                className="w-full py-3.5 rounded-full border border-[#E91E8C]/40 text-[#E91E8C] font-semibold text-sm hover:bg-[#E91E8C]/10 transition-colors text-center"
              >
                Começar agora
              </Link>
            </div>

            {/* Professional — highlighted */}
            <div className="bg-[#12122A] border-2 border-[#E91E8C]/60 rounded-2xl p-8 relative md:scale-105 shadow-[0_0_40px_rgba(233,30,140,0.1)] flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-accent text-white text-xs font-bold px-4 py-1 rounded-full">Mais popular</span>
              </div>
              <p className="text-sm text-[#E91E8C] font-medium mb-2">Professional</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-white">R$499</span>
                <span className="text-gray-500 text-sm">/mês</span>
              </div>
              <p className="text-gray-500 text-sm mb-8">Domine a estratégia do seu nicho</p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  { text: "Sua marca + 3 concorrentes", sub: "Através dos colaboradores de ambos", tip: "A análise de cada empresa é feita através dos posts de seus colaboradores no LinkedIn — rastreamos o que publicam e como decisores reagem." },
                  { text: "16 colaboradores rastreados", tip: "Colaboradores da sua empresa e de cada concorrente que publicam ativamente. São eles que representam a voz da empresa no LinkedIn — rastreamos seus posts e engajamento com decisores." },
                  { text: "4 influencers rastreados", tip: "Influencers B2B do seu nicho. Veja o que publicam, quais temas abordam e como decisores reagem ao conteúdo deles." },
                  { text: "24 créditos/mês", tip: "Use créditos para extrair leads (1 crédito cada) ou encontrar novos influencers (3 créditos cada). Créditos do plano renovam mensalmente." },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-3 text-sm text-gray-300">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E91E8C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M20 6 9 17l-5-5" /></svg>
                    <span>
                      {f.text}<PlanTooltip text={f.tip} />
                      {"sub" in f && f.sub && <span className="block text-xs text-[#E91E8C]/80 mt-0.5">{f.sub}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth?redirectUrl=/casting/share-of-linkedin"
                className="w-full py-3.5 rounded-full bg-gradient-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity text-center"
              >
                Começar agora
              </Link>
            </div>

            {/* Business */}
            <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-8 hover:border-[#E91E8C]/20 transition-colors flex flex-col">
              <p className="text-sm text-gray-400 font-medium mb-2">Business</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-white">R$999</span>
                <span className="text-gray-500 text-sm">/mês</span>
              </div>
              <p className="text-gray-500 text-sm mb-8">Inteligência completa para seu LinkedIn B2B</p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  { text: "Sua marca + 6 concorrentes", sub: "Através dos colaboradores de ambos", tip: "A análise de cada empresa é feita através dos posts de seus colaboradores — rastreamos quem publica, sobre o que e com qual impacto entre decisores." },
                  { text: "32 colaboradores rastreados", tip: "Colaboradores da sua empresa e de cada concorrente que publicam ativamente. No LinkedIn, a presença de uma empresa é a soma das vozes dos seus colaboradores — monitoramos todos eles." },
                  { text: "8 influencers rastreados", tip: "Influencers B2B do seu nicho. Visão completa de quem produz conteúdo relevante e engaja decisores do seu mercado." },
                  { text: "48 créditos/mês", tip: "Use créditos para extrair leads (1 crédito cada) ou encontrar novos influencers (3 créditos cada). Créditos do plano renovam mensalmente." },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-3 text-sm text-gray-300">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E91E8C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M20 6 9 17l-5-5" /></svg>
                    <span>
                      {f.text}<PlanTooltip text={f.tip} />
                      {"sub" in f && f.sub && <span className="block text-xs text-[#E91E8C]/80 mt-0.5">{f.sub}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth?redirectUrl=/casting/share-of-linkedin"
                className="w-full py-3.5 rounded-full border border-[#E91E8C]/40 text-[#E91E8C] font-semibold text-sm hover:bg-[#E91E8C]/10 transition-colors text-center"
              >
                Começar agora
              </Link>
            </div>
          </div>

          {/* Como funcionam os créditos */}
          <div className="mt-10 bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">Como funcionam os créditos?</h3>
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-gray-400">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#E91E8C]" />
                    <strong className="text-white">1 crédito</strong> = 1 lead extraído
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C724D1]" />
                    <strong className="text-white">3 créditos</strong> = 1 influencer encontrado
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Créditos inclusos no plano são renovados mensalmente. Créditos adicionais não expiram.</p>
              </div>
              <div className="bg-gradient-to-br from-[#E91E8C]/10 to-[#C724D1]/10 border border-[#E91E8C]/20 rounded-xl p-5 text-center shrink-0 min-w-[200px]">
                <p className="text-xs text-gray-400 mb-1">Créditos adicionais</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-2xl font-bold text-white">R$100</span>
                </div>
                <p className="text-sm text-[#E91E8C] font-medium mt-1">por 20 créditos</p>
                <p className="text-[10px] text-gray-500 mt-2">Compre a qualquer momento como add-on</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. CTA Final */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute -top-20 left-[20%] w-72 h-72 bg-[#E91E8C]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-[10%] w-60 h-60 bg-[#C724D1]/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Comece a <span className="text-gradient">dominar</span> seu LinkedIn B2B
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10">
            Mapeie seu mercado e amplifique sua marca com as vozes certas. Em minutos, não em semanas.
          </p>
          <Link
            href="/auth?redirectUrl=/casting/share-of-linkedin"
            className="inline-block bg-gradient-accent text-white font-semibold px-10 py-4 rounded-full text-base hover:opacity-90 transition-opacity shadow-[0_4px_24px_rgba(233,30,140,0.3)]"
          >
            Começar agora
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1E1E3A] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <Image src="/logo.png" alt="BubbleIn" width={100} height={36} />
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/share-of-linkedin" className="hover:text-gray-300 transition-colors">Share of LinkedIn</Link>
            <a href="/#casting" className="hover:text-gray-300 transition-colors">Casting</a>
            <a href="/#planos" className="hover:text-gray-300 transition-colors">Planos</a>
            <Link href="/blog" className="hover:text-gray-300 transition-colors">Blog</Link>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>© {new Date().getFullYear()} BubbleIn. Todos os direitos reservados.</span>
            <span className="text-gray-700">·</span>
            <a href="/termos-de-uso" className="hover:text-[#E91E8C] transition-colors">Termos de Uso</a>
            <span className="text-gray-700">·</span>
            <a href="/politica-de-privacidade" className="hover:text-[#E91E8C] transition-colors">Política de Privacidade</a>
          </div>
        </div>
      </footer>

      {/* Structured Data - Organization + WebSite */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "BubbleIn",
              url: "https://bubblein.com.br",
              logo: "https://bubblein.com.br/logo.png",
              description: "Plataforma B2B para LinkedIn: inteligência competitiva (Share of LinkedIn) e descoberta de creators B2B (Inteligência de Casting) em um só lugar.",
              contactPoint: {
                "@type": "ContactPoint",
                telephone: "+55-11-94123-8555",
                contactType: "sales",
                availableLanguage: ["Portuguese", "Spanish", "English"],
              },
              sameAs: ["https://www.linkedin.com/company/bubblein"],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "BubbleIn",
              url: "https://bubblein.com.br",
              description: "Plataforma para impulsionar empresas B2B no LinkedIn.",
              inLanguage: "pt-BR",
            },
          ]),
        }}
      />
    </div>
  );
}
