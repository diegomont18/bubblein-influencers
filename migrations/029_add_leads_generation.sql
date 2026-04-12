-- Leads Generation: profile analysis with AI-suggested options
CREATE TABLE public.lg_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_url text NOT NULL,
  name text,
  headline text,
  profile_photo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lg_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.lg_profiles(id) ON DELETE CASCADE,
  post_url text,
  text_content text,
  reactions integer DEFAULT 0,
  comments integer DEFAULT 0,
  posted_at text,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lg_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.lg_profiles(id) ON DELETE CASCADE,
  market_context text,
  job_titles text[],
  departments text[],
  company_sizes text[],
  ai_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lg_profiles_user ON public.lg_profiles(user_id);

ALTER TABLE public.lg_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lg_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lg_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lg_profiles" ON public.lg_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own lg_posts" ON public.lg_posts FOR ALL USING (profile_id IN (SELECT id FROM public.lg_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users manage own lg_options" ON public.lg_options FOR ALL USING (profile_id IN (SELECT id FROM public.lg_profiles WHERE user_id = auth.uid()));
