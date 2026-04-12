-- API cost tracking: log every external API call with estimated USD cost
CREATE TABLE public.api_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL,       -- 'casting', 'leads', 'enrichment'
  search_id text,             -- casting_list.id or leads_scan.id
  provider text NOT NULL,     -- 'scrapingdog', 'apify', 'openrouter'
  operation text NOT NULL,    -- 'searchProfiles', 'fetchPosts', 'classifyTopics', etc.
  estimated_cost numeric(10,6) NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_costs_created ON public.api_costs(created_at);
CREATE INDEX idx_api_costs_source ON public.api_costs(source);
CREATE INDEX idx_api_costs_search ON public.api_costs(search_id);

ALTER TABLE public.api_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read api_costs"
  ON public.api_costs FOR ALL
  USING (true);
