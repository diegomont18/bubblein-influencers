-- Link scans to the ICP and URL profiles that were used, so we can
-- show their user-created names in the scan history dropdown.
ALTER TABLE public.leads_scans
  ADD COLUMN IF NOT EXISTS icp_profile_id uuid REFERENCES public.icp_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS url_profile_id uuid REFERENCES public.url_profiles(id) ON DELETE SET NULL;
