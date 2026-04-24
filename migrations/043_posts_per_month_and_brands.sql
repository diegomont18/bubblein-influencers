-- Share of LinkedIn: add company-level posting frequency and proprietary brands.
-- company_posts_per_month: estimated posts/month for the main company page.
-- proprietary_brands: extracted via LLM from site/description (e.g. HubSpot CRM,
-- HubSpot Marketing Hub). Competitor posts/month lives inside lg_options.competitors.
ALTER TABLE public.lg_options
  ADD COLUMN IF NOT EXISTS company_posts_per_month numeric,
  ADD COLUMN IF NOT EXISTS proprietary_brands jsonb DEFAULT '[]'::jsonb;
