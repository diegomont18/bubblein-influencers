-- Multi-account Apify support with admin toggles
CREATE TABLE IF NOT EXISTS public.apify_accounts (
  id serial PRIMARY KEY,
  label text NOT NULL,
  env_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO apify_accounts (label, env_key, enabled) VALUES
  ('Conta 1 (principal)', 'APIFY_API_TOKEN', false),
  ('Conta 2', 'APIFY_API_TOKEN_2', true)
ON CONFLICT (env_key) DO NOTHING;
