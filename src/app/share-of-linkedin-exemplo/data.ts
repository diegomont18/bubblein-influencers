export const NAV_ANALYSIS = [
  { id: "insights", label: "Insights" },
  { id: "recomendacoes", label: "Recomendações" },
  { id: "alerta", label: "Movimentos" },
  { id: "traducao", label: "Tradução Negócio" },
];

export const NAV_CONTENT = [
  { id: "ranking", label: "Ranking" },
  { id: "analise", label: "Análise Conteúdo" },
  { id: "colaboradores", label: "Colaboradores" },
  { id: "decisores", label: "Decisores" },
];

export const NAV_SECTIONS = [...NAV_ANALYSIS, ...NAV_CONTENT];

export const HIGHLIGHT_POSTS: Record<string, { positive: { title: string; author: string; rer: number; reactions: number; comments: number; why: string }; negative: { title: string; author: string; rer: number; reactions: number; comments: number; why: string }; unexpected: { title: string; author: string; reactions: number; detail: string; why: string } }> = {
  TOTVS: {
    positive: { title: "Reforma tributária: os 3 erros que já vemos nas empresas grandes", author: "Dennis Herszkowicz (CEO TOTVS)", rer: 51, reactions: 2347, comments: 89, why: "Tese específica, acionável, ancorada em autoridade. Replicar formato \"N erros que vemos\"." },
    negative: { title: "Integração nativa ERP-CRM: como nossa plataforma resolve", author: "Juliano Tubino (VP Comercial TOTVS)", rer: 12, reactions: 84, comments: 6, why: "Tom institucional, sem dor do leitor, sem dado, sem case. Decisor ignora comunicação de venda." },
    unexpected: { title: "TOTVS 42 anos - o que aprendemos nessas 4 décadas", author: "Página oficial TOTVS", reactions: 1847, detail: "4x a média", why: "Audiência aquecida para conteúdo humano/identitário e fria para tese técnica." },
  },
  "SAP Brasil": {
    positive: { title: "Como IA generativa está redefinindo o planejamento de supply chain", author: "Marcos Vidal (VP Inovação SAP Brasil)", rer: 48, reactions: 1890, comments: 72, why: "Tese com caso concreto, dados de resultado e posicionamento claro." },
    negative: { title: "Estamos contratando! Venha fazer parte do time de IA da SAP", author: "SAP Brasil (Página oficial)", rer: 8, reactions: 320, comments: 12, why: "Post de vaga disfarçado de thought leadership. RER mínimo." },
    unexpected: { title: "Meu primeiro ano como estagiário na SAP: o que aprendi", author: "Lucas Mendonça (Estagiário SAP)", reactions: 2100, detail: "5x a média de VP", why: "Autenticidade e vulnerabilidade vencem polish corporativo." },
  },
  Oracle: {
    positive: { title: "Migramos 100% do ERP do Bradesco para cloud em 8 meses", author: "Ricardo Torres (CTO Oracle Brasil)", rer: 44, reactions: 1650, comments: 58, why: "Case real com cliente de peso, números e timeline." },
    negative: { title: "5 razões para migrar seu ERP para a nuvem em 2026", author: "Oracle Brasil (Página oficial)", rer: 10, reactions: 180, comments: 8, why: "Whitepaper genérico reciclado como post. Sem ponto de vista." },
    unexpected: { title: "Por que a SAP está certa sobre IA em ERP (e o que falta)", author: "Roberto Lima (CEO Oracle Brasil)", reactions: 1500, detail: "3x a média", why: "CEO elogiando competitor gera curiosidade e debate." },
  },
};

export const COLLAB_DATA: Record<string, Array<{ name: string; role: string; posts: number; engPct: string; cat: string; badge: string; badgeColor: string; note: string }>> = {
  TOTVS: [
    { name: "TOTVS", role: "Página oficial", posts: 6, engPct: "21%", cat: "Institucional/Vagas", badge: "Média", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Alto volume mas baixo RER" },
    { name: "Dennis Herszkowicz", role: "CEO", posts: 12, engPct: "52%", cat: "Reforma Tributária", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "RER 51% no post sobre reforma" },
    { name: "Juliano Tubino", role: "VP Comercial", posts: 8, engPct: "19%", cat: "Produto/Plataforma", badge: "Média", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Tom institucional reduz impacto" },
    { name: "Gustavo Bastos", role: "CFO", posts: 4, engPct: "8%", cat: "Gestão Financeira", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Engaja CFOs e Controllers" },
    { name: "Marcelo Cosentino", role: "VP Tecnologia", posts: 0, engPct: "0%", cat: "-", badge: "Inativo 45d", badgeColor: "text-gray-500 bg-gray-500/10", note: "Voz técnica ausente (CIO/CTO)" },
    { name: "Sergio Campos", role: "VP Produto", posts: 0, engPct: "0%", cat: "-", badge: "Inativo 60d", badgeColor: "text-gray-500 bg-gray-500/10", note: "Território de produto sem voz" },
  ],
  "SAP Brasil": [
    { name: "SAP Brasil", role: "Página oficial", posts: 4, engPct: "12%", cat: "Institucional/Vagas", badge: "Baixa", badgeColor: "text-red-400 bg-red-400/10", note: "Vagas e institucional, baixo RER" },
    { name: "Maria Santos", role: "VP Inovação", posts: 15, engPct: "22%", cat: "IA + Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Principal voz em IA" },
    { name: "Carlos Ferreira", role: "Dir. Produto", posts: 12, engPct: "18%", cat: "Produto", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Conteúdo técnico consistente" },
    { name: "Ana Rodrigues", role: "Head Marketing", posts: 10, engPct: "15%", cat: "Institucional", badge: "Média", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Foco institucional, baixo RER" },
    { name: "Pedro Almeida", role: "Dir. Engenharia", posts: 8, engPct: "13%", cat: "Tech/Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Engaja público técnico CTO" },
    { name: "Lucas Mendes", role: "Head CS", posts: 6, engPct: "10%", cat: "Cases", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Cases reais com clientes" },
  ],
  Oracle: [
    { name: "Oracle Brasil", role: "Página oficial", posts: 2, engPct: "8%", cat: "Institucional", badge: "Baixa", badgeColor: "text-red-400 bg-red-400/10", note: "Pouca atividade oficial" },
    { name: "Roberto Lima", role: "CEO", posts: 14, engPct: "71%", cat: "ERP Cloud", badge: "Alta", badgeColor: "text-green-400 bg-green-400/10", note: "Concentração extrema" },
    { name: "Fernanda Costa", role: "Dir. Comercial", posts: 3, engPct: "18%", cat: "Vendas", badge: "Média", badgeColor: "text-yellow-400 bg-yellow-400/10", note: "Poucos posts, foco comercial" },
    { name: "André Souza", role: "Head Tech", posts: 1, engPct: "11%", cat: "Cloud", badge: "Baixa", badgeColor: "text-red-400 bg-red-400/10", note: "Quase inativo" },
  ],
};

export const ALL_POSTS = [
  { company: "TOTVS", text: "Reforma tributária: os 3 erros que já vemos nas empresas grandes. Identificamos três padrões: subestimar impacto no fluxo de caixa, não revisar contratos com fornecedores, e deixar para atualizar o ERP nos últimos 60 dias. O erro #3 é o mais caro.", author: "Dennis Herszkowicz", role: "CEO", category: "Produto e negócio", engagement: 2436, rer: 51 },
  { company: "TOTVS", text: "TOTVS 42 anos - o que aprendemos nessas 4 décadas. Quando começamos em 1983, software de gestão era coisa de multinacional. Hoje, mais de 70 mil empresas brasileiras rodam na nossa plataforma. Tecnologia brasileira precisa resolver problemas brasileiros.", author: "Página oficial", role: "", official: true, category: "Institucional", engagement: 1847, rer: 15 },
  { company: "TOTVS", text: "Integração nativa ERP-CRM: como nossa plataforma resolve o desafio que toda empresa enfrenta. Com a integração nativa, eliminamos middleware e reduzimos tempo de implementação em 60%.", author: "Juliano Tubino", role: "VP Comercial", category: "Produto e negócio", engagement: 90, rer: 12 },
  { company: "TOTVS", text: "Estamos contratando! Vagas abertas em tecnologia na TOTVS. Procuramos desenvolvedores Python, engenheiros de dados e especialistas em IA para nosso time de inovação.", author: "Página oficial", role: "", official: true, category: "Vagas e RH", engagement: 520, rer: 5 },
  { company: "TOTVS", text: "O futuro da gestão financeira no Brasil passa por três pilares: automação fiscal inteligente, real-time analytics e compliance preditivo. Empresas que adotam essas capacidades crescem 2,3x mais rápido.", author: "Gustavo Bastos", role: "CFO", category: "Produto e negócio", engagement: 380, rer: 44 },
  { company: "TOTVS", text: "TOTVS no evento SAP Sapphire - o que aprendemos. Eles apostam pesado em IA generativa, mas ainda sem cases concretos no Brasil. O discurso de plataforma global não ressoa com o mid-market brasileiro.", author: "Dennis Herszkowicz", role: "CEO", category: "Institucional", engagement: 890, rer: 28 },
  { company: "TOTVS", text: "Resultado do 4T25: crescimento de 18% em receita recorrente, superando guidance. Receita recorrente atingiu R$1,2bi no trimestre. Churn caiu para 0,8% - o menor da história.", author: "Página oficial", role: "", official: true, category: "Institucional", engagement: 1200, rer: 22 },
  { company: "SAP Brasil", text: "Como IA generativa está redefinindo o planejamento de supply chain. Nosso módulo reduziu tempo de planejamento de demanda de 5 dias para 4 horas. O modelo analisa 340 variáveis simultaneamente.", author: "Marcos Vidal", role: "VP Inovação", category: "Produto e negócio", engagement: 1962, rer: 48 },
  { company: "SAP Brasil", text: "Estamos contratando! Venha fazer parte do time de IA da SAP Brasil. Buscamos cientistas de dados, engenheiros de ML e product managers para nosso hub de inovação em São Paulo.", author: "Página oficial", role: "", official: true, category: "Vagas e RH", engagement: 332, rer: 8 },
  { company: "SAP Brasil", text: "Meu primeiro ano como estagiário na SAP: entrei achando que ERP era só planilha glorificada. Saí entendendo que por trás de cada linha de código existe uma empresa real.", author: "Lucas Mendonça", role: "Estagiário", category: "Outros", engagement: 2100, rer: 6 },
  { company: "SAP Brasil", text: "IA preditiva na gestão de inventário: resultados reais de 3 clientes brasileiros. Varejo: redução de 34% em ruptura. Indústria: 28% menos capital imobilizado. Distribuição: 19% mais giro.", author: "Maria Santos", role: "VP Inovação", category: "Produto e negócio", engagement: 1450, rer: 42 },
  { company: "SAP Brasil", text: "SAP Sapphire 2026: 3 tendências - Business AI embutida em cada transação, Green Ledger com contabilidade de carbono, e Composable ERP modular.", author: "Carlos Ferreira", role: "Dir. Produto", category: "Produto e negócio", engagement: 980, rer: 38 },
  { company: "SAP Brasil", text: "Customer success: como ajudamos a Ambev a transformar operação fiscal em 90 dias. 14 plantas, 27 estados, resultado: 92% redução em erros de classificação e R$12M economizados.", author: "Lucas Mendes", role: "Head CS", category: "Produto e negócio", engagement: 720, rer: 35 },
  { company: "SAP Brasil", text: "Diversidade na SAP: relatório anual. Em 2025, 42% de mulheres em liderança no Brasil. Pessoas negras 28% do quadro, programa de aceleração formou 150 profissionais.", author: "Ana Rodrigues", role: "Head Marketing", category: "Institucional", engagement: 1100, rer: 12 },
  { company: "Oracle", text: "Migramos 100% do ERP do Bradesco para cloud em 8 meses. 2.400 processos, 180 integrações, zero downtime. Resultado: 45% redução TCO, performance 3x maior.", author: "Ricardo Torres", role: "CTO", category: "Produto e negócio", engagement: 1708, rer: 44 },
  { company: "Oracle", text: "5 razões para migrar seu ERP para a nuvem em 2026: custo on-premise só aumenta, updates automáticos, escalabilidade elástica, segurança enterprise-grade, IA nativa.", author: "Página oficial", role: "", official: true, category: "Produto e negócio", engagement: 188, rer: 10 },
  { company: "Oracle", text: "Por que a SAP está certa sobre IA em ERP (e o que falta). Concordo com a tese, mas tem ponto cego: falam de IA generativa sem discutir governança, viés e compliance.", author: "Roberto Lima", role: "CEO", category: "Produto e negócio", engagement: 1500, rer: 32 },
  { company: "Oracle", text: "Oracle Cloud World: lançamento do Oracle Fusion AI para mercado brasileiro, parceria com Embratel para cloud soberana, programa de aceleração para ISVs locais.", author: "Fernanda Costa", role: "Dir. Comercial", category: "Institucional", engagement: 450, rer: 18 },
];

export const SOV_POSTS = [
  { company: "TOTVS", text: "Fechamos o 1T com módulo fiscal TOTVS e resultado impressionante. Adaptação para reforma tributária foi automática. Para mid-market, não tem concorrente perto.", author: "Roberto Mendes", role: "CFO", authorCompany: "Votorantim", sentiment: "positivo", engagement: 450, rer: 38 },
  { company: "TOTVS", text: "Para compliance fiscal no Brasil, recomendo TOTVS. Implementei em 12 clientes com 100% sucesso. Protheus evoluiu muito, versão cloud está madura.", author: "Paulo Andrade", role: "Consultor Fiscal", authorCompany: "PwC", sentiment: "positivo", engagement: 320, rer: 42 },
  { company: "TOTVS", text: "Comparativo TOTVS vs SAP para mid-market. TOTVS: melhor custo, fiscal nativo. SAP: melhor IA, supply chain global. Para empresa brasileira sem operação intl, TOTVS ganha.", author: "Thiago Lopes", role: "Analista TI", authorCompany: "Gartner", sentiment: "neutro", engagement: 890, rer: 35 },
  { company: "TOTVS", text: "8 meses tentando migrar Protheus para TOTVS Cloud. Três vezes o prazo, escopo mudou, suporte demora dias. Experiência frustrante.", author: "Carla Silveira", role: "Head TI", authorCompany: "Lojas Renner", sentiment: "negativo", engagement: 180, rer: 22 },
  { company: "TOTVS", text: "Implementação TOTVS em 90 dias do zero ao go-live. Escopo enxuto, equipe dedicada. 45% redução no fechamento contábil.", author: "Marcos Oliveira", role: "Head TI", authorCompany: "Movida", sentiment: "positivo", engagement: 540, rer: 40 },
  { company: "SAP Brasil", text: "Demo de IA generativa da SAP no Sapphire: sistema analisa 340 variáveis, gera cenários em segundos. Implementamos versão beta, 20% menos ruptura no 1º mês.", author: "Alexandre Costa", role: "CIO", authorCompany: "Natura", sentiment: "positivo", engagement: 780, rer: 45 },
  { company: "SAP Brasil", text: "Para empresa acima de R$500M, SAP é escolha mais segura em IA para processos. Avaliamos Oracle, TOTVS e SAP. Para nosso porte, decisão certa.", author: "Fernanda Lima", role: "Consultora IA", authorCompany: "McKinsey", sentiment: "positivo", engagement: 650, rer: 38 },
  { company: "SAP Brasil", text: "SAP no Brasil: saída de executivos, reestruturação go-to-market. Base instalada gigante, produto evoluiu, concorrência nunca tão forte.", author: "Carlos Melo", role: "Jornalista", authorCompany: "InfoMoney", sentiment: "neutro", engagement: 1200, rer: 28 },
  { company: "SAP Brasil", text: "Custo de licenciamento SAP ficou insustentável. Renovação 2025: +35% sem funcionalidade nova. Para empresa brasileira com receita em real, inviável.", author: "Diego Ferreira", role: "VP Financeiro", authorCompany: "Localfrio", sentiment: "negativo", engagement: 420, rer: 30 },
  { company: "SAP Brasil", text: "5 meses tentando integrar S/4HANA com e-commerce. Documentação confusa, APIs mudam sem aviso, suporte genérico.", author: "Lucas Rodrigues", role: "Dev Lead", authorCompany: "Magazine Luiza", sentiment: "negativo", engagement: 350, rer: 18 },
  { company: "SAP Brasil", text: "6 meses pós-migração SAP S/4HANA Cloud: 40% redução order-to-cash, 25% menos erros financeiros. Difícil mas valeu.", author: "Patricia Nunes", role: "VP Operações", authorCompany: "BRF", sentiment: "positivo", engagement: 580, rer: 42 },
  { company: "Oracle", text: "Migração ERP para Oracle Cloud: melhor decisão de 2025. Performance 3x, custos -40%. Para enterprise no ecossistema Oracle, é no-brainer.", author: "Rafael Santos", role: "CTO", authorCompany: "Bradesco Seguros", sentiment: "positivo", engagement: 620, rer: 40 },
  { company: "Oracle", text: "Oracle Cloud vs AWS para ERP enterprise: Oracle vence em integração nativa e custo de BD. AWS vence em flexibilidade. Para ERP puro, Oracle.", author: "Renata Souza", role: "Cloud Architect", authorCompany: "Accenture", sentiment: "neutro", engagement: 950, rer: 32 },
  { company: "Oracle", text: "Oracle subestimada no Brasil. BD imbatível, Fusion ERP evoluiu, licensing melhorou. Produto de 2026 é outro animal.", author: "João Augusto", role: "DBA Senior", authorCompany: "Itaú", sentiment: "positivo", engagement: 280, rer: 25 },
  { company: "Oracle", text: "Cuidado com vendor lock-in Oracle. Começamos com Oracle Cloud, agora reféns. Migrar custaria 8 meses e R$2M. APIs proprietárias prendem.", author: "Marina Costa", role: "CTO", authorCompany: "Startup XYZ", sentiment: "negativo", engagement: 380, rer: 20 },
];

export const CATEGORIES = ["Todas", "Produto e negócio", "Institucional", "Vagas e RH", "Outros"];

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
  { name: "Ana Beatriz", role: "CTO", company: "CloudFirst", followers: 35000, postsAbout: 5, avgEngagement: 650, avgRer: 32, frequency: 5, brands: ["Oracle", "SAP Brasil"], sentiment: "neutro", potential: "médio" },
  { name: "Fernando Gomes", role: "Consultor ERP", company: "Independente", followers: 18000, postsAbout: 8, avgEngagement: 520, avgRer: 38, frequency: 8, brands: ["TOTVS", "SAP Brasil", "Oracle"], sentiment: "positivo", potential: "alto" },
  { name: "Lúcia Martins", role: "Head Data", company: "iFood", followers: 22000, postsAbout: 3, avgEngagement: 380, avgRer: 35, frequency: 3, brands: ["SAP Brasil"], sentiment: "neutro", potential: "médio" },
  { name: "Carlos Melo", role: "Jornalista", company: "InfoMoney", followers: 55000, postsAbout: 4, avgEngagement: 950, avgRer: 28, frequency: 4, brands: ["TOTVS", "SAP Brasil", "Oracle"], sentiment: "neutro", potential: "médio" },
  { name: "Beatriz Campos", role: "Professora", company: "FGV", followers: 15000, postsAbout: 2, avgEngagement: 280, avgRer: 30, frequency: 2, brands: ["TOTVS"], sentiment: "positivo", potential: "baixo" },
  { name: "André Oliveira", role: "Cloud Architect", company: "Accenture", followers: 30000, postsAbout: 4, avgEngagement: 580, avgRer: 33, frequency: 4, brands: ["Oracle"], sentiment: "positivo", potential: "médio" },
  { name: "Júlia Santos", role: "VP CS", company: "RD Station", followers: 20000, postsAbout: 3, avgEngagement: 450, avgRer: 36, frequency: 3, brands: ["SAP Brasil", "TOTVS"], sentiment: "positivo", potential: "alto" },
];

export const INFLUENCER_MENTIONS: Record<string, Array<{ date: string; brand: string; text: string; sentiment: string }>> = {
  "Ricardo Amorim": [
    { date: "2026-03-22", brand: "TOTVS", text: "A reforma tributária vai mudar tudo e a TOTVS está na frente. Conversei com 3 CFOs que migraram e todos elogiam o módulo fiscal.", sentiment: "positivo" },
    { date: "2026-03-15", brand: "SAP Brasil", text: "SAP apostando pesado em IA. Vi a demo no Sapphire e fiquei impressionado com a velocidade de processamento.", sentiment: "positivo" },
    { date: "2026-03-08", brand: "TOTVS", text: "Para mid-market brasileiro, custo-benefício da TOTVS ainda é imbatível. Dados do meu último relatório confirmam.", sentiment: "positivo" },
    { date: "2026-03-01", brand: "SAP Brasil", text: "Comparando ERPs enterprise: SAP lidera em IA mas custo preocupa. TOTVS ganha em fiscal.", sentiment: "neutro" },
  ],
  "Mariana Lopes": [
    { date: "2026-03-25", brand: "SAP Brasil", text: "O módulo de IA generativa da SAP para supply chain é o mais avançado que já vi. Testei com 3 clientes.", sentiment: "positivo" },
    { date: "2026-03-18", brand: "Oracle", text: "Oracle Cloud evolui rápido mas precisa resolver o vendor lock-in. Clientes reclamam.", sentiment: "neutro" },
    { date: "2026-03-10", brand: "SAP Brasil", text: "Recomendo SAP para enterprise acima de R$500M. ROI comprovado em 6 meses.", sentiment: "positivo" },
  ],
  "Paulo Andrade": [
    { date: "2026-03-20", brand: "TOTVS", text: "Implementei TOTVS em mais 2 clientes este mês. Compliance fiscal automático é game changer.", sentiment: "positivo" },
    { date: "2026-03-12", brand: "TOTVS", text: "Protheus evoluiu muito. A versão cloud está madura para mid-market.", sentiment: "positivo" },
  ],
  "Ana Beatriz": [
    { date: "2026-03-24", brand: "Oracle", text: "Migração para Oracle Cloud: performance 3x melhor mas processo de 8 meses.", sentiment: "neutro" },
    { date: "2026-03-16", brand: "SAP Brasil", text: "S/4HANA tem potencial mas integração com sistemas legados é complexa.", sentiment: "neutro" },
  ],
  "Fernando Gomes": [
    { date: "2026-03-28", brand: "TOTVS", text: "TOTVS Cloud finalmente maduro. Recomendo para empresas de 200 a 2000 funcionários.", sentiment: "positivo" },
    { date: "2026-03-21", brand: "SAP Brasil", text: "SAP Sapphire impressionou em IA mas falta cases concretos no Brasil.", sentiment: "neutro" },
    { date: "2026-03-14", brand: "Oracle", text: "Oracle Fusion ERP: produto bom, marca carrega peso do passado.", sentiment: "positivo" },
    { date: "2026-03-07", brand: "TOTVS", text: "Comparativo ERP mid-market: TOTVS ganha em fiscal, SAP em IA, Oracle em cloud.", sentiment: "neutro" },
  ],
  "Lúcia Martins": [
    { date: "2026-03-19", brand: "SAP Brasil", text: "Usando SAP para analytics de dados no iFood. Integração com data lake foi tranquila.", sentiment: "positivo" },
  ],
  "Carlos Melo": [
    { date: "2026-03-26", brand: "SAP Brasil", text: "Análise: SAP reestrutura go-to-market no Brasil focando em IA e cloud.", sentiment: "neutro" },
    { date: "2026-03-17", brand: "TOTVS", text: "TOTVS reporta crescimento de 18% em receita recorrente. Mid-market continua forte.", sentiment: "neutro" },
  ],
  "Beatriz Campos": [
    { date: "2026-03-13", brand: "TOTVS", text: "Usando TOTVS como case study em aula de sistemas de gestão na FGV. Bom exemplo de ERP brasileiro.", sentiment: "positivo" },
  ],
  "André Oliveira": [
    { date: "2026-03-23", brand: "Oracle", text: "Oracle Cloud vs AWS para ERP: Oracle vence em integração nativa e custo de BD.", sentiment: "positivo" },
    { date: "2026-03-11", brand: "Oracle", text: "Arquitetura cloud da Oracle para ERP enterprise é sólida. Recomendo para workloads pesados.", sentiment: "positivo" },
  ],
  "Júlia Santos": [
    { date: "2026-03-27", brand: "SAP Brasil", text: "Customer success na SAP: vi como ajudaram Ambev a transformar operação fiscal. Impressionante.", sentiment: "positivo" },
    { date: "2026-03-09", brand: "TOTVS", text: "TOTVS tem o melhor suporte para mid-market. Na RD Station usamos e funciona bem.", sentiment: "positivo" },
  ],
};
