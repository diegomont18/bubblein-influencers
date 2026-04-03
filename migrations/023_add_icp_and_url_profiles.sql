-- ICP profiles: saved ICP configurations for leads scanning
CREATE TABLE public.icp_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  job_titles text[],
  departments text[],
  company_sizes text[],
  created_at timestamptz DEFAULT now()
);

-- URL profiles: saved sets of LinkedIn post URLs
CREATE TABLE public.url_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  post_urls text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.icp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.url_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own icp_profiles" ON public.icp_profiles
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own url_profiles" ON public.url_profiles
  FOR ALL USING (auth.uid() = user_id);
