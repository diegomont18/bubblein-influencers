import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/navbar";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos de uso da BubbleIn — plataforma B2B para LinkedIn com Share of LinkedIn e Inteligência de Casting de creators.",
  alternates: { canonical: "/termos-de-uso" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/termos-de-uso",
    title: "Termos de Uso | BubbleIn",
    description: "Termos de uso da plataforma BubbleIn.",
  },
};

export default function TermosDeUsoPage() {
  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <Link href="/" className="text-xs text-gray-400 hover:text-[#E91E8C] transition-colors">
          ← Voltar
        </Link>

        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Termos de Uso</h1>
          <p className="text-sm text-gray-500">Última atualização: 23 de abril de 2026</p>
        </div>

        <div className="space-y-8 text-sm text-gray-400 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Identificação da Empresa</h2>
            <p>O BubbleIn é um produto desenvolvido e operado por:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-gray-300">Razão social:</strong> VECSY AUTOMACAO DE DESIGN INOVA SIMPLES (I.S.) - ME</li>
              <li><strong className="text-gray-300">CNPJ:</strong> 56.012.009/0001-77</li>
              <li><strong className="text-gray-300">Nome comercial:</strong> BubbleIn</li>
              <li><strong className="text-gray-300">E-mail de contato:</strong> contato@bubblein.com.br</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Objeto do Serviço</h2>
            <p>O BubbleIn é uma plataforma de inteligência competitiva no LinkedIn para empresas B2B. O serviço inclui:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Monitoramento da presença de marca e concorrentes no LinkedIn;</li>
              <li>Análise de engajamento de decisores de compra (ICP);</li>
              <li>Geração de relatórios com diagnóstico competitivo e recomendações estratégicas;</li>
              <li>Identificação de influenciadores B2B e geração de leads qualificados.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Condições de Uso</h2>
            <p>Ao utilizar o BubbleIn, o usuário concorda com as seguintes condições:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>É necessário criar uma conta com e-mail válido para acessar as funcionalidades da plataforma;</li>
              <li>O usuário garante a veracidade e atualidade das informações fornecidas no cadastro;</li>
              <li>O uso da plataforma é permitido apenas para fins comerciais legítimos;</li>
              <li>É expressamente proibido: realizar scraping manual dos dados da plataforma, redistribuir dados ou relatórios a terceiros não autorizados, utilizar a plataforma para fins fraudulentos ou ilegais, e tentar acessar funcionalidades ou dados de outros usuários.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Planos, Créditos e Pagamento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>O acesso às funcionalidades é determinado pelo plano contratado, cada qual com suas funcionalidades e quantidade de créditos;</li>
              <li>Créditos inclusos no plano são renovados mensalmente e não são cumulativos entre períodos;</li>
              <li>Créditos adicionais adquiridos como add-on não expiram enquanto a conta estiver ativa;</li>
              <li>A VECSY reserva-se o direito de alterar os preços dos planos mediante aviso prévio de 30 (trinta) dias;</li>
              <li>O pagamento é processado por plataformas de pagamento terceirizadas, sujeitas aos seus próprios termos.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Propriedade Intelectual</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Todo o conteúdo da plataforma — incluindo software, design, textos, gráficos, algoritmos e relatórios gerados — é de propriedade exclusiva da VECSY ou de seus licenciadores;</li>
              <li>Dados públicos do LinkedIn utilizados na análise são de titularidade do LinkedIn Corporation e são processados em conformidade com seus termos de uso;</li>
              <li>O usuário tem licença limitada para utilizar os relatórios gerados pela plataforma para fins internos de sua empresa, sendo vedada a revenda ou redistribuição comercial.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Limitação de Responsabilidade</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Os dados e análises fornecidos pelo BubbleIn são baseados em informações publicamente disponíveis no LinkedIn e processados por algoritmos de inteligência artificial;</li>
              <li>A VECSY não garante a precisão absoluta, completude ou atualidade dos dados apresentados;</li>
              <li>A VECSY não se responsabiliza por decisões de negócio, investimentos ou estratégias adotadas com base nos relatórios e análises gerados pela plataforma;</li>
              <li>O serviço é fornecido &ldquo;como está&rdquo; (as is), e sua disponibilidade pode ser afetada por manutenções programadas ou fatores externos.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Suspensão e Cancelamento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>O usuário pode cancelar sua conta a qualquer momento, sem multa ou penalidade;</li>
              <li>A VECSY pode suspender ou encerrar contas que violem estes Termos de Uso, sem aviso prévio em casos graves;</li>
              <li>Após o cancelamento, os dados do usuário serão mantidos por 30 (trinta) dias para fins de backup, após os quais serão eliminados permanentemente;</li>
              <li>Créditos não utilizados no momento do cancelamento não serão reembolsados.</li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Foro e Legislação Aplicável</h2>
            <p>Estes Termos de Uso são regidos pela legislação brasileira, incluindo o Código Civil (Lei 10.406/2002), o Marco Civil da Internet (Lei 12.965/2014) e a Lei Geral de Proteção de Dados Pessoais — LGPD (Lei 13.709/2018).</p>
            <p className="mt-2">Fica eleito o foro da comarca da sede da empresa para dirimir quaisquer controvérsias oriundas destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Vigência e Alterações</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Estes Termos de Uso entram em vigor na data de sua publicação e permanecem válidos por prazo indeterminado;</li>
              <li>A VECSY pode alterar estes Termos a qualquer tempo, comunicando as mudanças com antecedência mínima de 15 (quinze) dias por e-mail;</li>
              <li>O uso continuado da plataforma após a entrada em vigor das alterações constitui aceite tácito dos novos termos.</li>
            </ul>
          </section>

          {/* Cross-reference */}
          <section className="border-t border-[#1E1E3A] pt-6">
            <p>Para informações sobre como tratamos seus dados pessoais, consulte nossa <Link href="/politica-de-privacidade" className="text-[#E91E8C] hover:underline">Política de Privacidade</Link>.</p>
          </section>

        </div>

        <footer className="border-t border-[#1E1E3A] py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Image src="/bubblein-blackbg-logo-influencers-b2b.png" alt="BubbleIn" width={135} height={36} />
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
