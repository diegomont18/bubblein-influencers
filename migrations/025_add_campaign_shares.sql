-- Campaign sharing via token-based URLs (no auth required for viewers)
CREATE TABLE public.campaign_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,  -- NULL = all campaigns
  token text UNIQUE NOT NULL,
  label text,
  views_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_shares_token ON public.campaign_shares(token);
CREATE INDEX idx_campaign_shares_user ON public.campaign_shares(user_id);

ALTER TABLE public.campaign_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own shares"
  ON public.campaign_shares FOR ALL
  USING (auth.uid() = user_id);
