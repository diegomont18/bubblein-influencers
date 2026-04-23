export const NAV_ANALYSIS = [
  { id: "insights", label: "Insights" },
  { id: "recomendacoes", label: "Recomendacoes" },
  { id: "alerta", label: "Movimentos" },
  { id: "traducao", label: "Traducao Negocio" },
];

export const NAV_CONTENT = [
  { id: "ranking", label: "Ranking" },
  { id: "analise", label: "Analise Conteudo" },
  { id: "colaboradores", label: "Colaboradores" },
  { id: "decisores", label: "Decisores" },
];

export const NAV_SECTIONS = [...NAV_ANALYSIS, ...NAV_CONTENT];

export const HIGHLIGHT_POSTS: Record<string, { positive: { title: string; author: string; rer: number; reactions: number; comments: number; why: string }; negative: { title: string; author: string; rer: number; reactions: number; comments: number; why: string }; unexpected: { title: string; author: string; reactions: number; detail: string; why: string } }> = {
  TOTVS: {
    positive: { title: "Reforma tributaria: os 3 erros que ja vemos nas empresas grandes", author: "Dennis Herszkowicz (CEO TOTVS)", rer: 51, reactions: 2347, comments: 89, why: "Tese especifica, acionavel, ancorada em autoridade. Replicar formato \"N erros que vemos\"." },
    negative: { title: "Integracao nativa ERP-CRM: como nossa plataforma resolve", author: "Juliano Tubino (VP Comercial TOTVS)", rer: 12, reactions: 84, comments: 6, why: "Tom institucional, sem dor do leitor, sem dado, sem case. Decisor ignora comunicacao de venda." },
    unexpected: { title: "TOTVS 42 anos - o que aprendemos nessas 4 decadas", author: "Pagina oficial TOTVS", reactions: 1847, detail: "4x a media", why: "Audiencia aquecida para conteudo humano/identitario e fria para tese tecnica." },
  },
  "SAP Brasil": {
    positive: { title: "Como IA generativa esta redefinindo o planejamento de supply chain", author: "Marcos Vidal (VP Inovacao SAP Brasil)", rer: 48, reactions: 1890, comments: 72, why: "Tese com caso concreto, dados de resultado e posicionamento claro." },
    negative: { title: "Estamos contratando! Venha fazer parte do time de IA da SAP", author: "SAP Brasil (Pagina oficial)", rer: 8, reactions: 320, comments: 12, why: "Post de vaga disfarcado de thought leadership. RER minimo." },
    unexpected: { title: "Meu primeiro ano como estagiario na SAP: o que aprendi", author: "Lucas Mendonca (Estagiario SAP)", reactions: 2100, detail: "5x a media de VP", why: "Autenticidade e vulnerabilidade vencem polish corporativo." },
  },
  Oracle: {
    positive: { title: "Migramos 100% do ERP do Bradesco para cloud em 8 meses", author: "Ricardo Torres (CTO Oracle Brasil)", rer: 44, reactions: 1650, comments: 58, why: "Case real com cliente de peso, numeros e timeline." },
    negative: { title: "5 razoes para migrar seu ERP para a nuvem em 2026", author: "Oracle Brasil (Pagina oficial)", rer: 10, reactions: 180, comments: 8, why: "Whitepaper generico reciclado como post. Sem ponto de vista." },
    unexpected: { title: "Por que a SAP esta certa sobre IA em ERP (e o que falta)", author: "Roberto Lima (CEO Oracle Brasil)", reactions: 1500, detail: "3x a media", why: "CEO elogiando competitor gera curiosidade e debate." },
  },
};

export const COLLAB_DATA: Record<string, Array<{ name: string; role: string; posts: number; engPct: string; cat: string; badge: string; badgeColor: string; note: string }>> = {
  TOTVS: [
    { name: "TOTVS", role: "Pagina oficial", posts: 6, engPct: "21%", cat: "Institucional/Vagas", badge: "Media", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Alto volume mas baixo RER" },
    { name: "Dennis Herszkowicz", role: "CEO", posts: 12, engPct: "52%", cat: "Reforma Tributaria", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "RER 51% no post sobre reforma" },
    { name: "Juliano Tubino", role: "VP Comercial", posts: 8, engPct: "19%", cat: "Produto/Plataforma", badge: "Media", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Tom institucional reduz impacto" },
    { name: "Gustavo Bastos", role: "CFO", posts: 4, engPct: "8%", cat: "Gestao Financeira", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Engaja CFOs e Controllers" },
    { name: "Marcelo Cosentino", role: "VP Tecnologia", posts: 0, engPct: "0%", cat: "-", badge: "Inativo 45d", badgeColor: "text-gray-500 bg-gray-500/10", note: "Voz tecnica ausente (CIO/CTO)" },
    { name: "Sergio Campos", role: "VP Produto", posts: 0, engPct: "0%", cat: "-", badge: "Inativo 60d", badgeColor: "text-gray-500 bg-gray-500/10", note: "Territorio de produto sem voz" },
  ],
  "SAP Brasil": [
    { name: "SAP Brasil", role: "Pagina oficial", posts: 4, engPct: "12%", cat: "Institucional/Vagas", badge: "Baixa", badgeColor: "text-red-400 bg-red-400/10", note: "Vagas e institucional, baixo RER" },
    { name: "Maria Santos", role: "VP Inovacao", posts: 15, engPct: "22%", cat: "IA + Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Principal voz em IA" },
    { name: "Carlos Ferreira", role: "Dir. Produto", posts: 12, engPct: "18%", cat: "Produto", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Conteudo tecnico consistente" },
    { name: "Ana Rodrigues", role: "Head Marketing", posts: 10, engPct: "15%", cat: "Institucional", badge: "Media", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Foco institucional, baixo RER" },
    { name: "Pedro Almeida", role: "Dir. Engenharia", posts: 8, engPct: "13%", cat: "Tech/Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Engaja publico tecnico CTO" },
    { name: "Lucas Mendes", role: "Head CS", posts: 6, engPct: "10%", cat: "Cases", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Cases reais com clientes" },
  ],
  Oracle: [
    { name: "Oracle Brasil", role: "Pagina oficial", posts: 2, engPct: "8%", cat: "Institucional", badge: "Baixa", badgeColor: "text-red-400 bg-red-400/10", note: "Pouca atividade oficial" },
    { name: "Roberto Lima", role: "CEO", posts: 14, engPct: "71%", cat: "ERP Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Concentracao extrema" },
    { name: "Fernanda Costa", role: "Dir. Comercial", posts: 3, engPct: "18%", cat: "Vendas", badge: "Media", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Poucos posts, foco comercial" },
    { name: "Andre Souza", role: "Head Tech", posts: 1, engPct: "11%", cat: "Cloud", badge: "Baixa", badgeColor: "text-red-400 bg-red-400/10", note: "Quase inativo" },
  ],
};

export const ALL_POSTS = [
  { company: "TOTVS", text: "Reforma tributaria: os 3 erros que ja vemos nas empresas grandes. Identificamos tres padroes: subestimar impacto no fluxo de caixa, nao revisar contratos com fornecedores, e deixar para atualizar o ERP nos ultimos 60 dias. O erro #3 e o mais caro.", author: "Dennis Herszkowicz", role: "CEO", category: "Produto e negocio", engagement: 2436, rer: 51 },
  { company: "TOTVS", text: "TOTVS 42 anos - o que aprendemos nessas 4 decadas. Quando comecamos em 1983, software de gestao era coisa de multinacional. Hoje, mais de 70 mil empresas brasileiras rodam na nossa plataforma. Tecnologia brasileira precisa resolver problemas brasileiros.", author: "Pagina oficial", role: "", official: true, category: "Institucional", engagement: 1847, rer: 15 },
  { company: "TOTVS", text: "Integracao nativa ERP-CRM: como nossa plataforma resolve o desafio que toda empresa enfrenta. Com a integracao nativa, eliminamos middleware e reduzimos tempo de implementacao em 60%.", author: "Juliano Tubino", role: "VP Comercial", category: "Produto e negocio", engagement: 90, rer: 12 },
  { company: "TOTVS", text: "Estamos contratando! Vagas abertas em tecnologia na TOTVS. Procuramos desenvolvedores Python, engenheiros de dados e especialistas em IA para nosso time de inovacao.", author: "Pagina oficial", role: "", official: true, category: "Vagas e RH", engagement: 520, rer: 5 },
  { company: "TOTVS", text: "O futuro da gestao financeira no Brasil passa por tres pilares: automacao fiscal inteligente, real-time analytics e compliance preditivo. Empresas que adotam essas capacidades crescem 2,3x mais rapido.", author: "Gustavo Bastos", role: "CFO", category: "Produto e negocio", engagement: 380, rer: 44 },
  { company: "TOTVS", text: "TOTVS no evento SAP Sapphire - o que aprendemos. Eles apostam pesado em IA generativa, mas ainda sem cases concretos no Brasil. O discurso de plataforma global nao ressoa com o mid-market brasileiro.", author: "Dennis Herszkowicz", role: "CEO", category: "Institucional", engagement: 890, rer: 28 },
  { company: "TOTVS", text: "Resultado do 4T25: crescimento de 18% em receita recorrente, superando guidance. Receita recorrente atingiu R$1,2bi no trimestre. Churn caiu para 0,8% - o menor da historia.", author: "Pagina oficial", role: "", official: true, category: "Institucional", engagement: 1200, rer: 22 },
  { company: "SAP Brasil", text: "Como IA generativa esta redefinindo o planejamento de supply chain. Nosso modulo reduziu tempo de planejamento de demanda de 5 dias para 4 horas. O modelo analisa 340 variaveis simultaneamente.", author: "Marcos Vidal", role: "VP Inovacao", category: "Produto e negocio", engagement: 1962, rer: 48 },
  { company: "SAP Brasil", text: "Estamos contratando! Venha fazer parte do time de IA da SAP Brasil. Buscamos cientistas de dados, engenheiros de ML e product managers para nosso hub de inovacao em Sao Paulo.", author: "Pagina oficial", role: "", official: true, category: "Vagas e RH", engagement: 332, rer: 8 },
  { company: "SAP Brasil", text: "Meu primeiro ano como estagiario na SAP: entrei achando que ERP era so planilha glorificada. Sai entendendo que por tras de cada linha de codigo existe uma empresa real.", author: "Lucas Mendonca", role: "Estagiario", category: "Outros", engagement: 2100, rer: 6 },
  { company: "SAP Brasil", text: "IA preditiva na gestao de inventario: resultados reais de 3 clientes brasileiros. Varejo: reducao de 34% em ruptura. Industria: 28% menos capital imobilizado. Distribuicao: 19% mais giro.", author: "Maria Santos", role: "VP Inovacao", category: "Produto e negocio", engagement: 1450, rer: 42 },
  { company: "SAP Brasil", text: "SAP Sapphire 2026: 3 tendencias - Business AI embutida em cada transacao, Green Ledger com contabilidade de carbono, e Composable ERP modular.", author: "Carlos Ferreira", role: "Dir. Produto", category: "Produto e negocio", engagement: 980, rer: 38 },
  { company: "SAP Brasil", text: "Customer success: como ajudamos a Ambev a transformar operacao fiscal em 90 dias. 14 plantas, 27 estados, resultado: 92% reducao em erros de classificacao e R$12M economizados.", author: "Lucas Mendes", role: "Head CS", category: "Produto e negocio", engagement: 720, rer: 35 },
  { company: "SAP Brasil", text: "Diversidade na SAP: relatório anual. Em 2025, 42% de mulheres em lideranca no Brasil. Pessoas negras 28% do quadro, programa de aceleracao formou 150 profissionais.", author: "Ana Rodrigues", role: "Head Marketing", category: "Institucional", engagement: 1100, rer: 12 },
  { company: "Oracle", text: "Migramos 100% do ERP do Bradesco para cloud em 8 meses. 2.400 processos, 180 integracoes, zero downtime. Resultado: 45% reducao TCO, performance 3x maior.", author: "Ricardo Torres", role: "CTO", category: "Produto e negocio", engagement: 1708, rer: 44 },
  { company: "Oracle", text: "5 razoes para migrar seu ERP para a nuvem em 2026: custo on-premise so aumenta, updates automaticos, escalabilidade elastica, seguranca enterprise-grade, IA nativa.", author: "Pagina oficial", role: "", official: true, category: "Produto e negocio", engagement: 188, rer: 10 },
  { company: "Oracle", text: "Por que a SAP esta certa sobre IA em ERP (e o que falta). Concordo com a tese, mas tem ponto cego: falam de IA generativa sem discutir governanca, vies e compliance.", author: "Roberto Lima", role: "CEO", category: "Produto e negocio", engagement: 1500, rer: 32 },
  { company: "Oracle", text: "Oracle Cloud World: lancamento do Oracle Fusion AI para mercado brasileiro, parceria com Embratel para cloud soberana, programa de aceleracao para ISVs locais.", author: "Fernanda Costa", role: "Dir. Comercial", category: "Institucional", engagement: 450, rer: 18 },
];

export const SOV_POSTS = [
  { company: "TOTVS", text: "Fechamos o 1T com modulo fiscal TOTVS e resultado impressionante. Adaptacao para reforma tributaria foi automatica. Para mid-market, nao tem concorrente perto.", author: "Roberto Mendes", role: "CFO", authorCompany: "Votorantim", sentiment: "positivo", engagement: 450, rer: 38 },
  { company: "TOTVS", text: "Para compliance fiscal no Brasil, recomendo TOTVS. Implementei em 12 clientes com 100% sucesso. Protheus evoluiu muito, versao cloud esta madura.", author: "Paulo Andrade", role: "Consultor Fiscal", authorCompany: "PwC", sentiment: "positivo", engagement: 320, rer: 42 },
  { company: "TOTVS", text: "Comparativo TOTVS vs SAP para mid-market. TOTVS: melhor custo, fiscal nativo. SAP: melhor IA, supply chain global. Para empresa brasileira sem operacao intl, TOTVS ganha.", author: "Thiago Lopes", role: "Analista TI", authorCompany: "Gartner", sentiment: "neutro", engagement: 890, rer: 35 },
  { company: "TOTVS", text: "8 meses tentando migrar Protheus para TOTVS Cloud. Tres vezes o prazo, escopo mudou, suporte demora dias. Experiencia frustrante.", author: "Carla Silveira", role: "Head TI", authorCompany: "Lojas Renner", sentiment: "negativo", engagement: 180, rer: 22 },
  { company: "TOTVS", text: "Implementacao TOTVS em 90 dias do zero ao go-live. Escopo enxuto, equipe dedicada. 45% reducao no fechamento contabil.", author: "Marcos Oliveira", role: "Head TI", authorCompany: "Movida", sentiment: "positivo", engagement: 540, rer: 40 },
  { company: "SAP Brasil", text: "Demo de IA generativa da SAP no Sapphire: sistema analisa 340 variaveis, gera cenarios em segundos. Implementamos versao beta, 20% menos ruptura no 1o mes.", author: "Alexandre Costa", role: "CIO", authorCompany: "Natura", sentiment: "positivo", engagement: 780, rer: 45 },
  { company: "SAP Brasil", text: "Para empresa acima de R$500M, SAP e escolha mais segura em IA para processos. Avaliamos Oracle, TOTVS e SAP. Para nosso porte, decisao certa.", author: "Fernanda Lima", role: "Consultora IA", authorCompany: "McKinsey", sentiment: "positivo", engagement: 650, rer: 38 },
  { company: "SAP Brasil", text: "SAP no Brasil: saida de executivos, reestruturacao go-to-market. Base instalada gigante, produto evoluiu, concorrencia nunca tao forte.", author: "Carlos Melo", role: "Jornalista", authorCompany: "InfoMoney", sentiment: "neutro", engagement: 1200, rer: 28 },
  { company: "SAP Brasil", text: "Custo de licenciamento SAP ficou insustentavel. Renovacao 2025: +35% sem funcionalidade nova. Para empresa brasileira com receita em real, inviavel.", author: "Diego Ferreira", role: "VP Financeiro", authorCompany: "Localfrio", sentiment: "negativo", engagement: 420, rer: 30 },
  { company: "SAP Brasil", text: "5 meses tentando integrar S/4HANA com e-commerce. Documentacao confusa, APIs mudam sem aviso, suporte generico.", author: "Lucas Rodrigues", role: "Dev Lead", authorCompany: "Magazine Luiza", sentiment: "negativo", engagement: 350, rer: 18 },
  { company: "SAP Brasil", text: "6 meses pos-migracao SAP S/4HANA Cloud: 40% reducao order-to-cash, 25% menos erros financeiros. Dificil mas valeu.", author: "Patricia Nunes", role: "VP Operacoes", authorCompany: "BRF", sentiment: "positivo", engagement: 580, rer: 42 },
  { company: "Oracle", text: "Migracao ERP para Oracle Cloud: melhor decisao de 2025. Performance 3x, custos -40%. Para enterprise no ecossistema Oracle, e no-brainer.", author: "Rafael Santos", role: "CTO", authorCompany: "Bradesco Seguros", sentiment: "positivo", engagement: 620, rer: 40 },
  { company: "Oracle", text: "Oracle Cloud vs AWS para ERP enterprise: Oracle vence em integracao nativa e custo de BD. AWS vence em flexibilidade. Para ERP puro, Oracle.", author: "Renata Souza", role: "Cloud Architect", authorCompany: "Accenture", sentiment: "neutro", engagement: 950, rer: 32 },
  { company: "Oracle", text: "Oracle subestimada no Brasil. BD imbativel, Fusion ERP evoluiu, licensing melhorou. Produto de 2026 e outro animal.", author: "Joao Augusto", role: "DBA Senior", authorCompany: "Itau", sentiment: "positivo", engagement: 280, rer: 25 },
  { company: "Oracle", text: "Cuidado com vendor lock-in Oracle. Comecamos com Oracle Cloud, agora refens. Migrar custaria 8 meses e R$2M. APIs proprietarias prendem.", author: "Marina Costa", role: "CTO", authorCompany: "Startup XYZ", sentiment: "negativo", engagement: 380, rer: 20 },
];

export const CATEGORIES = ["Todas", "Produto e negocio", "Institucional", "Vagas e RH", "Outros"];

export const COMPANY_COLORS: Record<string, string> = {
  TOTVS: "text-[#E91E8C] bg-[#E91E8C]/10",
  "SAP Brasil": "text-blue-400 bg-blue-400/10",
  Oracle: "text-orange-400 bg-orange-400/10",
};

export const MONITORED_KEYWORDS: Record<string, string[]> = {
  TOTVS: ["TOTVS", "ERP TOTVS", "Protheus", "TOTVS Cloud"],
  "SAP Brasil": ["SAP", "SAP Brasil", "SAP S4HANA", "SAP ERP", "Sapphire"],
  Oracle: ["Oracle", "Oracle Cloud", "Oracle ERP", "Oracle Fusion", "OCI"],
};

export const INFLUENCERS_DATA = [
  { name: "Ricardo Amorim", role: "Economista", company: "Ricam", followers: 85000, postsAbout: 4, avgEngagement: 1200, avgRer: 35, frequency: 4, brands: ["TOTVS", "SAP Brasil"], sentiment: "positivo", potential: "alto" },
  { name: "Mariana Lopes", role: "Consultora IA", company: "McKinsey", followers: 42000, postsAbout: 6, avgEngagement: 780, avgRer: 40, frequency: 6, brands: ["SAP Brasil", "Oracle"], sentiment: "positivo", potential: "alto" },
  { name: "Paulo Andrade", role: "Tributarista", company: "PwC", followers: 28000, postsAbout: 3, avgEngagement: 420, avgRer: 42, frequency: 3, brands: ["TOTVS"], sentiment: "positivo", potential: "alto" },
  { name: "Ana Beatriz", role: "CTO", company: "CloudFirst", followers: 35000, postsAbout: 5, avgEngagement: 650, avgRer: 32, frequency: 5, brands: ["Oracle", "SAP Brasil"], sentiment: "neutro", potential: "medio" },
  { name: "Fernando Gomes", role: "Consultor ERP", company: "Independente", followers: 18000, postsAbout: 8, avgEngagement: 520, avgRer: 38, frequency: 8, brands: ["TOTVS", "SAP Brasil", "Oracle"], sentiment: "positivo", potential: "alto" },
  { name: "Lucia Martins", role: "Head Data", company: "iFood", followers: 22000, postsAbout: 3, avgEngagement: 380, avgRer: 35, frequency: 3, brands: ["SAP Brasil"], sentiment: "neutro", potential: "medio" },
  { name: "Carlos Melo", role: "Jornalista", company: "InfoMoney", followers: 55000, postsAbout: 4, avgEngagement: 950, avgRer: 28, frequency: 4, brands: ["TOTVS", "SAP Brasil", "Oracle"], sentiment: "neutro", potential: "medio" },
  { name: "Beatriz Campos", role: "Professora", company: "FGV", followers: 15000, postsAbout: 2, avgEngagement: 280, avgRer: 30, frequency: 2, brands: ["TOTVS"], sentiment: "positivo", potential: "baixo" },
  { name: "Andre Oliveira", role: "Cloud Architect", company: "Accenture", followers: 30000, postsAbout: 4, avgEngagement: 580, avgRer: 33, frequency: 4, brands: ["Oracle"], sentiment: "positivo", potential: "medio" },
  { name: "Julia Santos", role: "VP CS", company: "RD Station", followers: 20000, postsAbout: 3, avgEngagement: 450, avgRer: 36, frequency: 3, brands: ["SAP Brasil", "TOTVS"], sentiment: "positivo", potential: "alto" },
];
