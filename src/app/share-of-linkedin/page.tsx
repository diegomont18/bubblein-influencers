"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/navbar";

const ICONS: Record<string, React.ReactNode> = {
  brain: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h1a4 4 0 0 0 4-4V6a4 4 0 0 0-1-2.83" />
      <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4h-1" />
      <path d="M9 22v-4" /><path d="M15 22v-4" />
    </svg>
  ),
  target: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  eye: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  trending: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  lightbulb: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" /><path d="M10 22h4" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  search: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  chart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
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

function LinkedInInput({ value, onChange, onAnalyze }: { value: string; onChange: (v: string) => void; onAnalyze: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="linkedin.com/company/sua-empresa"
        className="flex-1 bg-[#12122A] border border-[#1E1E3A] rounded-full px-6 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#E91E8C] transition-colors text-sm"
      />
      <button
        onClick={onAnalyze}
        className="bg-gradient-accent text-white font-semibold px-8 py-4 rounded-full text-sm hover:opacity-90 transition-opacity whitespace-nowrap"
      >
        Mapear meu mercado
      </button>
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

export default function ShareOfLinkedInPage() {
  const router = useRouter();
  const [linkedinUrl, setLinkedinUrl] = useState("");

  function handleAnalyze() {
    if (!linkedinUrl.trim()) return;
    localStorage.setItem("pendingLinkedinUrl", linkedinUrl.trim());
    router.push("/auth?redirectUrl=/casting/share-of-linkedin");
  }

  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <Navbar />

      {/* 1. Hero */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
        <div className="absolute -top-20 right-[10%] w-72 h-72 bg-[#E91E8C]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-[5%] w-60 h-60 bg-[#C724D1]/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Saiba o que seus concorrentes publicam e o que funciona no{" "}
            <span className="text-gradient">LinkedIn</span> do seu mercado
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-4">
            Monitore continuamente o LinkedIn do seu nicho. Descubra o que concorrentes e referências estão publicando, identifique o que funciona e receba recomendações estratégicas de conteúdo toda semana.
          </p>
          <p className="text-sm text-gray-500 mb-10">
            Cole a URL da sua empresa no LinkedIn e mapeie seu mercado em minutos.
          </p>
          <LinkedInInput value={linkedinUrl} onChange={setLinkedinUrl} onAnalyze={handleAnalyze} />
          <div className="mt-6">
            <Link
              href="/share-of-linkedin-exemplo"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#E91E8C] font-medium transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              Ver exemplo de relatório
            </Link>
          </div>
        </div>
      </section>

      {/* Link para planos */}
      <div className="text-center pb-4">
        <a href="#planos" className="inline-flex items-center gap-2 text-sm text-[#E91E8C] hover:text-[#C724D1] font-medium transition-colors">
          Ver planos e preços
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
        </a>
      </div>

      {/* 2. O ponto cego do LinkedIn B2B */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                O <span className="text-gradient">ponto cego</span> do LinkedIn B2B
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Sua empresa publica no LinkedIn, mas provavelmente sem saber o que os concorrentes estão fazendo, quais temas geram mais engajamento no seu nicho, ou quais colaboradores deles estão gerando mais impacto.
              </p>
              <p className="text-gray-400 leading-relaxed mb-4">
                Empresas B2B tomam decisões de conteúdo por intuição. Publicam o que parece certo, sem dados reais do mercado. Enquanto isso, concorrentes podem estar dominando temas que importam para seus clientes.
              </p>
              <p className="text-gray-400 leading-relaxed">
                Esse ponto cego custa caro: oportunidades perdidas, conteúdo irrelevante e uma presença digital que não reflete a competitividade real da empresa.
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
                    <p className="text-white font-medium">Funcionários influentes invisíveis</p>
                    <p className="text-gray-500 text-sm">Colaboradores ativos de concorrentes moldam a percepção do mercado</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Icon name="check" size={32} className="rounded-full mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Temas inexplorados no seu nicho</p>
                    <p className="text-gray-500 text-sm">Lacunas que ninguém está abordando representam oportunidades</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. O que é Share of LinkedIn */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative bg-gradient-to-br from-[#E91E8C]/10 to-[#C724D1]/10 border border-[#E91E8C]/20 rounded-3xl p-10 md:p-16 text-center overflow-hidden">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 relative z-10">
              O que é <span className="text-gradient">Share of LinkedIn</span>?
            </h2>
            <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto relative z-10 mb-4">
              Share of LinkedIn é a medida da presença e influência da sua empresa no LinkedIn comparada aos concorrentes do mesmo nicho. Assim como Share of Voice mede presença na mídia, o Share of LinkedIn mede quem domina as conversas relevantes no LinkedIn B2B.
            </p>
            <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto relative z-10 mb-8">
              Nossa plataforma monitora continuamente o que concorrentes, funcionários influentes e referências do seu mercado publicam. Analisa o que funciona com IA e entrega recomendações estratégicas para que sua empresa ganhe terreno onde importa: na frente dos decisores que compram.
            </p>
            <Link
              href="/share-of-linkedin-exemplo"
              className="relative z-10 inline-flex items-center gap-3 bg-gradient-accent text-white font-semibold px-8 py-4 rounded-full text-base hover:opacity-90 transition-opacity shadow-[0_4px_24px_rgba(233,30,140,0.3)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              Ver exemplo de relatório
            </Link>
          </div>
        </div>
      </section>

      {/* 4. O Problema */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-8 order-2 md:order-1">
              <div className="space-y-4">
                {[
                  "O que meus concorrentes estão publicando?",
                  "Quais temas geram engajamento de decisores no meu nicho?",
                  "Quais funcionários dos concorrentes são mais influentes?",
                  "Sobre o que eu deveria estar postando e não estou?",
                ].map((q) => (
                  <div key={q} className="flex items-center gap-3 bg-[#0B0B1A] rounded-xl p-4 border border-[#1E1E3A]">
                    <span className="text-[#E91E8C] text-lg">?</span>
                    <span className="text-gray-300 text-sm">{q}</span>
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-xs mt-4 text-center">Perguntas que o LinkedIn não responde sozinho</p>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Decisões de conteúdo baseadas em <span className="text-gradient">intuição</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                A maioria das empresas B2B publica no LinkedIn sem inteligência competitiva. Não sabem o que os concorrentes postam, quais temas o mercado mais engaja, nem quais colaboradores de outras empresas estão moldando a percepção do setor.
              </p>
              <p className="text-gray-400 leading-relaxed">
                Sem esses dados, a estratégia de conteúdo vira tentativa e erro. Horas gastas em análise manual que poderiam ser automatizadas. Oportunidades temáticas que passam despercebidas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. A Solução */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="mb-6 flex justify-center">
            <Icon name="brain" size={56} />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Monitore, compare e descubra o que funciona no{" "}
            <span className="text-gradient">LinkedIn do seu mercado</span>
          </h2>
          <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Nossa IA mapeia automaticamente concorrentes, identifica funcionários influentes, analisa posts por temas via IA, compara desempenho e entrega um relatório semanal com diagnóstico competitivo e recomendações de conteúdo com tema, abordagem, justificativa e referências.
          </p>
        </div>
      </section>

      {/* 6. Como Funciona */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Como <span className="text-gradient">funciona</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Do LinkedIn da sua empresa ao mapa competitivo completo em poucos minutos.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                number: "01",
                icon: "search",
                title: "Informe sua empresa",
                description: "Cole o link da sua empresa no LinkedIn. Nossa IA identifica automaticamente concorrentes, funcionários influentes e temas do seu mercado.",
              },
              {
                number: "02",
                icon: "users",
                title: "Mapeamos seu mercado",
                description: "Analisamos posts de concorrentes e referências, agrupamos por temas via IA e identificamos o que gera engajamento de decisores.",
              },
              {
                number: "03",
                icon: "trending",
                title: "Receba recomendações semanais",
                description: "Toda semana, um relatório com diagnóstico competitivo e 3 recomendações de conteúdo com tema, abordagem e justificativa baseada em dados.",
              },
            ].map((step) => (
              <div key={step.number} className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-6 hover:border-[#E91E8C]/30 transition-colors">
                <span className="text-gradient text-4xl font-bold block mb-4">{step.number}</span>
                <div className="mb-4">
                  <Icon name={step.icon} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. O que você descobre */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Inteligência competitiva para seu <span className="text-gradient">LinkedIn B2B</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: "target",
                title: "RER: engajamento de decisores",
                description: "Meça a Revenue Engagement Rate de cada post: qual porcentagem do engajamento vem de decisores de compra, comparado aos concorrentes.",
              },
              {
                icon: "lightbulb",
                title: "Lacunas temáticas do mercado",
                description: "Descubra temas relevantes que nenhum concorrente está explorando. Oportunidades de conteúdo com demanda real e baixa competição.",
              },
              {
                icon: "chart",
                title: "Recomendações semanais de conteúdo",
                description: "Receba 3 recomendações estratégicas por semana com tema, abordagem, justificativa e posts de referência do seu mercado.",
              },
              {
                icon: "trending",
                title: "Evolução da presença ao longo do tempo",
                description: "Acompanhe como seu Share of LinkedIn evolui semana a semana vs. concorrentes. Veja se sua estratégia está ganhando terreno.",
              },
            ].map((insight) => (
              <div key={insight.title} className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-6 hover:border-[#E91E8C]/30 transition-colors">
                <div className="mb-4">
                  <Icon name={insight.icon} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{insight.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{insight.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. O Resultado */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative bg-gradient-to-br from-[#E91E8C]/10 to-[#C724D1]/10 border border-[#E91E8C]/20 rounded-3xl p-10 md:p-16 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              Estratégia de conteúdo baseada em{" "}
              <span className="text-gradient">dados reais do mercado</span>
            </h2>
            <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto">
              Quando você sabe o que concorrentes publicam, o que funciona pra eles e onde estão as lacunas, suas decisões de conteúdo deixam de ser intuição e viram estratégia. Com o tempo, sua empresa conquista espaço no LinkedIn onde importa: na frente dos decisores que compram.
            </p>
          </div>
        </div>
      </section>

      {/* 9. Para quem é */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Para empresas que querem dominar o{" "}
            <span className="text-gradient">LinkedIn do seu nicho</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10">
            Se o LinkedIn faz parte da sua estratégia de marketing e vendas, o Share of LinkedIn transforma decisões de conteúdo de intuição em estratégia baseada em dados.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {["Empresas B2B", "Startups", "Agências de Marketing", "Times de Marketing", "Consultorias", "Scale-ups"].map((tag) => (
              <span key={tag} className="bg-[#12122A] border border-[#1E1E3A] rounded-full px-5 py-2.5 text-sm text-gray-300">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 10. Planos */}
      <section id="planos" className="py-20 md:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Escolha o plano ideal para sua{" "}
              <span className="text-gradient">inteligência competitiva</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Todos os planos incluem mapeamento de mercado com IA. Cancele quando quiser.
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
              <button
                onClick={() => { router.push("/auth?redirectUrl=/casting/share-of-linkedin"); }}
                className="w-full py-3.5 rounded-full border border-[#E91E8C]/40 text-[#E91E8C] font-semibold text-sm hover:bg-[#E91E8C]/10 transition-colors"
              >
                Começar agora
              </button>
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
              <button
                onClick={() => { router.push("/auth?redirectUrl=/casting/share-of-linkedin"); }}
                className="w-full py-3.5 rounded-full bg-gradient-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Começar agora
              </button>
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
              <button
                onClick={() => { router.push("/auth?redirectUrl=/casting/share-of-linkedin"); }}
                className="w-full py-3.5 rounded-full border border-[#E91E8C]/40 text-[#E91E8C] font-semibold text-sm hover:bg-[#E91E8C]/10 transition-colors"
              >
                Começar agora
              </button>
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

      {/* 11. CTA Final */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute -top-20 left-[20%] w-72 h-72 bg-[#E91E8C]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Mapeie seu mercado no{" "}
            <span className="text-gradient">LinkedIn</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10">
            Cole o LinkedIn da sua empresa e descubra o que concorrentes publicam, quais temas funcionam e como ganhar terreno no seu nicho.
          </p>
          <LinkedInInput value={linkedinUrl} onChange={setLinkedinUrl} onAnalyze={handleAnalyze} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1E1E3A] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <Image src="/bubblein-logo-transparente.png" alt="BubbleIn" width={135} height={36} />
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span>&copy; {new Date().getFullYear()} BubbleIn. Todos os direitos reservados.</span>
            <span className="text-gray-700">·</span>
            <a href="/termos-de-uso" className="hover:text-[#E91E8C] transition-colors">Termos de Uso</a>
            <span className="text-gray-700">·</span>
            <a href="/politica-de-privacidade" className="hover:text-[#E91E8C] transition-colors">Política de Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
