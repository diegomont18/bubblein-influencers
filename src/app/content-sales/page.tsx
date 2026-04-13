"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
        placeholder="linkedin.com/in/seu-perfil"
        className="flex-1 bg-[#12122A] border border-[#1E1E3A] rounded-full px-6 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#E91E8C] transition-colors text-sm"
      />
      <button
        onClick={onAnalyze}
        className="bg-gradient-accent text-white font-semibold px-8 py-4 rounded-full text-sm hover:opacity-90 transition-opacity whitespace-nowrap"
      >
        Analisar meu LinkedIn
      </button>
    </div>
  );
}

export default function ContentSalesPage() {
  const router = useRouter();
  const [linkedinUrl, setLinkedinUrl] = useState("");

  function handleAnalyze() {
    if (!linkedinUrl.trim()) return;
    localStorage.setItem("pendingLinkedinUrl", linkedinUrl.trim());
    router.push("/auth?redirectUrl=/casting/leads-generation");
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
            Entenda o que realmente gera negócios no seu{" "}
            <span className="text-gradient">LinkedIn</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-4">
            Nossa IA revela quais conteúdos atraem decisores e como transformar isso em mais oportunidades com{" "}
            <strong className="text-white">Content-Driven Sales</strong>.
          </p>
          <p className="text-sm text-gray-500 mb-10">
            Cole seu perfil do LinkedIn e clique em &quot;Analisar meu LinkedIn&quot;. Leva menos de 1 minuto.
          </p>
          <LinkedInInput value={linkedinUrl} onChange={setLinkedinUrl} onAnalyze={handleAnalyze} />
        </div>
      </section>

      {/* 2. O Novo Modelo de Vendas */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                O <span className="text-gradient">novo modelo</span> de vendas
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                O LinkedIn está criando um novo modelo de vendas. Cada vez mais oportunidades começam antes de qualquer reunião. Elas começam com conteúdo.
              </p>
              <p className="text-gray-400 leading-relaxed mb-4">
                Um post relevante, uma ideia bem explicada, uma experiência compartilhada. Antes mesmo de falar com você, potenciais clientes já conhecem suas ideias, entendem sua abordagem e desenvolvem confiança.
              </p>
              <p className="text-gray-400 leading-relaxed">
                Esse modelo está transformando o LinkedIn em um dos canais mais poderosos de geração de oportunidades B2B.
              </p>
            </div>
            <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <Icon name="check" size={32} className="rounded-full mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Oportunidades nascem do conteúdo</p>
                    <p className="text-gray-500 text-sm">Decisores descobrem você antes da reunião</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Icon name="check" size={32} className="rounded-full mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Confiança construída em público</p>
                    <p className="text-gray-500 text-sm">Seus insights geram credibilidade real</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Icon name="check" size={32} className="rounded-full mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Vendas começam com conversas</p>
                    <p className="text-gray-500 text-sm">Conteúdo abre portas para negócios</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. O que é Content-Driven Sales */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative bg-gradient-to-br from-[#E91E8C]/10 to-[#C724D1]/10 border border-[#E91E8C]/20 rounded-3xl p-10 md:p-16 text-center overflow-hidden">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 relative z-10">
              O que é <span className="text-gradient">Content-Driven Sales</span>?
            </h2>
            <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto relative z-10 mb-4">
              Content-Driven Sales é um modelo de vendas onde conteúdo gera e acelera oportunidades comerciais. Em vez de depender apenas de cold outreach, prospecção ativa ou networking tradicional, você usa conteúdo para atrair o público certo, construir autoridade e iniciar conversas de negócio.
            </p>
            <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto relative z-10">
              Na prática, um decisor vê um post seu, se identifica com o insight, passa a acompanhar seu conteúdo e inicia uma conversa. O conteúdo faz o trabalho inicial de gerar confiança, demonstrar expertise e abrir portas.
            </p>
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
                  "Quais posts atraem decisores?",
                  "Que conteúdos geram conversas relevantes?",
                  "O que realmente leva a oportunidades?",
                ].map((q) => (
                  <div key={q} className="flex items-center gap-3 bg-[#0B0B1A] rounded-xl p-4 border border-[#1E1E3A]">
                    <span className="text-[#E91E8C] text-lg">?</span>
                    <span className="text-gray-300 text-sm">{q}</span>
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-xs mt-4 text-center">Perguntas que likes e impressões não respondem</p>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                O <span className="text-gradient">problema</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                A maioria das pessoas ainda usa o LinkedIn sem entender o que realmente gera negócios. A plataforma mostra métricas como likes, comentários e impressões, mas essas métricas não respondem perguntas essenciais.
              </p>
              <p className="text-gray-400 leading-relaxed">
                Sem essa clareza, o crescimento depende de tentativa e erro.
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
            Uma IA para entender e amplificar seu{" "}
            <span className="text-gradient">Content-Driven Sales</span>
          </h2>
          <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Nossa plataforma analisa seu LinkedIn e revela quais conteúdos atraem decisores, quais posts geram conversas relevantes e quais temas despertam interesse do seu mercado. Assim você consegue repetir o que funciona e gerar mais oportunidades.
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
              Descubra o que realmente funciona no seu LinkedIn.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                number: "01",
                icon: "search",
                title: "Analise seu perfil",
                description: "Cole o link do seu perfil ou página da empresa. Nossa IA analisa seus posts e interações.",
              },
              {
                number: "02",
                icon: "users",
                title: "Entenda sua audiência",
                description: "Veja quem realmente interage com seu conteúdo: cargos, senioridade, empresas e proximidade com seu mercado.",
              },
              {
                number: "03",
                icon: "trending",
                title: "Amplifique resultados",
                description: "Descubra quais conteúdos atraem decisores e receba insights para gerar mais conversas de negócio.",
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

      {/* 7. Insights que você recebe */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Inteligência para seu <span className="text-gradient">Content-Driven Sales</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: "target",
                title: "Conteúdos que atraem decisores",
                description: "Descubra quais posts despertam interesse de founders, executivos e líderes do seu mercado.",
              },
              {
                icon: "lightbulb",
                title: "Temas que geram oportunidades",
                description: "Nossa IA identifica padrões entre seus conteúdos mais relevantes para negócios.",
              },
              {
                icon: "users",
                title: "Audiência qualificada",
                description: "Entenda quem realmente está interagindo com você: cargos, empresas e senioridade.",
              },
              {
                icon: "trending",
                title: "Recomendações práticas",
                description: "Saiba que conteúdos repetir, que temas explorar e como aumentar o impacto dos seus posts.",
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
              Transforme seu LinkedIn em um canal previsível de{" "}
              <span className="text-gradient">oportunidades</span>
            </h2>
            <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto">
              Quando você entende quais conteúdos geram negócios, fica muito mais fácil criar posts relevantes, atrair decisores e iniciar conversas qualificadas. Com o tempo, seu LinkedIn deixa de ser apenas um canal de conteúdo e passa a ser um sistema consistente de Content-Driven Sales.
            </p>
          </div>
        </div>
      </section>

      {/* 9. Para quem é */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Para quem já usa conteúdo para{" "}
            <span className="text-gradient">gerar negócios</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10">
            Se o LinkedIn já faz parte da sua estratégia de vendas, nossa IA ajuda você a entender e ampliar esses resultados.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {["Founders", "Consultores", "Executivos", "Profissionais B2B", "Criadores de conteúdo profissional"].map((tag) => (
              <span key={tag} className="bg-[#12122A] border border-[#1E1E3A] rounded-full px-5 py-2.5 text-sm text-gray-300">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 10. CTA Final */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute -top-20 left-[20%] w-72 h-72 bg-[#E91E8C]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Descubra o que gera negócios no seu{" "}
            <span className="text-gradient">LinkedIn</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10">
            Cole seu perfil e receba insights sobre seu Content-Driven Sales. Leva menos de 1 minuto.
          </p>
          <LinkedInInput value={linkedinUrl} onChange={setLinkedinUrl} onAnalyze={handleAnalyze} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1E1E3A] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <Image src="/logo.png" alt="BubbleIn" width={100} height={36} />
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} BubbleIn. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
