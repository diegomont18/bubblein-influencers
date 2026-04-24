import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/navbar";

export default function PoliticaDePrivacidadePage() {
  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <Link href="/" className="text-xs text-gray-400 hover:text-[#E91E8C] transition-colors">
          ← Voltar
        </Link>

        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Política de Privacidade</h1>
          <p className="text-sm text-gray-500">Última atualização: 23 de abril de 2026</p>
        </div>

        <div className="space-y-8 text-sm text-gray-400 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Controlador dos Dados</h2>
            <p>O controlador responsável pelo tratamento dos dados pessoais é:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-gray-300">Razão social:</strong> VECSY AUTOMACAO DE DESIGN INOVA SIMPLES (I.S.) - ME</li>
              <li><strong className="text-gray-300">CNPJ:</strong> 56.012.009/0001-77</li>
              <li><strong className="text-gray-300">Nome comercial:</strong> BubbleIn</li>
              <li><strong className="text-gray-300">Encarregado de dados (DPO):</strong> privacidade@bubblein.com.br</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Dados Pessoais Coletados</h2>
            <p>Coletamos as seguintes categorias de dados pessoais:</p>

            <h3 className="text-sm font-semibold text-gray-300 mt-4 mb-1">2.1. Dados de cadastro</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Endereço de e-mail;</li>
              <li>Senha (armazenada exclusivamente em formato hash criptográfico — nunca em texto puro).</li>
            </ul>

            <h3 className="text-sm font-semibold text-gray-300 mt-4 mb-1">2.2. Dados de uso</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Páginas e funcionalidades acessadas;</li>
              <li>Horários e frequência de uso;</li>
              <li>Endereço IP e informações do navegador.</li>
            </ul>

            <h3 className="text-sm font-semibold text-gray-300 mt-4 mb-1">2.3. Dados de pagamento</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Processados integralmente por gateways de pagamento terceirizados;</li>
              <li>Não armazenamos dados de cartão de crédito, conta bancária ou similares.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Dados de Terceiros Processados</h2>
            <p>Para a prestação do serviço de inteligência competitiva, o BubbleIn processa dados disponíveis publicamente no LinkedIn, incluindo:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Nome, cargo e empresa de perfis públicos;</li>
              <li>Conteúdo de posts públicos e métricas de engajamento (curtidas, comentários, compartilhamentos);</li>
              <li>Informações públicas de páginas de empresas.</li>
            </ul>
            <p className="mt-2"><strong className="text-gray-300">Base legal:</strong> Legítimo interesse (LGPD, Art. 7º, inciso IX) para tratamento de dados tornados manifestamente públicos pelo titular. Esses dados são utilizados exclusivamente para fins de análise competitiva de presença no LinkedIn e não são vendidos ou compartilhados para finalidades diversas.</p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Finalidades do Tratamento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-gray-300">Prestação do serviço contratado:</strong> monitoramento, análise e geração de relatórios de inteligência competitiva no LinkedIn;</li>
              <li><strong className="text-gray-300">Comunicações transacionais:</strong> envio de notificações, alertas de uso e informações sobre a conta;</li>
              <li><strong className="text-gray-300">Melhoria do produto:</strong> análise agregada e anonimizada de padrões de uso para aprimorar funcionalidades;</li>
              <li><strong className="text-gray-300">Cumprimento de obrigações legais:</strong> manutenção de registros para fins fiscais, contábeis e regulatórios.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Bases Legais para o Tratamento (LGPD, Art. 7º)</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-gray-300">Execução de contrato (Art. 7º, V):</strong> tratamento de dados de cadastro e uso necessários para a prestação do serviço contratado;</li>
              <li><strong className="text-gray-300">Legítimo interesse (Art. 7º, IX):</strong> processamento de dados públicos do LinkedIn para fins de análise competitiva, bem como analytics agregados para melhoria do produto;</li>
              <li><strong className="text-gray-300">Consentimento (Art. 7º, I):</strong> envio de comunicações de marketing e newsletters (opt-in explícito, podendo ser revogado a qualquer momento);</li>
              <li><strong className="text-gray-300">Obrigação legal (Art. 7º, II):</strong> manutenção de dados fiscais e registros exigidos pela legislação brasileira.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Compartilhamento de Dados</h2>
            <p>Seus dados pessoais podem ser compartilhados com os seguintes terceiros, exclusivamente para as finalidades descritas nesta Política:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-gray-300">Supabase:</strong> infraestrutura de banco de dados e autenticação;</li>
              <li><strong className="text-gray-300">Vercel:</strong> hospedagem e entrega da aplicação;</li>
              <li><strong className="text-gray-300">Apify:</strong> coleta automatizada de dados públicos do LinkedIn;</li>
              <li><strong className="text-gray-300">OpenRouter:</strong> processamento de inteligência artificial para análise de conteúdo;</li>
              <li><strong className="text-gray-300">Gateway de pagamento:</strong> processamento seguro de transações financeiras.</li>
            </ul>
            <p className="mt-3 font-semibold text-gray-300">Não vendemos, alugamos ou comercializamos dados pessoais de nossos usuários a terceiros.</p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Transferência Internacional de Dados</h2>
            <p>Seus dados podem ser processados em servidores localizados fora do Brasil, através dos provedores de infraestrutura mencionados na seção 6. Essas transferências são realizadas com as seguintes garantias, conforme Art. 33 da LGPD:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Cláusulas contratuais padrão que asseguram nível adequado de proteção;</li>
              <li>Provedores que aderem a frameworks de privacidade reconhecidos internacionalmente;</li>
              <li>Medidas técnicas e organizacionais de segurança equivalentes às aplicadas no Brasil.</li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Retenção de Dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-gray-300">Dados de conta:</strong> mantidos enquanto a conta estiver ativa, mais 30 (trinta) dias após o cancelamento para fins de backup;</li>
              <li><strong className="text-gray-300">Dados de uso e analytics:</strong> mantidos por 12 (doze) meses em formato agregado;</li>
              <li><strong className="text-gray-300">Dados fiscais e financeiros:</strong> mantidos por 5 (cinco) anos, conforme exigência da legislação tributária brasileira;</li>
              <li><strong className="text-gray-300">Cache de dados públicos do LinkedIn:</strong> dados de empresas mantidos por 30 dias; dados de engajadores mantidos por 48 horas.</li>
            </ul>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Direitos do Titular dos Dados</h2>
            <p>Conforme a LGPD (Art. 18) e o GDPR (Art. 15 a 22), você tem direito a:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Confirmação da existência de tratamento de seus dados pessoais;</li>
              <li>Acesso aos dados pessoais que mantemos sobre você;</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
              <li>Portabilidade dos dados a outro fornecedor de serviço;</li>
              <li>Informação sobre entidades públicas e privadas com as quais compartilhamos seus dados;</li>
              <li>Revogação do consentimento a qualquer momento, quando o tratamento for baseado em consentimento.</li>
            </ul>
            <p className="mt-3"><strong className="text-gray-300">Como exercer seus direitos:</strong> envie um e-mail para <span className="text-[#E91E8C]">privacidade@bubblein.com.br</span> com sua solicitação. Responderemos em até 15 (quinze) dias úteis, conforme previsto na LGPD.</p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Segurança dos Dados</h2>
            <p>Adotamos medidas técnicas e organizacionais para proteger seus dados pessoais:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-gray-300">Criptografia em trânsito:</strong> todas as comunicações são protegidas por HTTPS/TLS;</li>
              <li><strong className="text-gray-300">Armazenamento seguro de senhas:</strong> utilizamos hash criptográfico via Supabase Auth (bcrypt);</li>
              <li><strong className="text-gray-300">Row Level Security (RLS):</strong> políticas de segurança no banco de dados garantem que cada usuário acesse apenas seus próprios dados;</li>
              <li><strong className="text-gray-300">Controle de acesso:</strong> acesso administrativo restrito e protegido por autenticação de múltiplos fatores.</li>
            </ul>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Cookies</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-gray-300">Cookies essenciais:</strong> necessários para autenticação e funcionamento da plataforma (session token). Não podem ser desativados;</li>
              <li><strong className="text-gray-300">Cookies de analytics:</strong> utilizados para monitoramento agregado de uso da plataforma, quando aplicável. Podem ser desativados pelo usuário;</li>
              <li>Não utilizamos cookies de publicidade ou rastreamento de terceiros.</li>
            </ul>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">12. Alterações nesta Política</h2>
            <p>Esta Política de Privacidade pode ser atualizada periodicamente para refletir mudanças em nossas práticas ou na legislação aplicável. Em caso de alterações materiais, notificaremos os usuários por e-mail com antecedência razoável.</p>
            <p className="mt-2">Recomendamos a revisão periódica desta página para se manter informado sobre como protegemos seus dados.</p>
          </section>

          {/* Cross-reference */}
          <section className="border-t border-[#1E1E3A] pt-6">
            <p>Para informações sobre as condições de uso da plataforma, consulte nossos <Link href="/termos-de-uso" className="text-[#E91E8C] hover:underline">Termos de Uso</Link>.</p>
          </section>

        </div>

        <footer className="border-t border-[#1E1E3A] py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Image src="/bubblein-logo-transparente.png" alt="BubbleIn" width={135} height={36} />
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
