-- Cache the raw engagers payload per post so repeat scans within the TTL
-- window reuse the result instead of re-calling the Apify actor (biggest
-- line item in our monthly bill).
ALTER TABLE public.lg_posts
  ADD COLUMN IF NOT EXISTS engagers_json jsonb,
  ADD COLUMN IF NOT EXISTS engagers_fetched_at timestamptz;
