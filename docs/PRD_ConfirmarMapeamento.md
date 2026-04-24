# PRD — Confirmar Mapeamento: Geração de Relatório Share of LinkedIn

## Resumo

Ao clicar "CONFIRMAR MAPEAMENTO", o sistema inicia a coleta de dados brutos (posts, engajamento, menções externas) de todos os perfis mapeados (empresa + 2 concorrentes + seus colaboradores), armazena no banco, e gera o primeiro relatório imediatamente. A partir daí, uma cron mensal regenera automaticamente.

---

## Dados de entrada (já existentes no mapeamento)

Antes de confirmar, o user já configurou:
- **Empresa principal**: perfil LinkedIn + colaboradores ativos
- **2 concorrentes selecionados**: perfil LinkedIn + colaboradores de cada
- **Temas de mercado**: preenchidos pela IA
- **País**: filtro de geolocalização

Dados acessíveis em `lg_options`:
- `employee_profiles[]` — colaboradores da empresa (name, slug, headline, postsPerMonth)
- `competitors[]` — concorrentes (name, logoUrl, url, selected)
- `ai_response.competitor_employees` — colaboradores dos concorrentes
- `market_context` — temas de mercado

---

## Etapa 1: Coleta de dados brutos

### 1.1 Posts dos perfis de empresa (páginas oficiais)

Para cada empresa (principal + 2 concorrentes), buscar posts da página oficial:

```
fetchProfilePosts("https://www.linkedin.com/company/{slug}/", 30)
```

**Dados a armazenar por post:**
- `post_url`: URL do post
- `text_content`: texto completo do post
- `reactions`: número de reações
- `comments`: número de comentários
- `posted_at`: data de publicação
- `source_profile`: slug do perfil que publicou
- `source_type`: "company" | "employee"
- `company_name`: nome da empresa associada

**Verificação:** Na aba "Posts" do relatório, deve listar posts da página oficial de cada empresa.

### 1.2 Posts dos colaboradores

Para cada colaborador mapeado (empresa + concorrentes), buscar posts recentes:

```
fetchProfilePosts("https://www.linkedin.com/in/{slug}/", 10)
```

Filtrar apenas posts do mês sendo analisado (período de referência).

**Custo estimado:**
- 3 perfis de empresa × 30 posts = ~$0.06/empresa = $0.18
- ~20 colaboradores × 10 posts = ~$0.02/colaborador = $0.40
- **Total posts: ~$0.58**

**Verificação:** Aba "Posts" do relatório mostra posts separados por empresa, com filtro colaborador/página oficial.

### 1.3 Amostra de engajadores (estimativa de RER)

Para cada post coletado, buscar uma amostra de 10-20 engajadores:

```
fetchPostEngagers(post_url, { maxReactions: 10, maxComments: 10 })
```

Para cada engajador, verificar se é decisor (ICP match) via headline:

```
batchScoreIcpMatch(engagers, themes)
```

**Cálculo de RER estimado:**
```
RER = (decisores na amostra / total da amostra) × 100
```

⚠️ **Disclaimer:** "RER calculado por amostragem de 10-20 engajadores por post. Valores são estimativas."

**Custo estimado:**
- ~100 posts × 20 engajadores × $0.0012 = ~$2.40 (engajadores)
- ~100 posts × 20 × $0.0002 = ~$0.40 (ICP scoring)
- **Total engajadores: ~$2.80**

**Verificação:** Na aba "Análise", o gráfico Share of LinkedIn mostra RER por empresa. Badge de RER aparece em cada post na aba "Posts".

### 1.4 Classificação temática de posts (IA)

Cada post é classificado por tema via IA:

```
classifyPostTheme(post_text, market_themes) → tema principal
```

Também classificar tipo de conteúdo:
- 🏢 Institucional (eventos, prêmios, anúncios)
- 💼 Vagas e RH
- 📊 Produto e negócio (cases, teses, insights)
- 📎 Outros

**Custo estimado:**
- ~100 posts × $0.001 = ~$0.10

**Verificação:** Na aba "Análise", seção "Análise de Conteúdo por Empresa" mostra barras de composição por categoria.

### 1.5 Share of Voice (menções externas)

Para cada empresa, buscar menções externas:

```
searchGoogleApify(`"${companyName}" site:linkedin.com`, { results: 15 })
```

Para cada menção, classificar sentimento (positivo/neutro/negativo):

```
classifySentiment(post_text) → "positivo" | "neutro" | "negativo"
```

**Custo estimado:**
- 3 empresas × $0.0035 = ~$0.01 (SERP)
- ~30 menções × $0.0005 = ~$0.015 (sentimento)
- **Total SOV: ~$0.025**

**Verificação:** No gráfico do topo, aba "Share of Voice" mostra barras com sentimento por empresa.

---

## Etapa 2: Cálculo de métricas

### 2.1 Share of LinkedIn (SOL)

Índice composto por empresa:

```
SOL = posts_engajados × RER × engajamento_total
```

Comparativo entre as 3 empresas.

### 2.2 Métricas por colaborador

Para cada colaborador:
- Posts no período
- Engajamento total
- RER médio dos seus posts
- Categoria principal de conteúdo

### 2.3 Ranking competitivo

Tabela comparativa com:
- SOL, RER, Posts, Decisores engajados, Top Temas

### 2.4 Recomendações (IA)

Com todos os dados coletados, gerar recomendações via IA:

```
generateRecommendations({
  companyData, competitorData, themes, sovData
}) → recomendações priorizadas
```

**Custo estimado:** ~$0.005

---

## Etapa 3: Armazenamento

### Nova tabela: `sol_reports`

```sql
CREATE TABLE sol_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES lg_profiles(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text DEFAULT 'processing', -- processing | complete | failed
  raw_data jsonb, -- posts, engagers, SOV raw data
  metrics jsonb, -- SOL, RER, rankings calculados
  recommendations jsonb, -- recomendações IA
  created_at timestamptz DEFAULT now()
);
```

### Nova tabela: `sol_posts`

```sql
CREATE TABLE sol_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid REFERENCES sol_reports(id),
  profile_slug text NOT NULL,
  company_name text NOT NULL,
  source_type text NOT NULL, -- 'company' | 'employee'
  post_url text,
  text_content text,
  reactions int DEFAULT 0,
  comments int DEFAULT 0,
  posted_at timestamptz,
  theme text, -- classificação temática
  content_type text, -- institucional | vagas | produto | outros
  rer_estimate float, -- RER estimado por amostragem
  rer_sample_size int, -- tamanho da amostra
  engager_sample jsonb, -- amostra de engajadores
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_sol_posts_report ON sol_posts(report_id);
```

### Campo em `lg_options`: `confirmed_at`

```sql
ALTER TABLE lg_options ADD COLUMN confirmed_at timestamptz;
```

Quando o user clica "CONFIRMAR MAPEAMENTO", seta `confirmed_at = now()`.

---

## Etapa 4: Periodicidade

### Cron mensal

```toml
[functions."sol-monthly-report"]
  schedule = "0 8 1 * *"  # Dia 1 de cada mês, 8h UTC (5h BRT)
```

A cron busca todos os `lg_options` com `confirmed_at IS NOT NULL` e gera relatório do mês anterior para cada um.

### Dados reutilizáveis

Posts armazenados em `sol_posts` servem como referência para meses seguintes. Se um post do mês anterior aparece no fetch atual, não precisa re-processar engajadores — dados já existem no banco.

### Histórico retroativo (feature futura)

- **Add-on pago**: R$100 por mês retroativo analisado
- Busca posts mais antigos via API + processa engajadores
- Custo adicional: ~$3.50/mês retroativo por mapeamento
- Não incluso no MVP — implementar quando houver demanda

---

## Etapa 5: Frontend — Fluxo do botão

### Ao clicar "CONFIRMAR MAPEAMENTO":

1. **Modal de confirmação** com resumo:
   - "X colaboradores da empresa + Y colaboradores de 2 concorrentes"
   - "Relatório mensal será gerado automaticamente"
   - "Custo estimado da primeira análise: ~$3.50"
   - Botão "Confirmar" + "Cancelar"

2. **Após confirmar:**
   - Salvar `confirmed_at` no `lg_options`
   - Criar `sol_reports` com `status: "processing"`
   - Iniciar processamento em background (Netlify function)
   - Mostrar barra de progresso: "Coletando posts... Analisando engajamento... Gerando relatório..."
   - Redirecionar para página do relatório quando pronto

3. **Botão muda** para "Relatório" (link para o último relatório gerado)

### Página do relatório

Mesma estrutura de `/share-of-linkedin-exemplo` mas com dados reais:
- Aba "Análise": SOL, SOV, Insights, Recomendações, Movimentos, Tradução
- Aba "Conteúdo": Ranking, Análise de Conteúdo, Colaboradores, Decisores
- Aba "Influencers": menções externas com influenciadores
- Aba "Posts": todos os posts coletados com filtros

---

## Estimativa de custo total por relatório

| Operação | Custo |
|----------|-------|
| Posts de 3 empresas (páginas oficiais) | ~$0.18 |
| Posts de ~20 colaboradores | ~$0.40 |
| Engajadores amostrais (~100 posts × 20) | ~$2.40 |
| ICP scoring dos engajadores | ~$0.40 |
| Classificação temática (~100 posts) | ~$0.10 |
| Share of Voice (SERP + sentimento) | ~$0.03 |
| Recomendações IA | ~$0.01 |
| **TOTAL por relatório** | **~$3.52** |
| **TOTAL mensal (12 mapeamentos)** | **~$42.24** |

### Por plano:

| Plano | Empresas | Relatórios/mês | Custo/mês |
|-------|----------|----------------|-----------|
| Starter (1 concorrente) | 2 | 1 | ~$2.50 |
| Professional (3 concorrentes) | 4 | 1 | ~$5.00 |
| Business (6 concorrentes) | 7 | 1 | ~$8.00 |

---

## Etapas de implementação

### Fase 1: Infraestrutura de dados (Semana 1)
- [ ] Migration: criar tabelas `sol_reports`, `sol_posts`, campo `confirmed_at`
- [ ] API: endpoint POST `/api/sol/generate` que inicia coleta
- [ ] Background function: `netlify/functions/sol-generate.ts`
- **Verificação:** Chamar API manualmente → dados aparecem nas tabelas

### Fase 2: Coleta de posts (Semana 1)
- [ ] Buscar posts de páginas de empresa (3 empresas × 30 posts)
- [ ] Buscar posts de colaboradores (~20 × 10 posts)
- [ ] Armazenar em `sol_posts`
- **Verificação:** Query `SELECT count(*) FROM sol_posts WHERE report_id = ?` retorna ~100+ posts

### Fase 3: Análise de engajamento (Semana 2)
- [ ] Amostrar 10-20 engajadores por post
- [ ] Classificar decisores via ICP match
- [ ] Calcular RER estimado por post
- **Verificação:** `sol_posts.rer_estimate` preenchido para cada post

### Fase 4: Classificação e métricas (Semana 2)
- [ ] Classificar tema de cada post (IA)
- [ ] Classificar tipo de conteúdo (institucional/vagas/produto/outros)
- [ ] Calcular SOL, ranking competitivo
- [ ] Buscar Share of Voice (SERP + sentimento)
- **Verificação:** `sol_reports.metrics` preenchido com SOL, RER, rankings

### Fase 5: Recomendações (Semana 2)
- [ ] Gerar recomendações via IA com todos os dados
- [ ] Gerar insights estratégicos (positivos + atenção)
- **Verificação:** `sol_reports.recommendations` preenchido

### Fase 6: Frontend — Relatório real (Semana 3)
- [ ] Página `/casting/share-of-linkedin/[profileId]/report/[reportId]`
- [ ] Mesma estrutura do `/share-of-linkedin-exemplo` mas com dados reais
- [ ] Disclaimer de amostragem no RER
- **Verificação:** Acessar relatório → dados reais das 3 empresas

### Fase 7: Botão Confirmar + Modal (Semana 3)
- [ ] Modal de confirmação com resumo + custo
- [ ] Processamento em background com status
- [ ] Botão muda para "Ver Relatório" após geração
- **Verificação:** Clicar confirmar → loading → relatório gerado

### Fase 8: Cron mensal (Semana 4)
- [ ] `netlify/functions/sol-monthly-report.ts`
- [ ] Busca mapeamentos confirmados e gera relatório do mês anterior
- [ ] Email de notificação quando relatório está pronto
- **Verificação:** Cron executa → novo relatório aparece na lista

---

## Disclaimer de amostragem

Em todos os locais onde RER aparece, incluir tooltip/nota:

> "⚡ RER estimado por amostragem de 10-20 engajadores por post. Os valores representam uma estimativa e podem variar do engajamento real total."

Estilo: texto pequeno em cinza, discreto, não intrusivo.

---

## Histórico de relatórios

Na página do perfil, seção abaixo do mapeamento:

```
📊 Relatórios Gerados
├── Abril 2026 (atual) — Ver relatório
├── [Março 2026 — Disponível como add-on retroativo]
└── [Fevereiro 2026 — Disponível como add-on retroativo]
```

Meses sem relatório mostram opção de gerar retroativo (feature futura, não no MVP).
