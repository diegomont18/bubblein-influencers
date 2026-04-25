# Redesign — Share of LinkedIn

**Exemplo:** TOTVS vs SAP Brasil vs Sankhya
**Período:** Mensal (relatório referente a março de 2026)
**Ordem das seções:** Header → Executive Summary → Alerta do Mês → Ranking com Movimento → Análise de Conteúdo → Cobertura de Perfis Monitorados → Decisores Engajados → Recomendações Estratificadas → Apostas Priorizadas → Tradução para Negócio → CTA

---

## Glossário de métricas (tooltips clicáveis)

Toda métrica da página tem um ícone "ⓘ" ao lado. Ao clicar/passar o mouse, abre um snippet explicativo. Lista das definições:

- **ⓘ Share of Voice (SoV)** — Percentual da conversa total do nicho capturada pela empresa. Calculado como: (engajamento qualificado dos perfis da empresa ÷ engajamento qualificado total do set competitivo) × 100. Agrega engajamento de todos os perfis monitorados, não só da página oficial.

- **ⓘ RER (Revenue Engagement Rate)** — Percentual do engajamento total que vem de decisores do seu ICP (C-level, diretores, heads). Fórmula: (interações de decisores ÷ interações totais) × 100. Mede **qualidade** do engajamento, não volume. Benchmark do setor de software B2B no Brasil: 28%.

- **ⓘ Posts analisados** — Total de posts publicados no período pelos perfis monitorados (oficial + colaboradores). Exclui reposts sem comentário.

- **ⓘ Decisores engajados** — Pessoas únicas do ICP (C-level, diretores, heads) que curtiram, comentaram ou compartilharam pelo menos um post no período. Deduplicado por pessoa, não por interação.

- **ⓘ Top tema** — Tema com maior volume de engajamento qualificado no período, identificado por clusterização semântica dos posts.

---

## 1. Header

Minimalista. Tirar a faixa laranja grande do topo — vira um badge pequeno "[exemplo]" ao lado do título.

> **Relatório Mensal — Share of LinkedIn** `[exemplo]`
> TOTVS · Março de 2026 · Set competitivo: SAP Brasil, Sankhya

Uma linha única abaixo do título com a leitura do mês em uma frase:

> *"Mês de perda de terreno em IA+ERP, defesa consistente em reforma tributária."*

---

## 2. Executive Summary (substitui os 4 KPIs soltos)

**Em tópicos, não em prosa.** Este é o bloco mais importante da página — o que o CMO lê em 15 segundos.

> **A leitura do mês**
>
> - **O que perdemos:** SAP assumiu liderança em IA aplicada a ERP (−3% de Share of Voice para a TOTVS no tema). A SAP triplicou a frequência de posts e atraiu 47 decisores de TI que não tocamos no mês.
> - **O que defendemos:** Território de reforma tributária segue nosso. Post do Dennis Herszkowicz foi o mais engajado do mês entre os três (RER 51%).
> - **Ameaça silenciosa:** Sankhya construiu autoridade em "ERP para PMEs" sem resposta nossa — 18 posts no mês, todos acima de 35% de RER.
> - **Padrão central:** Estamos ganhando no buyer financeiro (CFO, Controller) e perdendo no buyer tecnológico (CIO, CTO). A aposta da SAP em IA está capturando justamente quem fecha deal enterprise.

**Abaixo desse bloco**, uma linha fina com os KPIs (não cards gigantes):

> Share of Voice: **34% (ⓘ)** · RER: **42% (ⓘ)** · Posts analisados: **187 (ⓘ)** · Decisores engajados: **142 (ⓘ)**

Todos com tooltip clicável (ver glossário acima).

---

## 3. Sinal de Alerta

Card único em destaque, com cor diferente do resto da página (ex: âmbar sutil). É o que o CMO precisa ver se só olhar por 10 segundos.

> 🔔 **Movimento incomum — SAP Brasil**
>
> - **O que observamos:** 42 posts sobre IA Generativa aplicada a ERP no mês — **3,2x a média histórica** da SAP no tema.
> - **Quem está publicando:** 8 colaboradores diferentes postaram sobre IA, incluindo 3 que raramente postam (Diretor de Produto, VP de Inovação, Head de Customer Success).
> - **Padrão típico de:** semana pré-lançamento ou pré-evento. Coordenação de topo.
> - **Recomendação:** monitorar os próximos 30 dias de perto.

---

## 4. Ranking Competitivo com Movimento

Três mudanças versus a tabela atual:

- Coluna de **variação de posição** (↑ ↓ =) vs. mês anterior
- **Mini-sparkline** de 8 meses ao lado do nome
- **Variação numérica** em cada coluna principal

| # | Empresa | SoV ⓘ | RER ⓘ | Posts ⓘ | Decisores ⓘ | Top Tema ⓘ |
|---|---------|-------|-------|---------|-------------|------------|
| 1 ↑1 | **SAP Brasil** ▁▂▃▅▆▇█ | 41% (+5%) | 45% (+3%) | 142 (+48) | 287 (+52%) | IA + ERP |
| 2 ↓1 | **TOTVS** ▇▆▅▄▅▄▄▃ | 34% (−3%) | 42% (+5%) | 87 (−6) | 198 (−8%) | Reforma Tributária |
| 3 = | **Sankhya** ▂▃▃▄▄▅▆▆ | 18% (+2%) | 38% (+4%) | 58 (+12) | 94 (+31%) | ERP para PMEs |

**Leitura abaixo da tabela:**

> *SAP assume liderança pela primeira vez em 9 meses, puxada pela aposta em IA. Sankhya cresce de forma consistente há 6 meses consecutivos.*

---

## 5. Análise de Conteúdo por Empresa (BLOCO NOVO)

**Por que esse bloco existe:** número de posts é métrica enganosa. O que importa é **o que está sendo publicado**. Empresas que publicam muita vaga e institucional parecem ativas no dashboard, mas não estão construindo autoridade.

### 5.1. Composição do conteúdo publicado no mês

Três barras horizontais empilhadas — uma por empresa — mostrando o percentual de cada tipo de conteúdo:

**TOTVS — 87 posts**
- 🏢 Institucional (eventos, prêmios, anúncios corporativos): **38%**
- 💼 Vagas e RH: **22%**
- 📊 Produto e negócio (cases, tese, insights de mercado): **34%**
- 📎 Outros (motivacional, parabenizações): **6%**

**SAP Brasil — 142 posts**
- 🏢 Institucional: **28%**
- 💼 Vagas e RH: **18%**
- 📊 Produto e negócio: **49%**
- 📎 Outros: **5%**

**Sankhya — 58 posts**
- 🏢 Institucional: **25%**
- 💼 Vagas e RH: **15%**
- 📊 Produto e negócio: **55%**
- 📎 Outros: **5%**

**Diagnóstico abaixo das barras:**

> ⚠️ **TOTVS publica 60% de conteúdo que não constrói pipeline** (institucional + vagas). SAP está em 46%. Sankhya em 40%. Isso explica parcialmente por que nossos concorrentes têm RER maior apesar de ICPs semelhantes.

### 5.2. Posts em destaque do mês

Três categorias — positivo, negativo e inesperado — cada uma com post específico.

**✅ Destaque positivo — Produto/negócio com alto engajamento**
> **"Reforma tributária: os 3 erros que já vemos nas empresas grandes"** — Dennis Herszkowicz (CEO TOTVS)
> - RER: 51% · Reações: 2.347 · Comentários qualificados: 89
> - **Por que funciona:** tese específica, acionável, ancorada em autoridade de quem tem contexto. Replicar o formato "N erros que vemos" em outros temas.

**❌ Destaque negativo — Produto/negócio com engajamento fraco**
> **"Integração nativa ERP-CRM: como nossa plataforma resolve"** — Juliano Tubino (VP Comercial TOTVS)
> - RER: 12% · Reações: 84 · Comentários: 6
> - **Por que falhou:** tom institucional ("nossa plataforma resolve"), sem dor específica do leitor, sem dado, sem case. Audiência de decisor ignora comunicação de venda.

**🔄 Destaque inesperado — Institucional com engajamento excessivo**
> **"TOTVS 42 anos — o que aprendemos nessas 4 décadas"** — Página oficial TOTVS
> - Reações: 1.847 (4x a média de qualquer post de produto no mês)
> - **O que isso nos diz:** a audiência está aquecida para conteúdo humano/identitário e fria para tese técnica. Sinal de que o mix de conteúdo está desbalanceado — falta tese de negócio com voz humana.

---

## 6. Cobertura de Perfis Monitorados (BLOCO NOVO — diferencial da BubbleIn)

**Por que esse bloco existe:** no LinkedIn B2B, **99% do engajamento vive nos perfis pessoais**, não na página da empresa. Monitorar só a página oficial é monitorar 1% da realidade. O BubbleIn monitora colaboradores — e mostra aqui quem está falando pela marca, quem está calado, e quem *deveria estar monitorado mas não está*.

### 6.1. TOTVS — perfis monitorados: 5

**Ativos no mês (3/5):**
- Dennis Herszkowicz (CEO) — 12 posts, responsável por **52% de todo o engajamento** da TOTVS no mês
- Juliano Tubino (VP Comercial) — 8 posts, 19% do engajamento
- Gustavo Bastos (CFO) — 4 posts, 8% do engajamento

**Inativos no mês (2/5):**
- Marcelo Cosentino (VP Tecnologia) — 0 posts nos últimos 45 dias
- Sergio Campos (VP Produto) — 0 posts nos últimos 60 dias

**⚠️ Risco de concentração:**
> 79% de todo o engajamento da TOTVS vem de 2 pessoas. Se o Dennis tira férias ou muda de foco, a marca perde metade da presença no LinkedIn.

**🎯 Oportunidade — colaboradores relevantes NÃO monitorados:**
> Identificamos 4 colaboradores da TOTVS que postam ativamente no LinkedIn e NÃO estão no seu monitoramento. Adicioná-los dá visão real da marca e abre oportunidades de ativação:
>
> - **Izabel Branco** (Head de IA) — posta 3x/mês, 1.800 seguidores, ativa no tema IA+ERP (**justamente o território que estamos perdendo para a SAP**)
> - **Ricardo Oliveira** (Head Fiscal) — 2 posts/mês sobre reforma tributária, já é referência informal no tema
> - **Ana Paula Motta** (Diretora de Vertical PMEs) — 4 posts/mês sobre PMEs (**território que Sankhya está construindo sem resposta**)
> - **Fernando Gomes** (Head de Customer Success) — 2 posts/mês com cases reais de cliente

### 6.2. SAP Brasil — perfis monitorados: 8

**Ativos no mês: 8/8** (100%)
- Distribuição saudável: top-3 perfis representam apenas **58% do engajamento** (vs 79% na TOTVS)
- **12 colaboradores adicionais** além da C-suite postam regularmente, indicando programa de employee advocacy estruturado

### 6.3. Sankhya — perfis monitorados: 3

**Ativos no mês: 3/3**
- Concentração extrema: CEO gera **71% de todo o engajamento**
- Sem programa de advocacy visível — dependência total da voz do fundador

### 6.4. Leitura comparativa

> **SAP tem o programa de employee advocacy mais maduro do set** — voz distribuída, reduz risco, amplia alcance. TOTVS e Sankhya são CEO-dependentes. Para a TOTVS, isso é **risco estratégico** (concentração) e **oportunidade clara** (ativar 4 colaboradores que já postam pode aumentar em 30-40% o SoV sem esforço de criação de conteúdo).

---

## 7. Decisores que Engajaram com a TOTVS no Mês

Nome + cargo + empresa + comportamento observado. Lista única (não dividida entre TOTVS e concorrentes — foco em quem engajou conosco).

| Decisor | Empresa | Comportamento | Setor |
|---------|---------|---------------|-------|
| Alessandro Braga | CFO — Gerdau | 3 comentários em posts do Dennis sobre reforma tributária | Indústria |
| Júlia Martins | Controller — Ambev | Compartilhou 2 posts da TOTVS | Bebidas |
| Roberto Tavares | Head Fiscal — Vale | 5 curtidas em posts de reforma tributária | Mineração |
| Camila Duarte | VP de TI — Localiza | 2 comentários em post sobre cloud | Serviços |
| Eduardo Prado | CIO — Mercado Livre | Curtiu post sobre integração ERP-CRM | Varejo |
| Mariana Souza | Diretora Financeira — Natura | Compartilhou post sobre reforma tributária | Consumo |
| Paulo Ribeiro | CFO — Raízen | 2 curtidas e 1 comentário em post do Dennis | Energia |
| Luciana Marques | Controller — Magazine Luiza | Comentou em post fiscal | Varejo |

**Leitura abaixo da tabela:**

> *Padrão claro: decisores financeiros (CFO, Controller, Head Fiscal) dominam nosso engajamento — 6 dos 8 nomes. Reforça o diagnóstico do summary: TOTVS está vencendo no buyer financeiro. Para capturar também o buyer tecnológico, é preciso conteúdo que fale diretamente com CIO/CTO.*

---

## 8. Recomendações Estratificadas

Três camadas endereçadas a três leitores. Cada pauta traz **tema, justificativa e quem publica**.

### 8.1. Estratégica — para o CMO/CEO

> **Defender o território de IA+ERP antes que vire categoria da SAP.**
>
> - **Tese:** SAP está construindo a associação de que "IA em ERP é coisa de plataforma global". Se não respondermos em 30 dias, a associação vira permanente no mercado.
> - **Justificativa:** SAP cresceu 5% de SoV no mês puxada por esse tema. 47 decisores de TI engajaram com eles, 0 conosco. É o território com maior custo de perda.
> - **Recomendação:** Dennis Herszkowicz publica uma tese pública sobre "IA brasileira para gestão brasileira" + ativar Izabel Branco (Head de IA, hoje não monitorada) como voz técnica complementar.

### 8.2. Tática — pautas para o time de marketing

**Pauta 1 — Case de IA preditiva em cliente do varejo**
- **Tema:** como um cliente específico reduziu ruptura de estoque em X% usando IA preditiva da TOTVS
- **Justificativa:** SAP está todo discurso e nenhum case concreto no mês. Case real com número fura narrativa abstrata. Responde diretamente ao território que estamos perdendo.
- **Quem publica:** Diretor de Produto + cliente marcado no post (se houver autorização)

**Pauta 2 — Reforma tributária: 5 decisões que sua empresa precisa tomar ainda em abril**
- **Tema:** checklist de decisões fiscais-tributárias com prazo curto
- **Justificativa:** duplicar aposta em pauta que já ganhamos (post do Dennis teve RER 51%). Formato "N coisas que você precisa decidir com prazo" converte bem em comentários.
- **Quem publica:** Ricardo Oliveira (Head Fiscal — não monitorado hoje) + Dennis amplifica

**Pauta 3 — Por que ERP para PME não é "ERP enterprise menor"**
- **Tema:** diferenças estruturais de produto, operação e custo entre ERP enterprise e ERP PME
- **Justificativa:** Sankhya construiu 6 meses de autoridade no tema PME sem resposta nossa. Entrar agora corta crescimento deles e recupera território. Ana Paula Motta (Diretora de Vertical PMEs, não monitorada) já posta sobre isso — basta amplificar.
- **Quem publica:** Ana Paula Motta + líder de um cliente PME ancorando

**Pauta 4 — IA em ERP: o que é real e o que é marketing**
- **Tema:** tese provocativa separando aplicações reais de IA em ERP das aplicações "prometidas mas não entregues"
- **Justificativa:** responde diretamente ao aumento de 3,2x nos posts de IA da SAP. Posicionamento de ceticismo maduro funciona com buyer técnico (CIO/CTO — público que não estamos capturando).
- **Quem publica:** Marcelo Cosentino (VP Tecnologia, hoje inativo — oportunidade de reativação)

### 8.3. Outreach — 5 contas quentes para o time comercial

Baseadas nos sinais de engajamento do mês:

1. **Gerdau** — Alessandro Braga (CFO) engajou 3x com conteúdo de reforma tributária. **Ação:** avançar para proposta comercial, oferecer reunião técnica com time fiscal.
2. **Ambev** — Júlia Martins (Controller) compartilhou 2 posts. **Ação:** engajamento em construção, enviar case fiscal para cliente similar (bebidas/consumo).
3. **Natura** — Mariana Souza compartilhou post. **Ação:** outbound com foco em reforma tributária para varejo de consumo.
4. **Raízen** — Paulo Ribeiro (CFO) engajou 3x. **Ação:** contato direto do time enterprise, energia é vertical estratégica.
5. **Mercado Livre** — Eduardo Prado (CIO) curtiu post sobre integração. **Ação:** POC focado em integração ERP-CRM em escala.

---

## 9. Apostas Priorizadas

Três apostas claras com tema, justificativa e tópicos que devem ser abordados em cada uma.

### Aposta 1 — IA + ERP (DEFENSIVA · alta urgência)

- **Tema geral:** IA generativa e preditiva aplicada à gestão empresarial
- **Justificativa:** território em disputa ativa. SAP liderando a narrativa com 3,2x mais posts que a média. Custo de perder: alto (categoria inteira vira SAP).
- **Tópicos a abordar no mês:**
  - Casos reais de IA preditiva em clientes do varejo e indústria (com número)
  - Diferença entre "IA como chatbot" e "IA como inteligência de processo"
  - Limites honestos da IA em ERP — o que é hype e o que é realidade
  - Soberania de dados: por que empresa brasileira deveria preferir IA rodando em servidor brasileiro
- **Quem publica:** Dennis (tese), Marcelo Cosentino (técnico), Izabel Branco (aprofundamento), cliente (case)

### Aposta 2 — ERP para PMEs (OFENSIVA · média urgência)

- **Tema geral:** gestão para pequenas e médias empresas brasileiras
- **Justificativa:** Sankhya construiu 6 meses de autoridade sozinha nesse território. Ainda não é dela — é de quem chegar com autoridade. Ana Paula Motta já tem material pronto e base de clientes PME real.
- **Tópicos a abordar no mês:**
  - Diferenças estruturais entre ERP enterprise e ERP PME (por que um não é "versão menor" do outro)
  - Custos escondidos na escolha errada de ERP para empresa em crescimento
  - Histórias de PMEs que cresceram com o ERP certo (casos reais)
  - Como escolher ERP quando você passa de 50 para 200 funcionários
- **Quem publica:** Ana Paula Motta + cliente PME + liderança regional

### Aposta 3 — Reforma Tributária (CONSOLIDAÇÃO · baixa urgência)

- **Tema geral:** reforma tributária brasileira e seus impactos em gestão
- **Justificativa:** território já dominado pela TOTVS (post do Dennis com 51% de RER é prova). Manter cadência, não precisa intensificar. Risco é abandonar e perder liderança.
- **Tópicos a abordar no mês:**
  - Atualizações mensais sobre o andamento da regulamentação
  - Checklists de decisões com prazo
  - O que muda para cada setor (séries: varejo, indústria, serviços)
  - Perguntas que os CFOs estão fazendo e respostas práticas
- **Quem publica:** Ricardo Oliveira (Head Fiscal) + Dennis amplifica 1x/mês

**Linha abaixo das apostas:**

> *Lacunas observadas não cobertas pelas três apostas: ESG em gestão, Open Finance para ERP, IA para compliance. Baixa prioridade agora, mas monitorando para meses seguintes.*

---

## 10. Tradução para Negócio

Pequeno bloco que conecta métricas abstratas ao impacto de negócio para a TOTVS.

> **O que esses números significam para a TOTVS**
>
> - **142 decisores engajados** representam **47 contas** do seu ICP Enterprise — destas, **12 já são clientes** e **35 são contas-alvo em prospecção ativa**.
> - O **RER de 42%** está **14% acima da média do setor** de software B2B no Brasil — indicador de funil superior saudável.
> - Os **5 decisores que engajaram com a SAP** movimentam, juntos, **cerca de R$ 80M em budget anual de tecnologia** (estimativa por porte das empresas).
> - A perda de **3% de SoV** em IA+ERP equivale a aproximadamente **20 oportunidades de top-of-funnel** deixadas na mesa, se mantida a tendência por mais 2 meses.

---

## 11. CTA Final

CTA que conecta diretamente aos diagnósticos do relatório: se a marca está perdendo território e depende de poucos colaboradores, a resposta é ativar vozes externas que já falam com o ICP.

> **Sua marca está perdendo espaço em temas estratégicos. E se você pudesse ativar dezenas de vozes do LinkedIn que já falam direto com seu ICP?**
>
> Com a Busca da BubbleIn, você encontra creators B2B rankeados pela **composição da audiência** — CIOs, CFOs, decisores do setor que você quer alcançar — não por volume de seguidores. Monte uma campanha de influência em minutos, com as pessoas certas.
>
> **[ Encontrar creators para minha campanha ]**

Abaixo, em texto menor:

> Também disponível: receber o relatório automaticamente no primeiro dia útil de cada mês por e-mail.

---

## Resumo das mudanças aplicadas nesta versão

| # | Mudança |
|---|---------|
| 1 | Notação agora em % simples (3%) no lugar de pp. Executive summary em tópicos, não em prosa. |
| 2 | Periodicidade mensal em todas as seções, CTAs e narrativas. |
| 3 | Todas as métricas com ícone ⓘ e tooltip clicável. Glossário único no topo. RER sempre com expansão. |
| 4 | Removida a lista de "decisores que engajaram com concorrentes". Mantida só a lista de quem engajou com a TOTVS. |
| 5 | Pautas táticas agora trazem tema + justificativa + quem publica. |
| 6 | Apostas priorizadas trazem tema geral + justificativa + tópicos a abordar + quem publica. |
| 7 | Novo bloco "Cobertura de Perfis Monitorados" — ativo/inativo, risco de concentração, colaboradores relevantes NÃO monitorados. Este é o diferencial da BubbleIn. |
| 8 | Novo bloco "Análise de Conteúdo por Empresa" — composição de tipos de post (institucional, vagas, produto, outros) e posts em destaque (positivo, negativo, inesperado). |
