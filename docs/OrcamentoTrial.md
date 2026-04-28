# Estudo de Custos: Relatório Share of LinkedIn (SOL) + Opções de Trial

**Data:** 2026-04-27
**Objetivo:** Estimar o custo por relatório SOL em diferentes cenários e propor opções de trial com recursos limitados para leads.

---

## 1. Custos Unitários das APIs

### Apify (coleta de dados LinkedIn)

| Operação | Custo (USD) | Descrição |
|---|---|---|
| `fetchProfilePosts` | $0.020 / perfil | Coleta posts de uma página de empresa ou perfil pessoal |
| `fetchPostEngagers` (supreme_coder) | $0.0012 / item | Amostra de reações + comentários. ~20 items/post = **~$0.024/post** |
| `searchLinkedInPosts` | $0.050 / busca | Busca de posts por palavras-chave (SOV, Influencers) |
| `searchGoogleApify` | $0.0035 / busca | Fallback SERP quando busca LinkedIn não retorna resultados |
| `fetchLinkedInCompany` | $0.005 / empresa | Dados da página da empresa |
| `fetchLinkedInProfileApify` | $0.004 / perfil | Enriquecimento de perfil pessoal |

### OpenRouter (IA - gpt-4o-mini)

| Operação | Custo (USD) | Descrição |
|---|---|---|
| `classifyPost` | $0.001 / post | Classificação de tema, tipo de conteúdo e resumo |
| `classifySentiment` | $0.0005 / menção | Análise de sentimento (positivo/neutro/negativo) |
| `generateSolRecommendations` | $0.010 / relatório | Geração de insights e recomendações estratégicas |

---

## 2. Fases do Relatório SOL

Cada relatório passa por estas fases, todas executadas em background (`collect-bg`) com timeout de 10 minutos:

### Setup (one-time por empresa/concorrente)
- **Processar funcionários:** N funcionários × $0.024 (`fetchLinkedInProfileApify` + `fetchProfilePosts`)
- **Processar concorrente:** $0.005 (company info) + $0.020 (posts iniciais) + M executivos × $0.024

### Geração do Relatório (cada mês)
1. **Coleta de posts** — `fetchProfilePosts` × total de targets (empresa + funcionários + concorrentes + seus funcionários) = targets × $0.02
2. **Classificação IA** — `classifyPost` × total de posts no período = posts × $0.001
3. **Amostragem de engajadores (RER)** — `fetchPostEngagers` × total de posts = posts × ~$0.024 **<-- CUSTO DOMINANTE**
4. **Share of Voice (SOV)** — `searchLinkedInPosts` × 3 empresas = $0.15 + menções × $0.0005
5. **Influencers** — `searchLinkedInPosts` × 1 busca = $0.05
6. **Recomendações IA** — `generateSolRecommendations` × 1 = $0.01

---

## 3. Cenários de Custo (1 Marca + 2 Concorrentes)

### Cenário A: Empresa Pequena (Pouco)

**Premissas:**
- 3 funcionários por empresa (9 total)
- ~2 posts/mês por perfil, ~5 posts/mês por página de empresa
- **~33 posts no período**
- 12 targets para coleta

| Fase | Cálculo | Custo |
|---|---|---|
| Coleta de posts | 12 targets × $0.02 | $0.24 |
| Classificação IA | 33 posts × $0.001 | $0.03 |
| **Engajadores (RER)** | **33 posts × $0.024** | **$0.79** |
| SOV busca | 3 empresas × $0.05 | $0.15 |
| SOV sentiment | ~15 menções × $0.0005 | $0.01 |
| Influencers | 1 busca × $0.05 | $0.05 |
| Recomendações IA | 1 × $0.01 | $0.01 |
| **Subtotal Relatório** | | **$1.28** |
| Setup (one-time) | 3 emps + 2 comps (3 execs cada) | $0.27 |
| **Total com setup** | | **$1.55** |

---

### Cenário B: Empresa Média (Médio)

**Premissas:**
- 8 funcionários por empresa (24 total)
- ~5 posts/mês por perfil, ~10 posts/mês por página de empresa
- **~150 posts no período**
- 27 targets para coleta

| Fase | Cálculo | Custo |
|---|---|---|
| Coleta de posts | 27 targets × $0.02 | $0.54 |
| Classificação IA | 150 posts × $0.001 | $0.15 |
| **Engajadores (RER)** | **150 posts × $0.024** | **$3.60** |
| SOV busca | 3 empresas × $0.05 | $0.15 |
| SOV sentiment | ~30 menções × $0.0005 | $0.02 |
| Influencers | 1 busca × $0.05 | $0.05 |
| Recomendações IA | 1 × $0.01 | $0.01 |
| **Subtotal Relatório** | | **$4.52** |
| Setup (one-time) | 8 emps + 2 comps (8 execs cada) | $0.63 |
| **Total com setup** | | **$5.15** |

---

### Cenário C: Empresa Grande (Muito)

**Premissas:**
- 15 funcionários na marca, 12 por concorrente (39 total)
- ~8 posts/mês por perfil, ~20 posts/mês por página de empresa
- **~372 posts no período**
- 42 targets para coleta

| Fase | Cálculo | Custo |
|---|---|---|
| Coleta de posts | 42 targets × $0.02 | $0.84 |
| Classificação IA | 372 posts × $0.001 | $0.37 |
| **Engajadores (RER)** | **372 posts × $0.024** | **$8.93** |
| SOV busca | 3 empresas × $0.05 | $0.15 |
| SOV sentiment | ~60 menções × $0.0005 | $0.03 |
| Influencers | 1 busca × $0.05 | $0.05 |
| Recomendações IA | 1 × $0.01 | $0.01 |
| **Subtotal Relatório** | | **$10.38** |
| Setup (one-time) | 15 emps + 2 comps (12 execs cada) | $0.99 |
| **Total com setup** | | **$11.37** |

---

### Resumo Comparativo

| Cenário | Funcionários | Posts | Custo Relatório | Engajadores (%) | Setup |
|---|---|---|---|---|---|
| **Pequeno** | 3/empresa | ~33 | **$1.28** | $0.79 (62%) | $0.27 |
| **Médio** | 8/empresa | ~150 | **$4.52** | $3.60 (80%) | $0.63 |
| **Grande** | 15+12/empresa | ~372 | **$10.38** | $8.93 (86%) | $0.99 |

### Insight Principal

A **amostragem de engajadores (RER)** domina o custo total do relatório, representando 62% a 86% do valor. Qualquer estratégia de trial com custo controlado deve focar em reduzir ou eliminar essa fase.

---

## 4. Opções de Trial para Leads

### Opção 1: "Trial Preview" — Relatório Simplificado sem RER

**Custo estimado: $0.30 - $0.50**

**O que inclui:**
- 1 marca + 1 concorrente (em vez de 2)
- Máx 5 funcionários por empresa (10 total)
- Coleta de posts + classificação IA (temas, tipos de conteúdo)
- SOV básico (1 busca por empresa)
- Recomendações IA completas
- **SEM amostragem de engajadores (RER)** — seção aparece como "disponível no plano completo"

**O que o lead vê:**
- Score SOL comparativo (baseado em volume + engagement bruto, sem RER)
- Composição de conteúdo (produto/institucional/vagas)
- Top temas abordados por cada empresa
- Share of Voice (menções positivas/neutras/negativas)
- Recomendações estratégicas geradas pela IA

**Breakdown de custo (cenário médio):**

| Item | Custo |
|---|---|
| Coleta posts (12 targets) | $0.24 |
| Classificação (~50 posts) | $0.05 |
| SOV (2 buscas + ~10 sentimentos) | $0.105 |
| Recomendações | $0.01 |
| **Total** | **~$0.41** |

---

### Opção 2: "Trial Snapshot" — Somente Páginas de Empresa

**Custo estimado: $0.10 - $0.20**

**O que inclui:**
- 1 marca + 1 concorrente
- **Somente páginas de empresa** (sem análise de funcionários)
- Classificação IA de posts
- **SEM RER, SEM SOV, SEM Influencers**
- Mini-recomendação IA baseada nos posts das páginas

**O que o lead vê:**
- Comparativo de volume de posts (marca vs concorrente)
- Engagement médio por post
- Temas principais de cada empresa
- Composição de conteúdo (produto/institucional/vagas)
- 3 insights rápidos gerados pela IA

**Breakdown de custo:**

| Item | Custo |
|---|---|
| Coleta posts (2 targets) | $0.04 |
| Classificação (~15 posts) | $0.015 |
| Recomendações | $0.01 |
| **Total** | **~$0.07** |

**Vantagem:** Custo extremamente baixo. Pode ser oferecido gratuitamente sem preocupação.
**Desvantagem:** Valor percebido baixo — o lead não vê o diferencial do produto (RER, funcionários, SOV).

---

### Opção 3: "Trial Amostra" — Relatório Completo com Limites

**Custo estimado: $0.50 - $0.80**

**O que inclui:**
- 1 marca + 1 concorrente
- Máx 3 funcionários por empresa (6 total)
- Coleta + classificação completa
- **RER amostrando apenas os top 10 posts** (por engagement) em vez de todos
- SOV básico (1 busca por empresa)
- Recomendações completas
- Watermark "Versao Trial" na UI

**O que o lead vê:**
- Relatório visualmente completo (mesma UI do plano pago)
- RER estimado (com nota: "baseado em amostra dos top 10 posts")
- Score SOL comparativo
- SOV + recomendações
- Badge "Versao Trial — dados limitados" no relatório

**Breakdown de custo (cenário médio):**

| Item | Custo |
|---|---|
| Coleta posts (8 targets) | $0.16 |
| Classificação (~40 posts) | $0.04 |
| Engajadores (top 10 only) | $0.24 |
| SOV (2 buscas + ~10 sentimentos) | $0.105 |
| Recomendações | $0.01 |
| **Total** | **~$0.56** |

**Vantagem:** Alto valor percebido — lead experimenta o produto real com todas as features visíveis.
**Desvantagem:** Custo um pouco maior, mas ainda muito controlado.

---

### Comparativo das 3 Opções

| Característica | Preview | Snapshot | Amostra |
|---|---|---|---|
| **Custo médio** | ~$0.40 | ~$0.07 | ~$0.56 |
| **Concorrentes** | 1 | 1 | 1 |
| **Funcionários** | 5/empresa | 0 | 3/empresa |
| **RER (decisores)** | Nao | Nao | Top 10 posts |
| **SOV (mencoes)** | Sim | Nao | Sim |
| **Influencers** | Nao | Nao | Nao |
| **Recomendacoes IA** | Completas | Mini (3 insights) | Completas |
| **Tempo de geração** | ~2 min | ~30 seg | ~3 min |
| **Valor percebido** | Medio | Baixo | **Alto** |
| **Complexidade de impl.** | Media | Baixa | Media |
| **Risco de abuso** | Baixo | Muito baixo | Baixo |

---

## 5. Recomendação

**Opção 3 ("Trial Amostra")** oferece o melhor equilíbrio entre custo e valor percebido:

- **Custo controlado:** ~$0.56 por trial (vs $4.52 de um relatório completo médio = economia de 88%)
- **Alto valor percebido:** o lead vê o relatório completo, entende o diferencial do produto
- **Incentivo ao upgrade:** limitações claras (1 concorrente, 3 funcionários, RER amostral) que naturalmente levam ao plano pago
- **Implementação simples:** reutiliza o `collect-bg` existente com parâmetros de limitação

### Projeção de custo mensal para trials

| Trials/mês | Custo total |
|---|---|
| 50 | ~$28 |
| 100 | ~$56 |
| 500 | ~$280 |
| 1.000 | ~$560 |

Mesmo com 1.000 trials/mês, o custo fica abaixo de $600 — viável como investimento de aquisição.

---

## Referências de Código

| Arquivo | Descrição |
|---|---|
| `src/lib/api-costs.ts` | Constantes de custo e função `logApiCost()` |
| `src/lib/ai.ts` | Funções de IA (classifyPost, classifySentiment, generateSolRecommendations) |
| `src/lib/apify.ts` | Wrapper Apify (fetchProfilePosts, fetchPostEngagers, etc.) |
| `src/app/api/sol/collect-bg/route.ts` | Pipeline principal de geração do relatório (6 fases) |
| `src/app/api/sol/generate/route.ts` | Endpoint de criação do relatório |
| `src/app/casting/share-of-linkedin/[profileId]/page.tsx` | UI principal do SOL |
| `src/app/casting/share-of-linkedin/[profileId]/report/[reportId]/page.tsx` | Visualização do relatório |
