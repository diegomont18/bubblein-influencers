-- sol_reports: stores report metadata and status
CREATE TABLE IF NOT EXISTS sol_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES lg_profiles(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text DEFAULT 'processing', -- processing | complete | failed | cancelled
  raw_data jsonb,
  metrics jsonb,
  recommendations jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sol_reports_profile ON sol_reports(profile_id);
CREATE INDEX IF NOT EXISTS idx_sol_reports_status ON sol_reports(status);

-- sol_posts: stores individual posts collected per report
CREATE TABLE IF NOT EXISTS sol_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid REFERENCES sol_reports(id),
  profile_slug text NOT NULL,
  company_name text NOT NULL,
  source_type text NOT NULL, -- 'company' | 'employee'
  author_name text,
  author_headline text,
  post_url text,
  text_content text,
  reactions int DEFAULT 0,
  comments int DEFAULT 0,
  posted_at timestamptz,
  theme text,
  content_type text, -- institucional | vagas | produto | outros
  summary text,
  rer_estimate float,
  rer_sample_size int,
  engager_sample jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sol_posts_report ON sol_posts(report_id);
CREATE INDEX IF NOT EXISTS idx_sol_posts_period ON sol_posts(posted_at);

-- Add confirmed_at to lg_options
ALTER TABLE public.lg_options ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
