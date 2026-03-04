# LinkedIn Influencer Intelligence Platform — Database Schema

Execute no Supabase SQL Editor na ordem abaixo.

---

## 1. Extensões

```sql
create extension if not exists vector;
```

---

## 2. Tabelas

```sql
create table profiles (
  id                      uuid primary key default gen_random_uuid(),
  url                     text not null unique,
  linkedin_id             text,
  name                    text,
  headline                text,
  company_current         text,
  role_current            text,
  location                text,
  followers_count         integer,
  connections_count       integer,
  about                   text,
  topics                  text[],
  topics_embedding        vector(1536),
  posting_frequency       text,
  posting_frequency_score float,
  enrichment_status       text not null default 'pending',
  raw_data                jsonb,
  last_enriched_at        timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table profile_experiences (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  company     text,
  role        text,
  start_date  text,
  end_date    text,
  is_current  boolean default false,
  description text,
  created_at  timestamptz not null default now()
);

create table enrichment_jobs (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references profiles(id) on delete cascade,
  status              text not null default 'queued',
  attempt_count       integer not null default 0,
  last_error          text,
  scrapingdog_status  integer,
  queued_at           timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz
);

create table casting_lists (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  query_theme      text not null,
  query_embedding  vector(1536),
  filters_applied  jsonb,
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table casting_list_profiles (
  id               uuid primary key default gen_random_uuid(),
  list_id          uuid not null references casting_lists(id) on delete cascade,
  profile_id       uuid not null references profiles(id) on delete cascade,
  relevance_score  float,
  frequency_score  float,
  composite_score  float,
  rank_position    integer,
  notes            text,
  status           text not null default 'active',
  added_at         timestamptz not null default now()
);

create table monitoring_configs (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references profiles(id) on delete cascade,
  is_active        boolean not null default true,
  watch_topics     text[] not null,
  alert_threshold  float not null default 0.6,
  check_frequency  text not null default 'daily',
  next_check_at    timestamptz not null default now(),
  last_checked_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table posts (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references profiles(id) on delete cascade,
  post_url            text not null unique,
  text                text,
  reactions_count     integer,
  comments_count      integer,
  published_at        timestamptz,
  topics_detected     text[],
  sentiment           text,
  sentiment_score     float,
  ai_relevance_score  float,
  keywords            text[],
  post_embedding      vector(1536),
  raw_data            jsonb,
  scraped_at          timestamptz not null default now()
);

create table monitoring_alerts (
  id                    uuid primary key default gen_random_uuid(),
  monitoring_config_id  uuid not null references monitoring_configs(id) on delete cascade,
  profile_id            uuid not null references profiles(id),
  post_id               uuid not null references posts(id),
  matched_topic         text not null,
  match_score           float not null,
  alert_sent_at         timestamptz,
  alert_channel         text,
  created_at            timestamptz not null default now()
);

create table scraping_jobs (
  id                    uuid primary key default gen_random_uuid(),
  monitoring_config_id  uuid not null references monitoring_configs(id) on delete cascade,
  profile_id            uuid not null references profiles(id),
  job_type              text not null,
  status                text not null default 'queued',
  posts_found           integer default 0,
  posts_new             integer default 0,
  error_message         text,
  started_at            timestamptz,
  completed_at          timestamptz
);
```

---

## 3. Índices

```sql
create index on profiles (enrichment_status);
create index on enrichment_jobs (status);
create index on enrichment_jobs (profile_id);
create index on casting_list_profiles (list_id);
create index on casting_list_profiles (profile_id);
create index on monitoring_configs (is_active, next_check_at);
create index on monitoring_configs (profile_id);
create index on posts (profile_id);
create index on posts (published_at desc);
create index on monitoring_alerts (profile_id);
create index on monitoring_alerts (monitoring_config_id);
create index on scraping_jobs (status);

create index profiles_topics_embedding_idx
  on profiles
  using ivfflat (topics_embedding vector_cosine_ops)
  with (lists = 100);

create index posts_embedding_idx
  on posts
  using ivfflat (post_embedding vector_cosine_ops)
  with (lists = 100);
```

---

## 4. Trigger de updated_at

```sql
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger trg_casting_lists_updated_at
  before update on casting_lists
  for each row execute function set_updated_at();

create trigger trg_monitoring_configs_updated_at
  before update on monitoring_configs
  for each row execute function set_updated_at();
```

---

## 5. Função de busca semântica

```sql
create or replace function match_profiles_by_embedding(
  query_embedding  vector(1536),
  match_threshold  float default 0.65,
  match_count      int   default 100
)
returns table (
  profile_id  uuid,
  similarity  float
)
language sql stable as $$
  select
    id                                           as profile_id,
    1 - (topics_embedding <=> query_embedding)   as similarity
  from profiles
  where
    enrichment_status = 'done'
    and topics_embedding is not null
    and 1 - (topics_embedding <=> query_embedding) > match_threshold
  order by topics_embedding <=> query_embedding
  limit match_count;
$$;
```

---

## 6. Row Level Security

```sql
alter table profiles               enable row level security;
alter table profile_experiences    enable row level security;
alter table enrichment_jobs        enable row level security;
alter table casting_lists          enable row level security;
alter table casting_list_profiles  enable row level security;
alter table monitoring_configs     enable row level security;
alter table posts                  enable row level security;
alter table monitoring_alerts      enable row level security;
alter table scraping_jobs          enable row level security;
```

Após habilitar o RLS, adicione as policies de acesso conforme a estratégia de autenticação do projeto. Se o acesso vier exclusivamente pelo service_role (Edge Functions e API Routes server-side), nenhuma policy adicional é necessária pois o service_role bypassa o RLS por padrão.