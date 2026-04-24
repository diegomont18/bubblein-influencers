# PRD — Confirmar Mapeamento: Geração de Relatório Share of LinkedIn

## Resumo

Ao clicar "CONFIRMAR MAPEAMENTO", o sistema inicia a coleta de dados brutos (posts, engajamento, menções externas) de todos os perfis mapeados (empresa + 2 concorrentes + seus colaboradores), armazena no banco, e gera o primeiro relatório do **mês anterior completo** imediatamente. A partir daí, uma cron mensal regenera automaticamente no dia 1 de cada mês.

O processamento roda inteiramente em background — o user pode sair da página a qualquer momento sem perder o progresso. Uma notificação avisa quando o relatório está pronto.

---

## Dados de entrada (já existentes no mapeamento)

Antes de confirmar, o user já configurou:
- **Empresa principal**: perfil LinkedIn + colaboradores ativos
- **Marcas e produtos**: descrição, especialidades e temas extraídos do site da empresa
- **2 concorrentes selecionados**: perfil LinkedIn + colaboradores de cada
- **Temas de interesse do mercado**: preenchidos pela IA + enriquecidos via Firecrawl
- **País**: filtro de geolocalização

Dados acessíveis em `lg_options`:
- `employee_profiles[]` — colaboradores da empresa (name, slug, headline, postsPerMonth)
- `competitors[]` — concorrentes (name, logoUrl, url, selected)
- `ai_response.competitor_employees` — colaboradores dos concorrentes
- `ai_response.companyInfo` — dados da empresa (name, description, specialties, industry, website)
- `market_context` — temas de mercado

---

## Período de análise

A análise sempre cobre o **mês anterior completo**. Ex: se confirmado em 24/abril/2026, analisa 01/março a 31/março/2026.

**Regra:** Posts do mês atual NÃO entram na análise (mês incompleto). Na virada do mês, a cron gera automaticamente o relatório do mês que acabou de fechar.

**Filtro de período:** Ao buscar posts via API, filtrar apenas posts com `posted_at` dentro do período. Posts fora do período são descartados.

---

## Etapa 1: Coleta de dados brutos

### 1.1 Posts de todos os perfis mapeados

Para cada perfil (páginas oficiais de empresa + todos os colaboradores), buscar posts recentes:

**Páginas oficiais (3 empresas):**
```
fetchProfilePosts("https://www.linkedin.com/company/{slug}/", 30)
```

**Colaboradores (~20 perfis):**
```
fetchProfilePosts("https://www.linkedin.com/in/{slug}/", 15)
```

Filtrar apenas posts com `posted_at` dentro do período de análise (mês anterior).

**Dados a armazenar por post:**
- `post_url`: URL do post
- `text_content`: texto completo do post
- `reactions`: número de reações
- `comments`: número de comentários
- `posted_at`: data de publicação
- `source_profile`: slug do perfil que publicou
- `source_type`: "company" | "employee"
- `company_name`: nome da empresa associada
- `author_name`: nome do autor
- `author_headline`: headline do autor

**Verificação:** Na aba "Posts" do relatório, deve listar TODOS os posts (páginas oficiais + colaboradores) de todas as empresas, com filtros por empresa, por tipo (empresa/colaborador) e por categoria.

**Custo estimado:**
- 3 perfis de empresa × $0.02 = $0.06
- ~20 colaboradores × $0.02 = $0.40
- **Total posts: ~$0.46**

### 1.2 Amostra de engajadores (estimativa de decisores)

Para cada post coletado, buscar uma amostra de 10-20 engajadores para estimar a presença de decisores:

```
fetchPostEngagers(post_url, { maxReactions: 10, maxComments: 10 })
```

Para cada engajador, verificar via headline se é um cargo de decisão:

```
isDecisionMaker(headline) → boolean
// Cargos de decisão: CEO, CTO, CFO, COO, VP, Director, Head, Gerente, Partner, Founder
// NÃO é ICP match — é apenas verificação de nível hierárquico
```

**Cálculo de RER estimado:**
```
RER = (decisores na amostra / total da amostra) × 100
```

⚠️ **Disclaimer (discreto, tooltip):** "Estimativa baseada em amostragem de 10-20 engajadores por post."

**Custo estimado:**
- ~100 posts × 20 engajadores × $0.0012 = ~$2.40 (engajadores)
- Verificação de headline: sem custo (regex local, sem IA)
- **Total engajadores: ~$2.40**

**Verificação:** Na aba "Análise", o gráfico Share of LinkedIn mostra RER por empresa. Badge de RER aparece em cada post na aba "Posts".

### 1.3 Classificação temática de posts (IA)

Cada post é classificado por IA em duas dimensões:

**1. Tema de mercado** (baseado nos temas mapeados):
```json
// Prompt IA — resposta JSON obrigatória:
{
  "theme": "Cloud Computing",
  "content_type": "produto",
  "summary": "Resumo de 1 frase do post"
}
```

**2. Tipo de conteúdo:**
- 🏢 `institucional` — eventos, prêmios, anúncios corporativos
- 💼 `vagas` — vagas de emprego, recrutamento, RH
- 📊 `produto` — cases, teses de mercado, insights de negócio
- 📎 `outros` — motivacional, parabenizações, pessoal

**Exibição de vagas de RH:**
- Por padrão, posts classificados como `vagas` ficam **ocultos** nas visualizações
- Toggle discreto: "Mostrar também vagas de RH" que quando ativado inclui esses posts
- Nas barras de composição de conteúdo, `vagas` aparece sempre mas com baixa opacidade até o toggle ser ativado

**Prompt IA obrigatório — formato JSON compatível com `/share-of-linkedin-exemplo`:**
```
Classifique este post. Responda APENAS com JSON:
{"theme":"tema principal","content_type":"produto|institucional|vagas|outros","summary":"resumo de 1 frase"}

Temas disponíveis: ${market_themes}
Post: ${text_content.slice(0, 500)}
```

**Custo estimado:**
- ~100 posts × $0.001 = ~$0.10

**Verificação:** Na aba "Conteúdo", seção "Análise de Conteúdo por Empresa" mostra barras de composição por categoria. Toggle de vagas funciona.

### 1.4 Share of Voice (menções externas)

Para buscar menções externas com controle cronológico, usar actor Apify de LinkedIn em vez de Google SERP (que não respeita período):

```
// Buscar posts no LinkedIn que mencionam a empresa no período
searchLinkedInPosts(`"${companyName}"`, {
  dateRange: { start: periodStart, end: periodEnd },
  results: 20
})
```

**Fallback:** Se o actor de LinkedIn posts não estiver disponível, usar SERP com filtro `tbs=qdr:m` (último mês):
```
searchGoogleApify(`"${companyName}" site:linkedin.com`, { results: 15, tbs: "qdr:m" })
```

Para cada menção, classificar sentimento (positivo/neutro/negativo) via IA:
```json
{"sentiment": "positivo", "summary": "Elogio ao produto X"}
```

**Custo estimado:**
- 3 empresas × $0.05 = ~$0.15 (actor LinkedIn ou SERP)
- ~30 menções × $0.0005 = ~$0.015 (sentimento)
- **Total SOV: ~$0.17**

**Verificação:** No gráfico do topo, aba "Share of Voice" mostra barras com sentimento por empresa.

---

## Etapa 2: Cálculo de métricas

### 2.1 Share of LinkedIn (SOL)

Índice composto por empresa:

```
SOL = posts_engajados × RER × engajamento_total
```

Comparativo entre as 3 empresas. Formato numérico com 1 decimal (ex: 2.9, 1.1, 0.6).

### 2.2 Métricas por colaborador

Para cada colaborador:
- Posts no período
- Engajamento total (reações + comentários)
- RER médio dos seus posts (estimado)
- Categoria principal de conteúdo
- Aderência (alta/média/baixa) baseada em RER

### 2.3 Ranking competitivo

Tabela comparativa com:
- SOL (com variação vs mês anterior quando disponível)
- RER
- Número de posts
- Decisores engajados (estimado)
- Top Temas (2-3 por empresa)

### 2.4 Recomendações (IA)

Com todos os dados coletados, gerar recomendações via IA:

```json
// Prompt — resposta JSON obrigatória, compatível com /share-of-linkedin-exemplo:
{
  "insights": {
    "positives": [{"title": "...", "description": "..."}],
    "concerns": [{"title": "...", "description": "..."}]
  },
  "recommendations": [
    {"id": 1, "title": "...", "tag": "DEFENSIVA|CONTEÚDO|OFENSIVA|CONSOLIDAÇÃO|RELACIONAMENTO", "urgency": "alta|media|baixa", "desc": "...", "who": "...", "details": "..."}
  ],
  "movements": [
    {"company": "...", "text": "..."}
  ]
}
```

**Custo estimado:** ~$0.01

---

## Etapa 3: Armazenamento

### Nova tabela: `sol_reports`

```sql
CREATE TABLE sol_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES lg_profiles(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text DEFAULT 'processing', -- processing | complete | failed | cancelled
  raw_data jsonb, -- SOV raw data, engager samples
  metrics jsonb, -- SOL, RER, rankings calculados
  recommendations jsonb, -- recomendações IA (formato compatível com exemplo)
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_sol_reports_profile ON sol_reports(profile_id);
CREATE INDEX idx_sol_reports_status ON sol_reports(status);
```

### Nova tabela: `sol_posts`

```sql
CREATE TABLE sol_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid REFERENCES sol_reports(id),
  profile_slug text NOT NULL,
  company_name text NOT NULL,
  source_type text NOT NULL, -- 'company' | 'employee'
  author_name text,
  author_headline text,
  post_url text,
  text_content text,
  reactions int DEFAULT 0,
  comments int DEFAULT 0,
  posted_at timestamptz,
  theme text, -- classificação temática
  content_type text, -- institucional | vagas | produto | outros
  summary text, -- resumo de 1 frase (IA)
  rer_estimate float, -- RER estimado por amostragem
  rer_sample_size int, -- tamanho da amostra
  engager_sample jsonb, -- amostra de engajadores com headline
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_sol_posts_report ON sol_posts(report_id);
CREATE INDEX idx_sol_posts_period ON sol_posts(posted_at);
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

A cron busca todos os `lg_options` com `confirmed_at IS NOT NULL` e gera relatório do **mês anterior completo** para cada um.

### Dados reutilizáveis

Posts armazenados em `sol_posts` servem como referência para meses seguintes. Se um post já existe no banco (mesmo `post_url`), não precisa re-processar engajadores — dados já existem.

### Histórico retroativo (feature futura — botão desabilitado)

Na página do relatório, mostrar botão:

```
[🔒 Gerar relatório retroativo — Em breve]
```

Botão desabilitado com estilo cinza e label "Em breve". Ao hover, tooltip: "Funcionalidade em desenvolvimento. Em breve você poderá gerar relatórios de meses anteriores."

Quando implementado:
- Add-on pago por mês retroativo
- Busca posts mais antigos via API + processa engajadores
- Cada mês retroativo gera um `sol_reports` independente

---

## Etapa 5: Frontend — Fluxo do botão

### Ao clicar "CONFIRMAR MAPEAMENTO":

1. **Modal de confirmação** com resumo:
   - Resumo do mapeamento: "Sua empresa (N colaboradores) + 2 concorrentes (N + N colaboradores)"
   - "Um relatório mensal será gerado automaticamente com a análise do mês anterior"
   - "O processamento leva alguns minutos. Você pode sair da página — será notificado quando estiver pronto."
   - ⚠️ **NÃO mostrar custos estimados ao user**
   - Botão "Confirmar e gerar primeiro relatório" (roxo) + "Cancelar" (cinza)

2. **Processamento em background:**
   - Salvar `confirmed_at` no `lg_options`
   - Criar `sol_reports` com `status: "processing"`
   - Iniciar processamento via Netlify background function
   - **O processamento continua mesmo que o user saia da página**
   - Mostrar status na página: "Gerando relatório... Você pode sair e voltar depois."
   - Botão "Cancelar análise" disponível enquanto `status = "processing"` → seta `status: "cancelled"`
   - Email de notificação quando `status` muda para `"complete"`

3. **Após geração:**
   - Botão "CONFIRMAR MAPEAMENTO" muda para "VER RELATÓRIO" (link para o relatório)
   - Se já tem relatório anterior, mostrar lista de relatórios por mês

### Seção "Histórico de Relatórios" (abaixo do mapeamento)

```
📊 Relatórios
├── Março 2026 — Ver relatório ✓
├── [Fevereiro 2026 — 🔒 Em breve]
└── [Janeiro 2026 — 🔒 Em breve]
```

Meses sem relatório mostram botão desabilitado "Em breve" para análise retroativa.

### Página do relatório

Mesma estrutura de `/share-of-linkedin-exemplo` mas com dados reais:
- Aba "Análise": SOL, SOV, Insights, Recomendações, Movimentos
- Aba "Conteúdo": Ranking, Análise de Conteúdo (com toggle vagas), Colaboradores, Decisores
- Aba "Influencers": menções externas com influenciadores
- Aba "Posts": todos os posts (empresa + colaboradores) com filtros

Todos os campos JSON da IA seguem o formato definido em `/share-of-linkedin-exemplo` para garantir compatibilidade de renderização.

---

## Estimativa de custo total por relatório (interno — NÃO mostrar ao user)

| Operação | Custo |
|----------|-------|
| Posts de 3 empresas (páginas oficiais) | ~$0.06 |
| Posts de ~20 colaboradores | ~$0.40 |
| Engajadores amostrais (~100 posts × 20) | ~$2.40 |
| Classificação temática (~100 posts) | ~$0.10 |
| Share of Voice (LinkedIn/SERP + sentimento) | ~$0.17 |
| Recomendações IA | ~$0.01 |
| **TOTAL por relatório** | **~$3.14** |

### Por plano (interno):

| Plano | Perfis | Custo/relatório |
|-------|--------|----------------|
| Starter (1 concorrente) | ~10 | ~$2.00 |
| Professional (3 concorrentes) | ~20 | ~$3.50 |
| Business (6 concorrentes) | ~40 | ~$6.50 |

---

## Etapas de implementação

### Fase 1: Infraestrutura de dados
- [ ] Migration: criar tabelas `sol_reports`, `sol_posts`, campo `confirmed_at`
- [ ] API: endpoint POST `/api/sol/generate` que inicia coleta
- [ ] API: endpoint GET `/api/sol/reports?profileId=X` que lista relatórios
- [ ] API: endpoint POST `/api/sol/cancel` que cancela processamento
- [ ] Background function: `netlify/functions/sol-generate.ts`
- **Verificação:** Chamar API manualmente → `sol_reports` criado com status "processing"

### Fase 2: Coleta de posts (empresa + colaboradores)
- [ ] Buscar posts de páginas de empresa (3 empresas)
- [ ] Buscar posts de todos os colaboradores mapeados
- [ ] Filtrar por período (mês anterior)
- [ ] Armazenar em `sol_posts`
- **Verificação:** Query `SELECT count(*) FROM sol_posts WHERE report_id = ?` retorna posts do período

### Fase 3: Análise de engajamento
- [ ] Amostrar 10-20 engajadores por post
- [ ] Classificar decisores via headline (regex, sem IA)
- [ ] Calcular RER estimado por post
- [ ] Adicionar disclaimer de amostragem
- **Verificação:** `sol_posts.rer_estimate` preenchido. Disclaimer visível na UI

### Fase 4: Classificação e métricas
- [ ] Classificar tema de cada post (IA, formato JSON)
- [ ] Classificar tipo de conteúdo (institucional/vagas/produto/outros)
- [ ] Toggle "Mostrar vagas de RH" no frontend
- [ ] Calcular SOL, ranking competitivo
- [ ] Buscar Share of Voice via actor Apify (com fallback SERP)
- **Verificação:** Relatório mostra barras de composição. Toggle de vagas funciona

### Fase 5: Recomendações
- [ ] Gerar recomendações via IA (formato JSON compatível com exemplo)
- [ ] Gerar insights estratégicos (positivos + atenção)
- [ ] Gerar movimentos estratégicos observados
- **Verificação:** Aba "Análise" do relatório mostra recomendações e insights

### Fase 6: Frontend — Relatório real
- [ ] Página `/casting/share-of-linkedin/[profileId]/report/[reportId]`
- [ ] Mesma estrutura do `/share-of-linkedin-exemplo` mas com dados de `sol_reports` + `sol_posts`
- [ ] Disclaimer de amostragem no RER (discreto)
- [ ] Toggle "Mostrar vagas de RH"
- **Verificação:** Acessar relatório → dados reais das 3 empresas

### Fase 7: Botão Confirmar + Modal + Background
- [ ] Modal de confirmação (sem custos visíveis)
- [ ] Processamento em background (continua se user sair)
- [ ] Status na página: "Gerando... pode sair da página"
- [ ] Botão "Cancelar análise"
- [ ] Botão muda para "Ver Relatório" após geração
- [ ] Email de notificação quando pronto
- **Verificação:** Confirmar → sair da página → voltar → relatório gerado

### Fase 8: Cron mensal + Histórico
- [ ] `netlify/functions/sol-monthly-report.ts`
- [ ] Busca mapeamentos confirmados e gera relatório do mês anterior
- [ ] Seção "Histórico de Relatórios" na página do perfil
- [ ] Botão retroativo desabilitado com "Em breve"
- [ ] Email de notificação quando relatório mensal está pronto
- **Verificação:** Cron executa → novo relatório aparece na lista. Botão retroativo desabilitado

---

## Disclaimer de amostragem

Em todos os locais onde RER aparece, incluir tooltip discreto:

> "Estimativa baseada em amostragem de 10-20 engajadores por post."

Estilo: ícone ℹ️ pequeno ao lado do valor, tooltip ao hover. Não intrusivo.

---

## Formato JSON da IA

Todos os prompts de IA devem exigir resposta em JSON e seguir os campos definidos no `/share-of-linkedin-exemplo`:

```json
// Classificação de post:
{"theme":"...","content_type":"produto|institucional|vagas|outros","summary":"..."}

// Sentimento SOV:
{"sentiment":"positivo|neutro|negativo","summary":"..."}

// Recomendações:
{"insights":{...},"recommendations":[...],"movements":[...]}

// Ranking:
{"sol":1.1,"rer":42,"posts":87,"decisores":198,"themes":["tema1","tema2"]}
```
