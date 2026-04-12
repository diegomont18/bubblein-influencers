-- Pre-registration credits: allocate extra credits to emails before they sign up
CREATE TABLE public.pending_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  extra_credits integer NOT NULL DEFAULT 0,
  claimed boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_credits_email ON public.pending_credits(email);

ALTER TABLE public.pending_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pending credits"
  ON public.pending_credits FOR ALL
  USING (true);
