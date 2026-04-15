-- Companies to exclude from lead scanning for a given analyzed LinkedIn
-- profile: if the analyzed profile belongs to a company, we exclude
-- everyone at that company; if it belongs to a person, we exclude anyone
-- currently/previously at the same companies as that person.
--
-- Stored normalized (lowercased, trimmed, no suffix) for fast membership
-- checks in the background scan function.
ALTER TABLE public.lg_profiles
  ADD COLUMN IF NOT EXISTS company_blacklist text[] DEFAULT '{}'::text[];
