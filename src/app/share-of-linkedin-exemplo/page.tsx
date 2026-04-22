"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/navbar";

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

export default function ShareOfLinkedInExemploPage() {
  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        {/* Back link */}
        <Link href="/share-of-linkedin" className="text-xs text-gray-400 hover:text-[#E91E8C] transition-colors">
          ← Voltar para Share of LinkedIn
        </Link>

        {/* Banner */}
        <div className="rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 px-5 py-3 flex items-center gap-3">
          <span className="text-[#f59e0b] text-lg">&#9888;</span>
          <p className="text-sm text-[#f59e0b] font-medium">Exemplo ilustrativo — estes dados são fictícios para demonstrar o formato do relatório semanal</p>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white font-[family-name:var(--font-lexend)]">Relatório Semanal — Share of LinkedIn</h1>
          <p className="text-sm text-gray-400 mt-1">Semana de 14/04 a 21/04 · Empresa: TechNova Solutions</p>
        </div>

        {/* Seção 1: Resumo Executivo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#12122A] border border-[#E91E8C]/20 rounded-xl p-5">
            <p className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">Share of Voice</p>
            <p className="text-3xl font-black text-[#E91E8C]">18%</p>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-[#E91E8C] rounded-full" style={{ width: "18%" }} />
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">Líder: TechCloud Solutions 32%</p>
          </div>
          <div className="bg-[#12122A] border border-green-500/20 rounded-xl p-5">
            <p className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">RER Médio</p>
            <p className="text-3xl font-black text-green-400">38%</p>
            <span className="inline-block mt-2 text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">+13% vs média</span>
          </div>
          <div className="bg-[#12122A] border border-[#1E1E3A] rounded-xl p-5">
            <p className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">Posts analisados</p>
            <p className="text-3xl font-black text-white">247</p>
            <p className="text-[10px] text-gray-500 mt-2">de 8 empresas</p>
          </div>
          <div className="bg-[#12122A] border border-[#1E1E3A] rounded-xl p-5">
            <p className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">Decisores engajados</p>
            <p className="text-3xl font-black text-white">89</p>
            <p className="text-[10px] text-gray-500 mt-2">decisores únicos identificados</p>
          </div>
        </div>

        {/* Seção 2: Diagnóstico Competitivo */}
        <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6">
          <h3 className="text-lg font-bold text-white mb-1">
            Diagnóstico Competitivo
            <InfoTooltip text="Comparativo semanal de presença no LinkedIn entre sua empresa e concorrentes. Mede colaboradores ativos, volume de posts, engajamento médio e RER (Revenue Engagement Rate — % de engajadores que são decisores de compra). Posts motivacionais e anúncios de vagas são excluídos automaticamente." />
          </h3>
          <p className="text-xs text-gray-500 mb-4">Engajamento de decisores — posts motivacionais e anúncios de vagas foram excluídos da análise</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[650px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2.5 pr-3 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase w-8">#</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Empresa</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">Colab. ativos</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">Posts/mês</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">Engaj. médio</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase text-center">RER</th>
                  <th className="py-2.5 text-[0.6rem] font-bold tracking-widest text-gray-500 uppercase">Top Tema</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { pos: 1, name: "TechCloud Solutions", colabs: 8, posts: 22, engaj: 310, rer: 42, tema: "IA Generativa", highlight: false },
                  { pos: 2, name: "TechNova Solutions", colabs: 5, posts: 12, engaj: 142, rer: 38, tema: "Cloud Computing", highlight: true },
                  { pos: 3, name: "DataBridge Corp", colabs: 6, posts: 18, engaj: 195, rer: 28, tema: "Transformação Digital", highlight: false },
                  { pos: 4, name: "InfraNext", colabs: 4, posts: 8, engaj: 89, rer: 22, tema: "Segurança em Nuvem", highlight: false },
                  { pos: 5, name: "CloudSync Brasil", colabs: 3, posts: 6, engaj: 55, rer: 15, tema: "Migração Cloud", highlight: false },
                ].map((row) => {
                  const rerColor = row.rer >= 30 ? "text-green-400" : row.rer >= 15 ? "text-yellow-400" : "text-orange-400";
                  const rerBg = row.rer >= 30 ? "bg-green-400/10" : row.rer >= 15 ? "bg-yellow-400/10" : "bg-orange-400/10";
                  return (
                    <tr key={row.pos} className={row.highlight ? "bg-[#E91E8C]/[0.06]" : ""}>
                      <td className="py-3 pr-3"><span className={`text-xs font-black ${row.pos === 1 ? "text-yellow-400" : row.pos === 2 ? "text-gray-400" : row.pos === 3 ? "text-amber-700" : "text-gray-600"}`}>{row.pos}</span></td>
                      <td className={`py-3 font-medium ${row.highlight ? "text-[#E91E8C]" : "text-gray-300"}`}>{row.name}</td>
                      <td className="py-3 text-center text-gray-400">{row.colabs}</td>
                      <td className="py-3 text-center text-gray-400">{row.posts}</td>
                      <td className="py-3 text-center text-gray-400">{row.engaj}</td>
                      <td className="py-3 text-center"><span className={`${rerColor} ${rerBg} text-xs font-bold px-2 py-0.5 rounded-full`}>{row.rer}%</span></td>
                      <td className="py-3 text-gray-500 text-xs">{row.tema}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seção 3: Top Posts da Semana */}
        <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6">
          <h3 className="text-lg font-bold text-white mb-1">
            Top Posts da Semana
            <InfoTooltip text="Os 3 posts com maior RER (Revenue Engagement Rate) da semana no seu nicho. São os conteúdos que mais atraíram decisores de compra — servem como referência para sua estratégia de conteúdo." />
          </h3>
          <p className="text-xs text-gray-500 mb-4">Posts com maior Revenue Engagement Rate entre decisores</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { company: "TechCloud Solutions", author: "Ana Silva, CEO", text: "Reduzimos o custo de infraestrutura cloud em 40% para um cliente do setor financeiro usando FinOps. Aqui estão os 3 passos que seguimos...", likes: 342, comments: 47, rer: 52 },
              { company: "TechNova Solutions", author: "Pedro Santos, CTO", text: "A migração para multi-cloud não é sobre tecnologia — é sobre estratégia de negócios. Depois de 3 anos liderando migrações, aprendi que...", likes: 189, comments: 31, rer: 45 },
              { company: "DataBridge Corp", author: "Carlos Lima, Head of Data", text: "IA generativa está mudando a forma como processamos dados não-estruturados. Na semana passada, implementamos um pipeline que...", likes: 267, comments: 38, rer: 41 },
            ].map((post, i) => (
              <div key={i} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#E91E8C]">{post.company}</p>
                    <p className="text-[10px] text-gray-500">{post.author}</p>
                  </div>
                  <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">RER {post.rer}%</span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{post.text}</p>
                <div className="flex items-center gap-4 text-[10px] text-gray-600 pt-1 border-t border-white/5">
                  <span>{post.likes} curtidas</span>
                  <span>{post.comments} comentários</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Seção 4: Recomendações de Conteúdo */}
        <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6">
          <h3 className="text-lg font-bold text-white mb-1">
            Recomendações de Conteúdo
            <InfoTooltip text="3 recomendações semanais geradas por IA com base na análise competitiva. Cada uma inclui: tema a abordar, ângulo sugerido, justificativa com dados reais do mercado, e um post de referência de concorrente que inspirou a recomendação." />
          </h3>
          <p className="text-xs text-gray-500 mb-4">Temas, ângulos e justificativas baseadas nos dados da semana</p>
          <div className="space-y-4">
            {[
              {
                num: "01", tema: "Otimização de custos com FinOps",
                angulo: "Publique um case study mostrando como sua equipe reduziu custos em cloud para um cliente real. Use números concretos e o framework FinOps.",
                justificativa: "TechCloud Solutions publicou 3 posts sobre FinOps com RER acima de 40%. O tema atrai decisores financeiros (CFOs, VPs de Finanças) que são o ICP com maior poder de compra.",
                ref: { author: "Ana Silva — TechCloud Solutions", text: "Reduzimos o custo de infraestrutura cloud em 40% para um cliente do setor financeiro usando FinOps..." }
              },
              {
                num: "02", tema: "IA generativa aplicada a dados corporativos",
                angulo: "Crie um tutorial prático mostrando como sua empresa usa IA generativa nos serviços de dados. Foque em resultados mensuráveis, não na tecnologia.",
                justificativa: "Nenhum concorrente está abordando IA generativa aplicada a dados — é uma lacuna temática com alta demanda. Posts sobre IA tiveram +34% de engajamento no último mês.",
                ref: { author: "Carlos Lima — DataBridge Corp", text: "IA generativa está mudando a forma como processamos dados não-estruturados..." }
              },
              {
                num: "03", tema: "Erros comuns na migração para nuvem",
                angulo: "Compartilhe os 5 erros mais frequentes que você vê em projetos de migração cloud, com a perspectiva de quem já liderou dezenas de projetos.",
                justificativa: "3 concorrentes publicaram sobre migração com alto engajamento. O ângulo de 'erros comuns' gera identificação e debate — ideal para atrair comentários de decisores.",
                ref: { author: "Pedro Santos — TechNova Solutions", text: "A migração para multi-cloud não é sobre tecnologia — é sobre estratégia de negócios..." }
              },
            ].map((rec) => (
              <div key={rec.num} className="bg-[#0B0B1A] border border-[#1E1E3A] rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <span className="text-3xl font-black text-[#E91E8C]/30 leading-none shrink-0">{rec.num}</span>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-base font-bold text-white">{rec.tema}</p>
                      <p className="text-sm text-gray-400 mt-1 leading-relaxed">{rec.angulo}</p>
                    </div>
                    <div className="bg-green-400/5 border border-green-400/15 rounded-lg px-4 py-2.5">
                      <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-1">Justificativa</p>
                      <p className="text-xs text-green-400/80 leading-relaxed">{rec.justificativa}</p>
                    </div>
                    <div className="bg-white/[0.02] border border-[#1E1E3A] rounded-lg px-4 py-2.5">
                      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Post de referência</p>
                      <p className="text-[10px] text-[#E91E8C]/60 mb-0.5">{rec.ref.author}</p>
                      <p className="text-xs text-gray-500 italic">&ldquo;{rec.ref.text}&rdquo;</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Seção 5: Lacunas + Tendências */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6">
            <h3 className="text-base font-bold text-white mb-1">
              Lacunas Temáticas
              <InfoTooltip text="Temas B2B relevantes para seu mercado que nenhum concorrente está abordando no LinkedIn. São oportunidades de conteúdo com demanda real e baixa competição — ideais para se posicionar como referência." />
            </h3>
            <p className="text-xs text-gray-500 mb-4">Temas que nenhum concorrente está explorando</p>
            <div className="flex flex-wrap gap-2">
              {["FinOps para PMEs", "IA + compliance regulatório", "Cloud soberana no Brasil", "Sustentabilidade em data centers", "Edge computing industrial", "Dados em tempo real para varejo", "Governança multi-cloud"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 bg-green-400/10 border border-green-400/20 text-green-400 text-xs font-medium px-3 py-1.5 rounded-full">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-[#12122A] border border-[#1E1E3A] p-6">
            <h3 className="text-base font-bold text-white mb-1">
              Tendências em Alta
              <InfoTooltip text="Temas cujo engajamento de decisores cresceu significativamente no último mês. Indicam mudanças de interesse do mercado — publicar sobre esses temas agora aumenta a chance de alcançar decisores ativamente interessados." />
            </h3>
            <p className="text-xs text-gray-500 mb-4">Temas com engajamento crescente no último mês</p>
            <div className="flex flex-wrap gap-2">
              {[
                { tema: "IA Generativa", pct: "+52%" },
                { tema: "FinOps", pct: "+34%" },
                { tema: "Segurança Zero Trust", pct: "+28%" },
                { tema: "Observabilidade", pct: "+24%" },
                { tema: "Platform Engineering", pct: "+19%" },
                { tema: "MLOps", pct: "+15%" },
              ].map((t) => (
                <span key={t.tema} className="inline-flex items-center gap-1.5 bg-[#E91E8C]/10 border border-[#E91E8C]/20 text-[#E91E8C] text-xs font-medium px-3 py-1.5 rounded-full">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>
                  {t.tema} <span className="text-green-400 font-bold">{t.pct}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <p className="text-gray-400 mb-4">Quer receber este relatório toda semana para sua empresa?</p>
          <Link
            href="/share-of-linkedin#planos"
            className="inline-block bg-gradient-to-r from-[#E91E8C] to-[#C724D1] text-white font-semibold px-8 py-3.5 rounded-full text-sm hover:opacity-90 transition-opacity"
          >
            Começar agora
          </Link>
        </div>

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
