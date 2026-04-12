-- Leads generation results (linked to lg_profiles)
CREATE TABLE public.lg_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.lg_profiles(id) ON DELETE CASCADE,
  profile_slug text NOT NULL,
  name text,
  headline text,
  job_title text,
  company text,
  linkedin_url text,
  profile_photo text,
  icp_score integer DEFAULT 0,
  role_level text,
  engagement_type text,
  source_post_urls text[],
  interaction_count integer DEFAULT 0,
  total_possible_interactions integer DEFAULT 0,
  notes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lg_results_profile ON public.lg_results(profile_id);

ALTER TABLE public.lg_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own lg_results" ON public.lg_results FOR ALL
  USING (profile_id IN (SELECT id FROM public.lg_profiles WHERE user_id = auth.uid()));

-- Add relevance score to posts for AI ranking
ALTER TABLE public.lg_posts ADD COLUMN relevance_score integer;
