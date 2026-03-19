"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "/login";

const ICONS: Record<string, React.ReactNode> = {
  search: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  megaphone: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
  handshake: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88" />
      <path d="m2 12 5.5-5.5a3 3 0 0 1 4.24 0L14 8.88" /><path d="m22 12-5.5-5.5a3 3 0 0 0-4.24 0L10 8.88" />
    </svg>
  ),
  rocket: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
  chat: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  lightning: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  refresh: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
    </svg>
  ),
  pen: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  "check-success": (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
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

const NAV_LINKS = [
  { label: "Benefícios", href: "#beneficios" },
  { label: "Como Funciona", href: "#processo" },
  { label: "Modelos", href: "#modelos" },
  { label: "FAQ", href: "#faq" },
  { label: "Blog", href: "/blog" },
];

const BENEFITS = [
  {
    icon: "search",
    title: "SEO & AEIO",
    description:
      "Creators geram conteúdo otimizado que posiciona sua marca nas buscas do LinkedIn e além.",
  },
  {
    icon: "megaphone",
    title: "Awareness",
    description:
      "Alcance milhares de decisores B2B através de vozes que já possuem a atenção do seu público-alvo.",
  },
  {
    icon: "handshake",
    title: "Confiança & Prova Social",
    description:
      "Quando um creator confiável fala sobre sua marca, a percepção do mercado muda instantaneamente.",
  },
  {
    icon: "rocket",
    title: "Geração de Demanda",
    description:
      "Conteúdo estratégico que educa o mercado e gera interesse real nos seus produtos e serviços.",
  },
  {
    icon: "chat",
    title: "Engajamento Qualificado",
    description:
      "Atraia interações de profissionais que realmente importam para o seu negócio.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Mapeamento (Casting)",
    description:
      "Identificamos os creators B2B mais relevantes para o seu nicho usando dados e inteligência artificial.",
  },
  {
    number: "02",
    title: "Contato & Negociação",
    description:
      "Cuidamos de toda a abordagem, negociação e contratação dos creators selecionados.",
  },
  {
    number: "03",
    title: "Estratégia de Conteúdo",
    description:
      "Desenvolvemos briefings e calendários editoriais alinhados aos seus objetivos de negócio.",
  },
  {
    number: "04",
    title: "Mensuração",
    description:
      "Acompanhamos métricas de alcance, engajamento e conversão com relatórios detalhados.",
  },
];

const FAQ_ITEMS = [
  {
    q: "O que é marketing de influência B2B no LinkedIn?",
    a: "É uma estratégia que conecta marcas a profissionais influentes no LinkedIn — creators que produzem conteúdo relevante para audiências de tomadores de decisão. Diferente do B2C, o foco é em credibilidade, autoridade e geração de demanda qualificada.",
  },
  {
    q: "Como vocês selecionam os creators?",
    a: "Utilizamos nossa plataforma proprietária de inteligência para mapear creators com base em relevância temática, engajamento real, audiência qualificada e alinhamento com a sua marca. Cada creator passa por uma análise detalhada antes de ser recomendado.",
  },
  {
    q: "Qual o investimento mínimo?",
    a: "O investimento varia conforme o modelo (campanha pontual ou programa contínuo) e a quantidade de creators envolvidos. Entre em contato para receber uma proposta personalizada.",
  },
  {
    q: "Quanto tempo leva para ver resultados?",
    a: "Campanhas pontuais geram visibilidade imediata. Programas contínuos constroem autoridade ao longo do tempo, com resultados crescentes a partir do segundo mês.",
  },
  {
    q: "Vocês trabalham apenas com LinkedIn?",
    a: "Nosso foco principal é o LinkedIn, por ser a plataforma mais relevante para B2B. Porém, podemos complementar estratégias com outros canais quando faz sentido para o objetivo do cliente.",
  },
];

function ContactForm({ type }: { type: "empresa" | "creator" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar.");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-8 text-center">
        <div className="flex justify-center mb-4">
          <Icon name="check-success" size={48} className="bg-gradient-to-br from-emerald-500 to-green-600" />
        </div>
        <h3 className="text-xl font-bold mb-2">Mensagem enviada!</h3>
        <p className="text-gray-400">
          Obrigado pelo contato. Retornaremos em breve.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-6 md:p-8 max-w-lg mx-auto text-left space-y-4">
      <div>
        <label htmlFor={`name-${type}`} className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
        <input
          id={`name-${type}`}
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#0B0B1A] border border-[#1E1E3A] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#E91E8C] transition-colors"
          placeholder="Seu nome"
        />
      </div>
      <div>
        <label htmlFor={`email-${type}`} className="block text-sm font-medium text-gray-300 mb-1">Email</label>
        <input
          id={`email-${type}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-[#0B0B1A] border border-[#1E1E3A] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#E91E8C] transition-colors"
          placeholder="seu@email.com"
        />
      </div>
      <div>
        <label htmlFor={`message-${type}`} className="block text-sm font-medium text-gray-300 mb-1">Mensagem</label>
        <textarea
          id={`message-${type}`}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full bg-[#0B0B1A] border border-[#1E1E3A] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#E91E8C] transition-colors resize-none"
          placeholder={type === "creator" ? "Conte sobre seu conteúdo e audiência..." : "Como podemos ajudar sua empresa?"}
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-accent text-white font-semibold px-8 py-3 rounded-full text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? "Enviando..." : "Enviar mensagem"}
      </button>
    </form>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#1E1E3A] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-[#1a1a35] transition-colors"
      >
        <span className="text-white font-medium pr-4">{q}</span>
        <span
          className={`text-gray-400 text-xl shrink-0 transition-transform ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 text-gray-400 leading-relaxed">{a}</div>
      )}
    </div>
  );
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all ${
          scrolled
            ? "bg-[#0B0B1A]/80 backdrop-blur-lg border-b border-[#1E1E3A]"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="BubbleIn"
              width={120}
              height={43}
              priority
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              )
            )}
            <Link
              href={APP_URL}
              className="bg-gradient-accent text-white text-sm font-medium px-5 py-2 rounded-full hover:opacity-90 transition-opacity"
            >
              Entrar
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {menuOpen ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-[#0B0B1A]/95 backdrop-blur-lg border-b border-[#1E1E3A] px-6 pb-4">
            {NAV_LINKS.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block py-3 text-gray-400 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block py-3 text-gray-400 hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              )
            )}
            <Link
              href={APP_URL}
              className="inline-block mt-2 bg-gradient-accent text-white text-sm font-medium px-5 py-2 rounded-full"
            >
              Entrar
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        {/* Decorative bubbles */}
        <div className="bubble bubble-lg top-16 left-[10%] opacity-20" style={{ animationDelay: "0s" }} />
        <div className="bubble bubble-md top-32 right-[15%] opacity-30" style={{ animationDelay: "2s", animationDuration: "10s" }} />
        <div className="bubble bubble-sm top-48 left-[60%] opacity-15" style={{ animationDelay: "4s", animationDuration: "12s" }} />
        <div className="bubble bubble-xl -top-10 right-[5%] opacity-10" style={{ animationDelay: "1s", animationDuration: "14s" }} />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Ganhe visibilidade no LinkedIn com{" "}
            <span className="text-gradient">creators B2B</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Conectamos sua marca a profissionais influentes no LinkedIn que geram
            confiança, demanda e resultados reais para o seu negócio.
          </p>
          <a
            href="#contato"
            className="inline-block bg-gradient-accent text-white font-semibold px-8 py-4 rounded-full text-lg hover:opacity-90 transition-opacity"
          >
            Fale com a gente
          </a>
        </div>
      </section>

      {/* Problem / Opportunity */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                O marketing B2B está{" "}
                <span className="text-gradient">mudando</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Anúncios tradicionais já não geram o mesmo impacto. Decisores confiam em
                pessoas, não em marcas. No LinkedIn, creators B2B constroem audiências
                qualificadas de milhares de profissionais que acompanham seu conteúdo
                diariamente.
              </p>
              <p className="text-gray-400 leading-relaxed">
                Marcas que se conectam a esses creators alcançam o público certo, com a
                mensagem certa, através da voz mais confiável possível.
              </p>
            </div>
            <div className="relative">
              <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-8">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <Icon name="check" size={32} className="rounded-full mt-0.5" />
                    <div>
                      <p className="text-white font-medium">CTR de ads B2B caindo ano a ano</p>
                      <p className="text-gray-500 text-sm">Audiências saturadas de anúncios</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Icon name="check" size={32} className="rounded-full mt-0.5" />
                    <div>
                      <p className="text-white font-medium">92% confiam em recomendações de pessoas</p>
                      <p className="text-gray-500 text-sm">Nielsen Global Trust in Advertising</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Icon name="check" size={32} className="rounded-full mt-0.5" />
                    <div>
                      <p className="text-white font-medium">LinkedIn: +900M profissionais</p>
                      <p className="text-gray-500 text-sm">A maior rede profissional do mundo</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="beneficios" className="py-20 md:py-28 relative overflow-hidden">
        <div className="bubble bubble-sm top-20 right-[8%] opacity-20" style={{ animationDelay: "2s", animationDuration: "10s" }} />
        <div className="bubble bubble-md bottom-10 left-[5%] opacity-15" style={{ animationDelay: "5s", animationDuration: "14s" }} />
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Por que investir em <span className="text-gradient">creators B2B</span>?
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Creators geram resultados que canais tradicionais não conseguem entregar
              sozinhos.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-6 hover:border-[#E91E8C]/30 transition-colors"
              >
                <div className="mb-4">
                  <Icon name={b.icon} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {b.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About highlight */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative bg-gradient-to-br from-[#E91E8C]/10 to-[#C724D1]/10 border border-[#E91E8C]/20 rounded-3xl p-10 md:p-16 text-center overflow-hidden">
            <div className="bubble bubble-md top-4 right-8 opacity-20" style={{ animationDelay: "1s", animationDuration: "12s" }} />
            <div className="bubble bubble-sm -bottom-4 left-12 opacity-15" style={{ animationDelay: "3s" }} />
            <h2 className="text-2xl md:text-3xl font-bold mb-6 relative">
              Somos uma agência de{" "}
              <span className="text-gradient">creators B2B do LinkedIn</span>
            </h2>
            <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto relative">
              Conectamos sua marca a profissionais com relevância e audiência qualificada.
              Nosso hub reúne creators verificados, estratégia de conteúdo e mensuração
              de resultados — tudo em um só lugar. Da identificação ao relatório final,
              cuidamos de toda a operação para que você foque no que importa: crescer.
            </p>
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="processo" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Como <span className="text-gradient">funciona</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Um processo estruturado do mapeamento à mensuração de resultados.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div key={s.number} className="relative">
                <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-6 h-full">
                  <span className="text-gradient text-4xl font-bold block mb-4">
                    {s.number}
                  </span>
                  <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hiring Models */}
      <section id="modelos" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Modelos de <span className="text-gradient">contratação</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Escolha o formato que melhor se encaixa na sua estratégia.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-8 hover:border-[#E91E8C]/30 transition-colors">
              <div className="mb-6">
                <Icon name="lightning" size={48} />
              </div>
              <h3 className="text-xl font-bold mb-3">Campanha Pontual</h3>
              <p className="text-gray-400 leading-relaxed mb-4">
                Ideal para lançamentos, eventos ou ações sazonais. Ativamos creators
                selecionados para gerar impacto em um período definido.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-[#E91E8C]">✓</span> Duração definida
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#E91E8C]">✓</span> Foco em visibilidade rápida
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#E91E8C]">✓</span> Relatório de resultados
                </li>
              </ul>
            </div>
            <div className="bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-8 hover:border-[#C724D1]/30 transition-colors relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-gradient-accent text-xs font-bold px-3 py-1 rounded-full">
                Recomendado
              </div>
              <div className="mb-6">
                <Icon name="refresh" size={48} />
              </div>
              <h3 className="text-xl font-bold mb-3">Programa Contínuo</h3>
              <p className="text-gray-400 leading-relaxed mb-4">
                Para marcas que querem construir autoridade e presença consistente no
                LinkedIn. Criamos um programa recorrente com creators dedicados.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-[#C724D1]">✓</span> Presença contínua
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#C724D1]">✓</span> Construção de autoridade
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#C724D1]">✓</span> Resultados crescentes
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#C724D1]">✓</span> Acompanhamento mensal
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato" className="py-20 md:py-28 relative overflow-hidden">
        <div className="bubble bubble-md top-10 left-[8%] opacity-15" style={{ animationDelay: "1s", animationDuration: "11s" }} />
        <div className="bubble bubble-sm bottom-20 right-[10%] opacity-20" style={{ animationDelay: "3s", animationDuration: "9s" }} />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Vamos gerar negócios para sua empresa pelo{" "}
            <span className="text-gradient">LinkedIn</span>?
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10">
            Converse com nosso time e descubra como creators B2B podem transformar a
            presença da sua marca no LinkedIn.
          </p>
          <ContactForm type="empresa" />
        </div>
      </section>

      {/* Creator CTA */}
      <section className="py-20 md:py-28 border-t border-[#1E1E3A]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex justify-center mb-6">
            <Icon name="pen" size={48} />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Você é creator de conteúdo no LinkedIn?
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-8">
            Junte-se ao nosso hub de creators B2B. Conectamos você a marcas que
            valorizam seu conteúdo e sua audiência.
          </p>
          <ContactForm type="creator" />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Perguntas <span className="text-gradient">frequentes</span>
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1E1E3A] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <Image src="/logo.png" alt="BubbleIn" width={100} height={36} />
          <div className="flex items-center gap-6 text-sm text-gray-500">
            {NAV_LINKS.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-gray-300 transition-colors"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="hover:text-gray-300 transition-colors"
                >
                  {link.label}
                </a>
              )
            )}
          </div>
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} BubbleIn. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
