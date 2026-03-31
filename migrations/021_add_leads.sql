-- Leads scans: tracks each ICP scan job
CREATE TABLE IF NOT EXISTS public.leads_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  post_urls text[] NOT NULL,
  icp_job_titles text[],
  icp_departments text[],
  icp_company_size text,
  total_engagers integer DEFAULT 0,
  matched_leads integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Leads results: individual lead profiles found
CREATE TABLE IF NOT EXISTS public.leads_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid REFERENCES leads_scans(id) ON DELETE CASCADE,
  profile_slug text NOT NULL,
  notes jsonb,
  icp_score float,
  engagement_type text,
  source_post_url text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.leads_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scans" ON public.leads_scans
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own results" ON public.leads_results
  FOR ALL USING (scan_id IN (SELECT id FROM public.leads_scans WHERE user_id = auth.uid()));
