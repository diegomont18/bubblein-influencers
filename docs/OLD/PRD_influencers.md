# PRD — LinkedIn Influencer Intelligence Platform

Versão 1.0 — Março 2026 — Status: Draft

---

## Visão Geral

Este documento descreve os requisitos de produto da plataforma de inteligência de influenciadores do LinkedIn. O sistema é desenvolvido em três fases independentes, cada uma entregando um módulo funcional completo. O banco de dados é criado integralmente na Fase 1, já preparado para suportar as evoluções das fases seguintes sem necessidade de alterações estruturais.

Stack técnica: Next.js 14 com TypeScript, Supabase com PostgreSQL e pgvector, OpenRouter para IA, Scrapingdog como fonte de dados do LinkedIn, Resend para emails e Vercel para deploy.

---

## Problema

Agências que trabalham com influenciadores do LinkedIn não têm visibilidade estruturada sobre quem são os melhores criadores para cada tema, com que frequência publicam e o que estão dizendo no momento. A pesquisa manual consome horas por campanha, é subjetiva e não escala. Não existe hoje uma ferramenta que combine enriquecimento de perfil, busca semântica por tema e monitoramento automatizado de conteúdo numa única plataforma voltada para agências.

---

## Solução

Uma plataforma web que conecta a Scrapingdog LinkedIn API com uma camada de inteligência artificial para entregar três capacidades centrais. A primeira é o enriquecimento automatizado de perfis a partir de uma lista de URLs. A segunda é o casting semântico, onde o usuário descreve um tema em linguagem natural e recebe uma lista rankeada de influenciadores relevantes. A terceira é o monitoramento contínuo, que detecta automaticamente quando os influenciadores do pool publicam sobre temas de interesse da agência e dispara alertas.

---

## Premissas e Restrições Técnicas

A Scrapingdog opera exclusivamente sobre dados públicos do LinkedIn, sem usar contas ou sessões autenticadas. O endpoint de perfil retorna dados estruturados diretamente. O endpoint de post individual recebe uma URL de atividade e retorna o conteúdo completo. Não existe endpoint nativo para listar todos os posts de um perfil, o que exige uma etapa de descoberta de URLs via Web Scraper genérico na fase de monitoramento.

O custo operacional estimado em produção plena é de 150 a 200 dólares por mês, distribuídos entre Scrapingdog no plano Standard a 90 dólares, Supabase Pro a 25 dólares, OpenRouter e embeddings OpenAI entre 15 e 45 dólares, Resend e Vercel somando mais 20 dólares.

---

## Estrutura de Fases

Fase 1 cobre o módulo de enriquecimento de perfis e a criação completa do banco de dados. Fase 2 entrega o motor de casting semântico. Fase 3 implementa o monitoramento de posts e o sistema de alertas. Cada fase tem duração estimada de três a quatro semanas e pode ser entregue e validada de forma independente.

---

## Banco de Dados — Estrutura Completa

O banco de dados é criado integralmente na Fase 1. Todas as tabelas necessárias para as três fases são definidas desde o início, incluindo as que só serão populadas nas fases seguintes. Isso evita migrações durante o desenvolvimento e garante que as relações entre tabelas estejam corretas desde o começo. O Supabase é configurado com a extensão pgvector habilitada para suporte a embeddings vetoriais. Um trigger de updated_at é aplicado nas tabelas profiles, casting_lists e monitoring_configs. Row Level Security é habilitado em todas as tabelas. Índices IVFFlat são criados nos campos topics_embedding e post_embedding para acelerar buscas vetoriais.

### Tabela profiles

É a tabela central do sistema. Armazena todos os dados enriquecidos de cada influenciador. Um registro é criado quando a URL é importada e atualizado progressivamente conforme o enriquecimento avança. O campo enrichment_status segue os estados pending, processing, done e error. O campo topics é um array de texto preenchido pela IA após o enriquecimento, contendo os três a cinco temas principais do influenciador. O campo topics_embedding armazena o vetor de 1536 dimensões gerado pelo modelo text-embedding-3-small da OpenAI a partir do conteúdo de topics, e é o campo usado nas buscas semânticas da Fase 2. O campo raw_data guarda a resposta bruta da Scrapingdog para fins de auditoria e reprocessamento.

```sql
id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
url                     TEXT NOT NULL UNIQUE
linkedin_id             TEXT
name                    TEXT
headline                TEXT
company_current         TEXT
role_current            TEXT
location                TEXT
followers_count         INTEGER
connections_count       INTEGER
about                   TEXT
topics                  TEXT[]
topics_embedding        vector(1536)
posting_frequency       TEXT
posting_frequency_score FLOAT
enrichment_status       TEXT DEFAULT 'pending'
raw_data                JSONB
last_enriched_at        TIMESTAMPTZ
created_at              TIMESTAMPTZ DEFAULT now()
updated_at              TIMESTAMPTZ DEFAULT now()
```

### Tabela profile_experiences

Armazena o histórico de experiências profissionais de cada perfil, extraído pelo Scrapingdog. Um perfil pode ter múltiplas entradas nessa tabela.

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
company     TEXT
role        TEXT
start_date  TEXT
end_date    TEXT
is_current  BOOLEAN DEFAULT false
description TEXT
created_at  TIMESTAMPTZ DEFAULT now()
```

### Tabela enrichment_jobs

Controla a fila de processamento de enriquecimento. Cada vez que um perfil é enfileirado para enriquecimento, seja na importação inicial ou em um re-enriquecimento manual, um registro é criado aqui. O sistema de retry usa o campo attempt_count para decidir quando parar de tentar.

```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
status              TEXT NOT NULL DEFAULT 'queued'
attempt_count       INTEGER NOT NULL DEFAULT 0
last_error          TEXT
scrapingdog_status  INTEGER
queued_at           TIMESTAMPTZ DEFAULT now()
started_at          TIMESTAMPTZ
completed_at        TIMESTAMPTZ
```

### Tabela casting_lists

Criada na Fase 1, populada na Fase 2. Armazena as listas de casting geradas a partir de buscas semânticas. Cada lista representa uma busca salva com o tema original e os filtros utilizados.

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL
description     TEXT
query_theme     TEXT NOT NULL
query_embedding vector(1536)
filters_applied JSONB
created_by      TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### Tabela casting_list_profiles

Tabela de relacionamento entre listas de casting e perfis. Armazena os scores individuais calculados no momento da busca e permite que o analista adicione notas e altere o status de cada perfil dentro de uma lista. O campo status aceita os valores active, removed, negotiating e contracted.

```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
list_id          UUID NOT NULL REFERENCES casting_lists(id) ON DELETE CASCADE
profile_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
relevance_score  FLOAT
frequency_score  FLOAT
composite_score  FLOAT
rank_position    INTEGER
notes            TEXT
status           TEXT DEFAULT 'active'
added_at         TIMESTAMPTZ DEFAULT now()
```

### Tabela monitoring_configs

Criada na Fase 1, usada na Fase 3. Cada registro representa a configuração de monitoramento de um perfil específico, com os temas a observar, a frequência de verificação e o threshold mínimo de score para disparar um alerta. O campo check_frequency aceita os valores daily, every_2_days e weekly.

```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
profile_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
is_active        BOOLEAN NOT NULL DEFAULT true
watch_topics     TEXT[] NOT NULL
alert_threshold  FLOAT NOT NULL DEFAULT 0.6
check_frequency  TEXT NOT NULL DEFAULT 'daily'
next_check_at    TIMESTAMPTZ NOT NULL DEFAULT now()
last_checked_at  TIMESTAMPTZ
created_at       TIMESTAMPTZ DEFAULT now()
updated_at       TIMESTAMPTZ DEFAULT now()
```

### Tabela posts

Armazena todos os posts coletados dos perfis monitorados. Um post só é inserido uma vez, identificado de forma única pela sua URL de atividade. Os campos de classificação são preenchidos pela IA após a coleta do conteúdo. O campo post_embedding permite busca semântica dentro do histórico de posts.

```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
post_url            TEXT NOT NULL UNIQUE
text                TEXT
reactions_count     INTEGER
comments_count      INTEGER
published_at        TIMESTAMPTZ
topics_detected     TEXT[]
sentiment           TEXT
sentiment_score     FLOAT
ai_relevance_score  FLOAT
keywords            TEXT[]
post_embedding      vector(1536)
raw_data            JSONB
scraped_at          TIMESTAMPTZ DEFAULT now()
```

### Tabela monitoring_alerts

Registra cada alerta gerado quando um post tem match com um tema monitorado. Guarda qual tema gerou o match, o score obtido e quando a notificação foi enviada. Serve tanto como log de alertas quanto como base para o histórico exibido no dashboard.

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
monitoring_config_id  UUID NOT NULL REFERENCES monitoring_configs(id) ON DELETE CASCADE
profile_id            UUID NOT NULL REFERENCES profiles(id)
post_id               UUID NOT NULL REFERENCES posts(id)
matched_topic         TEXT NOT NULL
match_score           FLOAT NOT NULL
alert_sent_at         TIMESTAMPTZ
alert_channel         TEXT
created_at            TIMESTAMPTZ DEFAULT now()
```

### Tabela scraping_jobs

Registra cada execução do job de monitoramento. Permite auditoria de quantos posts foram descobertos e inseridos por execução, e guarda mensagens de erro quando o job falha.

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
monitoring_config_id  UUID NOT NULL REFERENCES monitoring_configs(id) ON DELETE CASCADE
profile_id            UUID NOT NULL REFERENCES profiles(id)
job_type              TEXT NOT NULL
status                TEXT NOT NULL DEFAULT 'queued'
posts_found           INTEGER DEFAULT 0
posts_new             INTEGER DEFAULT 0
error_message         TEXT
started_at            TIMESTAMPTZ
completed_at          TIMESTAMPTZ
```

---

## Fase 1 — Profile Enricher

### Objetivo

Construir a espinha dorsal do sistema: a capacidade de importar perfis do LinkedIn em lote, buscar dados estruturados via Scrapingdog, classificar temas com IA e gerenciar todo esse processo através de um painel administrativo. Ao fim desta fase o banco de dados está completamente criado e populado com os perfis do pool inicial da agência.

### Importação de Perfis

O painel oferece uma interface onde o usuário pode colar uma lista de URLs de perfis do LinkedIn, uma por linha, ou fazer upload de um arquivo CSV com uma coluna de URLs. Antes de enfileirar, o sistema valida o formato de cada URL para garantir que sejam perfis válidos do LinkedIn. URLs duplicadas em relação ao banco existente são ignoradas silenciosamente. Após a validação, cada URL válida gera um registro na tabela profiles com status pending e um registro correspondente em enrichment_jobs com status queued.

O painel exibe em tempo real o progresso da fila: quantos perfis estão pendentes, quantos estão sendo processados, quantos foram concluídos com sucesso e quantos falharam. O usuário pode cancelar toda a fila ou reprocessar perfis com erro individualmente.

### Enriquecimento via Scrapingdog

Uma Supabase Edge Function roda em cron a cada minuto e processa até cinco jobs da fila por vez. Para cada job, extrai o slug do perfil a partir da URL e chama o endpoint GET /linkedin/ da Scrapingdog com os parâmetros api_key, type=profile e linkId igual ao slug. Se a resposta for 200, os dados são normalizados e persistidos. Se a resposta for 202, significa que o Scrapingdog ainda está processando o perfil com CAPTCHA: o job é marcado como processing e agendado para retry em três minutos. Se ocorrer erro, o campo attempt_count é incrementado e o job é recolocado na fila. Após três tentativas sem sucesso, o job é marcado como failed e o perfil recebe status error.

Os campos extraídos incluem nome completo, headline, empresa atual, cargo atual, localização, contagem de seguidores, contagem de conexões, texto da seção Sobre e array de experiências profissionais. As experiências são inseridas na tabela profile_experiences com FK para o perfil. A resposta bruta completa é salva no campo raw_data para auditoria.

### Classificação Temática por IA

Imediatamente após o enriquecimento bem-sucedido, o sistema chama o OpenRouter com um prompt estruturado contendo o headline, o texto da seção Sobre e os cargos mais recentes do perfil. O modelo retorna um array com três a cinco temas que melhor descrevem a especialização e os interesses de conteúdo do influenciador.

Com o array de temas definido, o sistema gera um embedding vetorial concatenando todos os temas em um único texto e chamando o modelo text-embedding-3-small da OpenAI. O vetor resultante de 1536 dimensões é salvo no campo topics_embedding do perfil. Este campo é o que alimenta as buscas semânticas da Fase 2.

A frequência de postagem estimada é calculada a partir das informações de atividade recente disponíveis no retorno do Scrapingdog, quando presentes, e salva nos campos posting_frequency como texto legível e posting_frequency_score como um número de zero a dez.

### Painel de Gerenciamento

O painel lista todos os perfis enriquecidos exibindo nome, headline, empresa, número de seguidores, temas classificados e frequência estimada de postagem. O usuário pode filtrar por tema, por cargo, por empresa, por faixa de seguidores e por frequência mínima de postagem. Cada perfil pode ser aberto para visualização completa, incluindo histórico de experiências e dados brutos. Um botão de re-enriquecimento manual permite atualizar os dados de qualquer perfil individualmente.

### Fluxo Técnico

```
POST /api/profiles/import
  Recebe: { urls: string[] }
  Valida formato de cada URL
  Insere profiles com enrichment_status = pending
  Insere enrichment_jobs com status = queued
  Retorna: { queued: number, duplicates: number, invalid: number }

Edge Function: process-enrichment-queue (cron 1min)
  Busca jobs com status = queued, limit 5
  Para cada job:
    Extrai slug da URL do perfil
    GET https://api.scrapingdog.com/linkedin/
      ?api_key=KEY&type=profile&linkId={slug}
    Se 200: normaliza campos, chama OpenRouter para topics[]
            gera embedding via OpenAI, salva tudo
            marca job completed, profile status = done
    Se 202: marca job processing, agenda retry em 3min
    Se erro: incrementa attempt_count
             se >= 3: marca failed, profile status = error
```

### Critérios de Aceite

- Importar lista de 50 perfis e ter ao menos 90% enriquecidos com sucesso em até 30 minutos.
- Cada perfil concluído deve ter headline, empresa, seguidores e o array topics preenchido com ao menos três temas.
- O campo topics_embedding deve estar populado para todos os perfis com status done.
- O retry automático para respostas 202 deve funcionar sem intervenção manual.
- O banco de dados completo com todas as nove tabelas deve estar criado e com RLS habilitado.

---

## Fase 2 — Casting Engine

### Objetivo

Com o banco de perfis populado pela Fase 1, esta fase constrói o motor de busca semântica. O usuário descreve um tema em linguagem natural e recebe uma lista rankeada de influenciadores, com score composto e possibilidade de salvar o resultado como uma lista de casting nomeada.

### Busca Semântica

O campo de busca aceita texto livre em qualquer idioma. Ao submeter, o sistema gera um embedding do texto usando o mesmo modelo text-embedding-3-small da OpenAI utilizado no enriquecimento. Em seguida chama a função SQL match_profiles_by_embedding no Supabase, que calcula a similaridade coseno entre o embedding da busca e o campo topics_embedding de todos os perfis com status done. Apenas perfis com similaridade acima de 0.65 são retornados, evitando resultados sem relevância.

O score composto é calculado combinando três dimensões: relevância semântica com peso de 60%, frequência de postagem representada pelo posting_frequency_score com peso de 25%, e volume de seguidores normalizado em escala logarítmica com peso de 15%. O resultado final é um número de zero a cem exibido ao lado de cada perfil.

### Interface de Resultados

Os resultados são exibidos em cards com foto, nome, headline, empresa, score composto, temas do perfil, número de seguidores e frequência de postagem estimada. O usuário pode reordenar os resultados por score, por seguidores, por frequência ou por relevância pura. Filtros adicionais permitem restringir por cargo, empresa, localização, mínimo de seguidores e frequência mínima.

### Listas de Casting

Após uma busca, o usuário pode salvar o resultado como uma lista de casting com nome e descrição. O sistema insere um registro em casting_lists com o tema original e o embedding da busca, e insere um registro em casting_list_profiles para cada perfil incluído, com seus scores individuais e posição no ranking.

A tela de listas salvas exibe o histórico de castings com data de criação, tema buscado e número de perfis. Cada lista pode ser aberta para visualização completa, onde o analista pode adicionar notas por perfil, alterar o status de cada um e exportar a lista inteira em CSV com todos os campos enriquecidos.

### Fluxo Técnico

```
POST /api/casting/search
  Recebe: { theme: string, filters?: object }
  Gera embedding do theme via OpenAI
  Chama Supabase RPC match_profiles_by_embedding
    threshold: 0.65, limit: 100
  Aplica filtros adicionais no resultado
  Calcula composite_score para cada perfil
  Retorna lista ordenada por composite_score

SQL Function match_profiles_by_embedding:
  SELECT id, 1 - (topics_embedding <=> query_embedding) AS similarity
  FROM profiles
  WHERE enrichment_status = 'done'
    AND 1 - (topics_embedding <=> query_embedding) > match_threshold
  ORDER BY topics_embedding <=> query_embedding
  LIMIT match_count
```

### Critérios de Aceite

- A busca retorna resultados em menos de três segundos para um banco com até 500 perfis.
- O score semântico correlaciona com a relevância percebida pelo usuário em validação manual com dez buscas de teste.
- O CSV exportado contém todos os campos de perfil e os scores calculados para aquela lista.
- Filtros de cargo, seguidores mínimos e localização funcionam corretamente em combinação.

---

## Fase 3 — Monitoring

### Objetivo

Permitir à agência acompanhar automaticamente o que os influenciadores do seu pool estão publicando, detectar menções a temas específicos configurados por perfil e receber alertas quando conteúdo relevante for encontrado.

### Configuração de Monitoramentos

Na tela de monitoramento, o usuário seleciona um perfil do pool e configura um monitoramento para ele. As configurações incluem a lista de temas a observar naquele perfil, o threshold mínimo de score para disparar um alerta com valor padrão de 0.6, e a frequência de verificação que pode ser diária, a cada dois dias ou semanal. A configuração é salva em monitoring_configs e o campo next_check_at é definido imediatamente para a próxima execução. O usuário pode ativar e pausar monitoramentos individualmente a qualquer momento.

### Coleta de Posts

Uma Supabase Edge Function roda em cron a cada 30 minutos e verifica quais configurações de monitoramento têm next_check_at menor ou igual ao momento atual. Para cada configuração ativa, executa o seguinte fluxo em duas etapas.

Na primeira etapa, o Scrapingdog Web Scraper genérico é chamado para raspar a página pública de posts do perfil do LinkedIn. O HTML retornado é parseado para extrair todas as URLs de atividade presentes na página, no formato linkedin.com/feed/update/urn:li:activity:. Essas URLs são comparadas contra os registros existentes na tabela posts para o mesmo profile_id: URLs já conhecidas são descartadas e apenas as novas seguem para a segunda etapa.

Na segunda etapa, para cada URL nova, o sistema chama o endpoint GET /linkedin/post da Scrapingdog passando a URL da atividade. A resposta retorna o texto completo do post, data de publicação, contagem de reações e contagem de comentários. Esses dados são persistidos na tabela posts junto com o raw_data.

### Classificação por IA

Imediatamente após a inserção de cada post novo, o sistema chama o OpenRouter com o texto do post e a lista de watch_topics da configuração de monitoramento correspondente. O modelo retorna os temas detectados no post, o sentimento classificado como positive, neutral ou negative com um score numérico de menos um a um, um score geral de relevância entre zero e um, e uma lista de keywords extraídas. Esses campos são salvos no registro do post.

Em paralelo, o sistema gera o embedding do texto do post usando o mesmo modelo de embeddings, salvando em post_embedding para permitir buscas semânticas no histórico de posts futuramente.

### Alertas

Após a classificação, o sistema verifica se o ai_relevance_score do post é maior ou igual ao alert_threshold configurado. Se for, insere um registro em monitoring_alerts com o tema que gerou o match e o score obtido. Em seguida envia um email via Resend para o endereço configurado contendo o nome do influenciador, o tema detectado, um trecho do texto do post e o link direto para o conteúdo original no LinkedIn.

Se um webhook estiver configurado, o sistema dispara também uma requisição POST com o payload completo do alerta em JSON, permitindo integração com Slack, Notion ou qualquer outro sistema externo. Após o disparo, o campo alert_sent_at é preenchido no registro de alerta.

Ao fim de cada execução bem-sucedida, last_checked_at é atualizado na configuração e next_check_at é recalculado com base na frequência escolhida.

### Dashboard de Monitoramento

O dashboard exibe um feed cronológico de todos os posts coletados, com indicação visual de quais geraram alertas. O usuário pode filtrar por perfil, por tema detectado, por sentimento, por período e por palavra-chave. Uma aba separada lista o histórico de alertas disparados com data, perfil, tema e link para o post. Uma visualização de calendário mostra a atividade de publicação de cada influenciador monitorado ao longo do tempo.

### Fluxo Técnico

```
Edge Function: check-monitoring-queue (cron 30min)
  Busca monitoring_configs WHERE is_active = true
    AND next_check_at <= now()
  Para cada config:
    Etapa 1 — Descoberta de URLs
      Scrapingdog Web Scraper raspa página de posts do perfil
      Parser extrai URLs /feed/update/urn:li:activity:*
      Filtra URLs já existentes em posts WHERE profile_id = X
    Etapa 2 — Coleta de Conteúdo
      Para cada URL nova:
        GET https://api.scrapingdog.com/linkedin/post
          ?api_key=KEY&url={post_url}
        Insere em posts com texto, reações, data
    Etapa 3 — Classificação IA
      OpenRouter classifica topics_detected, sentimento, keywords
      OpenAI gera embedding do texto do post
      Atualiza registro do post com todos os campos
    Etapa 4 — Alertas
      Se ai_relevance_score >= alert_threshold:
        Insere monitoring_alerts
        Envia email via Resend
        Dispara webhook se configurado
    Atualiza last_checked_at e next_check_at na config
```

### Critérios de Aceite

- Posts novos são descobertos e classificados em até 24 horas após a publicação para perfis com monitoramento diário.
- O email de alerta é entregue em até uma hora após a detecção do match.
- A taxa de falso positivo nos alertas é inferior a 20% em validação manual com amostra de 50 alertas.
- O dashboard com filtros por tema, perfil e período funciona corretamente.
- O histórico de posts permanece pesquisável por palavra-chave.

---

LinkedIn Influencer Intelligence Platform — PRD v1.0 — Março 2026