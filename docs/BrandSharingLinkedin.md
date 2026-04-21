Nome: Share of Linkedin

Conceito:
Plataforma que monitora continuamente o LinkedIn do nicho do cliente, analisa o que concorrentes e referências estão publicando, identifica o que funciona e entrega recomendações estratégicas de conteúdo toda semana.

Funcionalidade 1: mapeamento de mercado
Cliente informa o linkedin da empresa. Entao, nossa plataforma faz uma busca no linkedin para mapear: 1. perfis de colaboradores da empresa ativos 2. empresas concorrentes 3. temas de interesse do mercado 4. ICP da empresa. E entao, o user pode editar todos esses 4 campos

Funcionalidade 2: analise do mercado share of linkedin da marca
Quando o User Confirma O sistema coleta e analisa todos os posts desses perfis, agrupa por temas via IA semântica, compara desempenho e entrega relatório semanal com diagnóstico competitivo e três recomendações de conteúdo com tema, ângulo, justificativa e referências. O objetivo é ter dois beneficios / outcomes: 1. saber com é o engajamento dos concorrentes vs a empresa... mas de uma forma inteligente... posts motivacionais ou de anuncio de vagas devem ser ignorados, e quanto ao engajamento deve-se considerar os decisores que se engajaram qual o RER (revunue engajement rate) 2. saber quais temas e como a empresa deve postar, deve vir uma lista de recomendacoes

Objetivo:
Eliminar o ponto cego que empresas B2B têm sobre o LinkedIn do seu nicho. Transformar decisão de conteúdo de intuição em estratégia baseada em dados reais do mercado.
Benefícios:
Saber o que concorrentes estão fazendo e o que funciona pra eles. Descobrir lacunas temáticas que ninguém está explorando. Receber orientação semanal do que postar e por quê. Medir evolução da presença ao longo do tempo vs mercado. Economizar horas de análise manual.
Diferencial:
Análise qualitativa com IA em vez de dashboards quantitativos. Foco exclusivo em LinkedIn B2B. Recomendações estratégicas acionáveis, não só métricas. Construído para o mercado brasileiro em português. Modelo multi-perfil que reflete a realidade de que pessoas geram mais impacto que páginas de empresa.


Os 3 actors que resolvem 80% do problema
1. Company Scraper (ex.: data-slayer/linkedin-company-scraper — retorna até 10 "similar pages" (empresas concorrentes/peer que o LinkedIn recomenda), até 54 "affiliated pages", posts recentes da página e dados completos da empresa Apify. Alternativa: dev_fusion/linkedin-company-scraper.
2. Company Employees Scraper (ex.: apimaestro/linkedin-company-employees-scraper-no-cookies ou harvestapi/linkedin-company-employees) — lista funcionários públicos com nome, cargo, URL do perfil. Custo típico: ~$4 por 1.000 funcionários, sem necessidade de cookies/login Apify.
3. Profile Posts Scraper (ex.: apimaestro/linkedin-profile-posts ou harvestapi/linkedin-profile-posts) — extrai posts de um perfil com engajamento, reações, comentários, a $2 por 1.000 posts, sem cookies Apify.
4. Post Search Scraper (ex.: harvestapi/linkedin-post-search ou apimaestro/linkedin-posts-search-scraper-no-cookies) — busca posts por keyword com filtros avançados do LinkedIn, $1,2 por 1.000 posts Apify. Esse é o que abre a porta para referências de mercado.

O pipeline BubbleIn
Input: URL do LinkedIn da empresa do cliente.
Passo 0 — Hidratação da empresa
Rodar o Company Scraper na empresa do cliente. Você extrai de uma tacada só: similar_pages (sua lista de concorrentes), specialties + industry + posts recentes (matéria-prima pra extrair as keywords do nicho via LLM).
Passo 1 — Funcionários influentes da empresa

Rodar Employees Scraper na URL da empresa → lista de perfis.
Pré-filtro barato: descartar estagiários, operacional puro, cargos sem potencial B2B (regex simples em job_title). Isso economiza créditos de scraping no próximo passo.
Rodar Profile Posts Scraper nos perfis sobreviventes, pegando últimos ~30/90 dias.
Calcular score de atividade: posts/mês, engajamento médio, proporção de posts próprios vs. reposts. Quem fica acima de um threshold (ex.: ≥4 posts originais/mês) entra como "funcionário influente".

Passo 2 — Concorrentes e seus funcionários

Pegar similar_pages do Passo 0. Se quiser ampliar, rodar Company Scraper em cada uma para pegar as similar_pages delas (efeito segunda camada, ótimo para mapear o cluster competitivo).
Validar com LLM se cada "similar page" é de fato concorrente direto (LinkedIn às vezes sugere peer por indústria, não por proposta).
Reaplicar exatamente o Passo 1 em cada concorrente validado.

Passo 3 — Referências de mercado (não-concorrentes)
Aqui a lógica muda: você não parte de empresas, parte de temas.

Extrair 5–15 keywords do nicho dos posts da empresa + descrição + specialties (usa LLM).
Rodar Post Search Scraper para cada keyword, pegando posts dos últimos 90 dias com alto engajamento.
Agregar por autor: quem aparece em múltiplas buscas, com alta frequência, alto engajamento médio.
Filtro crítico: remover autores cuja empresa atual esteja na lista do Passo 0 ou Passo 2. O que sobra = criadores relevantes no tema que não são nem cliente nem concorrente. Aí você aplica o B2B Relevance Score normal de vocês em cima.


Pontos de atenção técnicos

Anti-bot: LinkedIn às vezes retorna status 999; o scraper pula e loga warning — bloqueio é temporário e rotativo Apify. Planeje retries com backoff e idempotência.
Custo: uma empresa média com 500 funcionários + 5 concorrentes + 500 funcionários cada = ~3k perfis × $4/1k = $12 só em employees + custos de posts. Vale cachear por 7–14 dias e só refreshar o que o usuário pedir.
Concorrência dos actors: harvestapi processa 6 perfis/empresas por vez Apify — se BubbleIn escalar, você vai precisar rodar múltiplos actors em paralelo ou orquestrar filas.
Legal (o risco que você já tinha mapeado): esses actors operam sem login/cookies, o que reduz bastante a exposição em termos de ToS da LinkedIn, mas não elimina. A LGPD também se aplica — você está tratando dado pessoal de profissionais. Vale alinhar com jurídico antes de botar em produção, especialmente pelo fato de a base ser brasileira e B2B.

Estratégias para viabilizar o trial
1. Limite o escopo do trial (o mais óbvio)
No trial, não mapeia 500 funcionários — mapeia só os top 20-30 por cargo. Pré-filtra no Employees Scraper por títulos relevantes (C-level, Head, Director, VP, Manager). Cai de $4 para ~$0,10 por empresa. E é justamente o segmento que importa no B2B Relevance Score.
2. Cache agressivo compartilhado entre usuários
O LinkedIn do Nubank é o mesmo LinkedIn do Nubank pra todo mundo. Se o Cliente A mapeou a Stone hoje, o Cliente B que pedir Stone amanhã puxa do seu banco — custo zero. Com TTL de 14-30 dias, depois do primeiro mês de operação a maioria das consultas vai ser cache hit. Isso é o que viabiliza o freemium de verdade.
3. Trial com empresa pré-computada
Em vez de deixar o usuário digitar qualquer URL, ofereça no trial 5-10 empresas brasileiras já mapeadas (Nubank, Stone, RD Station, Hotmart, Resultados Digitais, etc.). Custo marginal = 0. O usuário vê a qualidade do produto sem você pagar nada por ele.
4. Mapeamento assíncrono + fila
No trial, o mapeamento não é instantâneo: usuário entra na fila e recebe resultado em 24h. Isso permite você batar requests, rodar em horário de créditos sobrando, e principalmente dar desistência natural — boa parte não volta, e você nem gastou.
5. Só Passo 1 no trial, Passos 2 e 3 no pago
O trial entrega "funcionários influentes da sua empresa" (~$0,10-1 com o filtro do item 1). Concorrentes e referências de mercado ficam no plano pago. Isso também reforça a proposta de valor da conversão.
6. Reduzir janela temporal de posts
No trial, analisa últimos 30 dias em vez de 90 — corta custo do Profile Posts Scraper em 3x.
Matemática realista do trial
Com #1 + #3 + #5 juntos:

Usuário seleciona empresa pré-cacheada → $0
Ou digita empresa nova, limitada a top 30 cargos → ~$0,12 em employees
Posts dos 30 perfis, últimos 30 dias, ~10 posts cada = 300 posts × $0,002 = $0,60
Total: ~$0,70 por trial de empresa nova, $0 se for cacheada

Com volume decente de trials, você paga $20-50/mês em Apify pra manter o freemium rodando. Perfeitamente absorvível.