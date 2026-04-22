-- Cache of LinkedIn company info to avoid repeated scraping.
-- Keyed by LinkedIn company slug, with 30-day TTL via cached_at.
CREATE TABLE IF NOT EXISTS public.company_cache (
  slug text PRIMARY KEY,
  name text,
  employee_count integer,
  employee_count_range text,
  industry text,
  logo_url text,
  cached_at timestamptz NOT NULL DEFAULT now()
);
