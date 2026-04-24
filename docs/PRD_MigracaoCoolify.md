# PRD — Migração de Infraestrutura: Netlify → Coolify (VPS Self-Hosted)

## Resumo

Migrar a plataforma BubbleIn Influencers do Netlify para Coolify em VPS self-hosted com deploy via Docker. A aplicação Next.js 14.2.33 permanece idêntica; o que muda é a infraestrutura de hosting, background processing e scheduled tasks. Supabase e todos os serviços externos permanecem inalterados.

**Escopo da migração:**
- Dockerfile multi-stage para build e deploy
- Conversão das 5 Netlify Functions em API Routes nativas do Next.js
- Substituição dos scheduled triggers do Netlify por cron jobs no Coolify
- Configuração de DNS, SSL, CI/CD e monitoring no Coolify
- Período de coexistência com rollback seguro

---

## Motivação

| Problema no Netlify | Solução no Coolify |
|---|---|
| Custo crescente em Functions e build minutes | VPS com custo fixo mensal |
| Timeout de 10s (sync) / 15min (background) | Sem limite de timeout — controle total |
| Dependência do `@netlify/plugin-nextjs` (bugs em atualizações) | Next.js standalone nativo, sem plugins |
| Sem controle sobre logs e recursos de máquina | Acesso direto ao container, logs, RAM, CPU |
| Infra fragmentada | Consolidação — equipe já opera VPS com Coolify |

---

## Premissas e Restrições

- **Supabase permanece externo** — nenhuma mudança no banco de dados
- **Serviços externos inalterados**: Apify, OpenRouter, Resend, Contentful, Firecrawl
- **Runtime**: Node.js 22
- **Porta**: 3021
- **Zero downtime para usuários** — migração transparente via DNS switch
- **VPS mínimo**: 2GB RAM / 2 vCPU para suportar builds + processos background simultâneos
- **Sem Edge Runtime** — todas as rotas usam Node.js runtime padrão

---

## Inventário Técnico

### Netlify Functions a migrar (5 total)

| Função | Tipo | Trigger | Linhas | Complexidade |
|--------|------|---------|--------|-------------|
| `apify-usage-check.ts` | Scheduled | `*/15 * * * *` | 29 | Baixa |
| `daily-report.ts` | Scheduled | `0 11 * * *` | 35 | Baixa |
| `casting-search-background.ts` | Background (POST) | Via `/api/casting/search` | 1171 | Alta |
| `leads-scan-background.ts` | Background (POST) | Via `/api/leads/scan` | 195 | Média |
| `lg-scan-background.ts` | Background (POST) | Via `/api/leads-generation/scan` | 559 | Alta |

### Padrão atual de invocação (background functions)

O código já possui um fallback que facilita a migração:
1. API route tenta chamar `/.netlify/functions/{name}` via HTTP POST
2. Se falhar (dev local), faz fallback para rota `-inline` que importa o handler diretamente
3. As rotas inline (`search-inline`, `scan-inline`) já existem com `maxDuration = 300`

**Insight**: As rotas `-inline` já funcionam como substituto, mas possuem um adapter que simula o `HandlerEvent` do Netlify. Na migração, refatoramos para API Routes nativas sem essa camada.

### Variáveis de ambiente (12 + 3 novas)

```
# Existentes (copiar valores do Netlify)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APIFY_API_TOKEN
OPENROUTER_API_KEY
OPENAI_API_KEY
RESEND_API_KEY
CONTENTFUL_SPACE_ID
CONTENTFUL_ACCESS_TOKEN
FIRECRAWL_API_KEY
CRON_SECRET              # Gerar novo valor para produção Coolify
NEXT_PUBLIC_SITE_URL     # Atualizar para novo domínio

# Novas (configurar no Dockerfile/Coolify)
NODE_ENV=production
PORT=3021
HOSTNAME=0.0.0.0
```

**Nota**: `process.env.URL` (auto-set do Netlify) não existe no Coolify. Buscar todas as ocorrências e substituir por `NEXT_PUBLIC_SITE_URL`.

---

## Fases de Implementação

### Fase 1: Docker + Build Local

**Objetivo**: App rodando em container Docker idêntica à produção.

#### 1.1 Ajustar `next.config.mjs`

Adicionar `output: "standalone"` — necessário para Docker:

```js
const nextConfig = {
  output: "standalone",
  // ... manter config existente
};
```

#### 1.2 Criar `Dockerfile` (multi-stage build)

```dockerfile
# Stage 1: Dependências
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3021 HOSTNAME=0.0.0.0
ENV NODE_OPTIONS=--max-old-space-size=1536

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3021
CMD ["node", "server.js"]
```

#### 1.3 Criar `.dockerignore`

```
node_modules
.next
.git
docs/
temp/
*.md
.env*
```

#### 1.4 Testar localmente

```bash
docker build -t bubblein .
docker run -p 3021:3021 --env-file .env.local bubblein
# Verificar: http://localhost:3021 carrega a app
```

**Riscos:**
- `output: "standalone"` muda como Next.js resolve `public/` e `.next/static` — o Dockerfile já copia manualmente
- Remover `@netlify/plugin-nextjs` do build para evitar side effects

**Critérios de aceite:**
- [ ] `docker build` completa sem erro
- [ ] `docker run` serve a app em `localhost:3021`
- [ ] Todas as páginas carregam (home, login, dashboard, casting)

---

### Fase 2: Migrar Background Functions → API Routes Nativas

**Objetivo**: Eliminar dependência de `@netlify/functions` e do adapter `HandlerEvent`.

**Estratégia**: No VPS, o servidor Node.js não tem timeout de 10s como serverless — o request pode rodar quanto tempo precisar. Converter cada function em API Route padrão Next.js. O caller faz `fetch()` sem `await` (fire-and-forget), mesmo padrão já usado no fallback inline.

#### 2.1 `casting-search-background` → `POST /api/casting/search-bg`

- Criar `src/app/api/casting/search-bg/route.ts`
- Extrair lógica do handler, remover types `Handler/HandlerEvent` do `@netlify/functions`
- Usar `NextRequest` e `request.json()` em vez de `event.body`
- Manter toda lógica de negócio idêntica (Google search, profile fetch, AI scoring)
- Atualizar `src/app/api/casting/search/route.ts` para chamar `/api/casting/search-bg` em vez de `/.netlify/functions/casting-search-background`

#### 2.2 `leads-scan-background` → `POST /api/leads/scan-bg`

- Criar `src/app/api/leads/scan-bg/route.ts`
- Mesma abordagem: nova rota, remover adapter Netlify
- Atualizar `src/app/api/leads/scan/route.ts`

#### 2.3 `lg-scan-background` → `POST /api/leads-generation/scan-bg`

- Criar `src/app/api/leads-generation/scan-bg/route.ts`
- Mesma abordagem
- Atualizar `src/app/api/leads-generation/scan/route.ts`

#### 2.4 Remover rotas `-inline` obsoletas

- Deletar `src/app/api/casting/search-inline/route.ts`
- Deletar `src/app/api/leads-generation/scan-inline/route.ts`

#### 2.5 Limpar dependências Netlify

- Remover `@netlify/functions` do `devDependencies`
- Remover `@netlify/plugin-nextjs` do `devDependencies`
- Deletar `netlify.toml`
- Deletar diretório `netlify/functions/`

**Critérios de aceite:**
- [ ] Cada rota `-bg` processa idêntico ao handler Netlify original
- [ ] Polling de status (`casting_lists.status`, `leads_scans.status`, `lg_profiles.scan_status`) funciona
- [ ] Zero referências a `@netlify/functions` no código
- [ ] Teste manual: 1 casting search + 1 leads scan + 1 lg scan com resultados corretos

---

### Fase 3: Migrar Scheduled Functions → Cron Endpoints

**Objetivo**: Substituir `[functions.schedule]` do Netlify por cron jobs no Coolify.

#### 3.1 `apify-usage-check` → `POST /api/cron/apify-usage`

- Criar `src/app/api/cron/apify-usage/route.ts`
- Verificar header `x-cron-secret` (padrão já existente em `enrichment/process`)
- Chamar `checkApifyUsage()` e retornar resultado

#### 3.2 `daily-report` → `POST /api/cron/daily-report`

- Criar `src/app/api/cron/daily-report/route.ts`
- Verificar secret, chamar `collectDailyReport`, `saveDailyReport`, `sendDailyReportEmail`

#### 3.3 Health check endpoint

- Criar `GET /api/health` retornando `{ status: "ok", timestamp, version }`
- Usado pelo Coolify para health check e restart automático

#### 3.4 Configurar crons no Coolify

**Opção A (preferida) — Coolify Scheduled Tasks:**

```bash
# A cada 15 minutos
curl -X POST -H "x-cron-secret: ${CRON_SECRET}" https://app.dominio/api/cron/apify-usage --max-time 30

# Diariamente às 11:00 UTC
curl -X POST -H "x-cron-secret: ${CRON_SECRET}" https://app.dominio/api/cron/daily-report --max-time 60
```

**Opção B (fallback) — cron-job.org:**
- Cadastrar endpoints com schedule, método POST e header custom
- Funciona independente do Coolify; mais um serviço externo

**Critérios de aceite:**
- [ ] `POST /api/cron/apify-usage` com header correto → 200 com dados
- [ ] `POST /api/cron/apify-usage` sem header → 401
- [ ] `POST /api/cron/daily-report` executa e envia email
- [ ] Crons executam nos intervalos corretos (verificar via logs)

---

### Fase 4: Deploy no Coolify + DNS

**Objetivo**: App rodando em produção no Coolify, paralelo ao Netlify.

#### 4.1 Configurar projeto no Coolify

- Criar recurso tipo "Dockerfile" no Coolify
- Conectar repositório Git (webhook para auto-deploy no push para `main`)
- Configurar todas as variáveis de ambiente
- Setar `NEXT_PUBLIC_SITE_URL` para o domínio de staging

#### 4.2 SSL/TLS

- Coolify gerencia Let's Encrypt automaticamente via Traefik
- Configurar domínio para auto-renovação de certificado
- Verificar HTTPS com redirect automático de HTTP

#### 4.3 Configurar timeout do Traefik

O Traefik (reverse proxy do Coolify) tem timeout padrão de ~30-60s. As rotas de background precisam de 600s+.

Adicionar labels no Coolify ou docker-compose:
```yaml
labels:
  - "traefik.http.middlewares.long-timeout.headers.customrequestheaders.X-Forwarded-Proto=https"
  - "traefik.http.services.app.loadbalancer.server.port=3021"
  # Timeout de 10 minutos para rotas background
```

Ou configurar via Coolify UI → Proxy settings.

#### 4.4 Staging e validação

- Deploy em subdomínio de staging (ex: `staging.bubblein.com`)
- Validar todos os fluxos antes do DNS switch
- Rodar checklist de testes completo (seção Verificação)

#### 4.5 DNS switch

1. Reduzir TTL do DNS para 300s (5 min) — 24h antes do switch
2. Alterar A/CNAME record para IP do VPS
3. Manter Netlify deploy ativo por 72h como fallback
4. Após 72h estável, desativar Netlify

#### 4.6 CI/CD

**Opção A — Coolify Git Integration (recomendada):**
- Webhook no repositório → build automático no push para `main`
- Coolify faz `docker build` + deploy automaticamente

**Opção B — GitHub Actions + Registry:**
- Build no GitHub Actions, push para GHCR
- Coolify faz pull da image
- Builds mais rápidos (cache do GH Actions)

**Critérios de aceite:**
- [ ] App acessível via HTTPS no staging
- [ ] Todas as API routes respondem corretamente
- [ ] Background functions executam e completam
- [ ] Cron jobs disparam nos intervalos corretos
- [ ] SSL certificado válido

---

### Fase 5: Monitoring, Logging e Rollback

**Objetivo**: Visibilidade operacional equivalente ou superior ao Netlify.

#### 5.1 Logging

- Coolify tem viewer de logs built-in (stdout/stderr do container)
- `NODE_ENV=production` para logs limpos
- Opcional: Dozzle ou Loki para agregação de logs

#### 5.2 Health monitoring

- Health check via `GET /api/health`
- Restart automático no Coolify se health check falhar
- Opcional: UptimeRobot monitorando endpoint principal

#### 5.3 Error alerting (já existe)

- `notifyError()` via Resend funciona independente de plataforma
- Verificar que emails de erro continuam sendo entregues

#### 5.4 Estratégia de rollback

| Cenário | Ação | Tempo |
|---------|------|-------|
| Problema de infra | Reverter DNS para Netlify | < 5 min |
| Bug no código | Rollback de deploy no Coolify | < 2 min |
| Problema grave | Git revert + redeploy | < 10 min |

**Procedimento:**
1. Identificar problema (logs, alertas de erro, reports de usuários)
2. Se infra: reverter DNS para Netlify (TTL 300s)
3. Se código: rollback no Coolify para versão anterior
4. Notificar equipe
5. Post-mortem

---

### Fase 6: Cleanup e Finalização

**Objetivo**: Remover toda infra Netlify após 72h estável no Coolify.

- [ ] Deletar site no Netlify
- [ ] Deletar `netlify/` directory do repositório
- [ ] Deletar `netlify.toml`
- [ ] Remover `@netlify/functions` e `@netlify/plugin-nextjs` do `package.json`
- [ ] Remover referências a `process.env.URL` (substituir por `NEXT_PUBLIC_SITE_URL`)
- [ ] Atualizar README com instruções de deploy no Coolify

---

## Pontos Críticos e Edge Cases

### `casting-search-background` é o maior risco

- 1171 linhas, dezenas de API calls em sequência (Google, LinkedIn, AI)
- Pode rodar 5-8 minutos
- Se o container reiniciar durante processamento, `casting_list` fica com `status: "searching"` para sempre
- **Solução**: Adicionar endpoint `POST /api/cron/recover-stale-jobs` que busca jobs com status stuck > 15min e marca como erro. Configurar como cron a cada 30min.

### Concorrência de background jobs

- No Netlify: cada invocação é isolada (Lambda separado)
- No VPS: compartilham o mesmo processo Node.js
- 3 casting searches simultâneos podem consumir >1GB RAM
- **Solução**: `NODE_OPTIONS=--max-old-space-size=1536` no Dockerfile. Se necessário, implementar semáforo limitando a 2 jobs simultâneos (rejeitar com 429).

### Proxy timeout (Traefik)

- Default do Traefik pode ser 30-60s
- Rotas de background precisam de 600s+
- **Solução**: Configurar timeout do proxy nas rotas de background via labels ou Coolify UI

### Persistent storage

- Next.js com `output: "standalone"` pode precisar de write access para `.next/cache`
- **Solução**: Aceitar que ISR cache reinicia a cada deploy (comportamento aceitável), ou configurar volume Docker

---

## Verificação — Plano de Testes

### Smoke tests pós-deploy

- [ ] Home page carrega
- [ ] Login/signup funciona
- [ ] Dashboard carrega com dados
- [ ] Página de casting lista resultados anteriores
- [ ] Blog carrega (Contentful)

### Background processing

- [ ] Iniciar casting search → verificar polling de status → verificar resultados
- [ ] Iniciar leads scan → verificar polling → verificar resultados
- [ ] Iniciar LG scan → verificar resultados e créditos deduzidos

### Cron jobs

- [ ] `POST /api/cron/apify-usage` manualmente com header → resposta 200
- [ ] `POST /api/cron/daily-report` manualmente → email enviado
- [ ] Verificar execução automática via logs após 24h

### Resiliência

- [ ] Reiniciar container durante idle → app volta automaticamente
- [ ] Health check configurado e funcionando
- [ ] Simular DNS rollback para Netlify

### Segurança

- [ ] Cron endpoints rejeitam requests sem `x-cron-secret` (401)
- [ ] HTTPS obrigatório (HTTP redireciona)
- [ ] Variáveis sensíveis não aparecem em logs
