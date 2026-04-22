-- Share of LinkedIn: extend lg_options with company mapping fields.
-- These complement the existing market_context (reused as "themes")
-- and replace the leads-focused job_titles/departments/company_sizes
-- in the new company-analysis flow.
ALTER TABLE public.lg_options
  ADD COLUMN IF NOT EXISTS competitors text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS employee_profiles jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS icp_description text DEFAULT '';
