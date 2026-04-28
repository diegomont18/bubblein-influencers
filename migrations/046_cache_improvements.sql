-- Track when posts were last fetched for a profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS posts_fetched_at timestamptz;

-- Generic posts cache (for caching fetchProfilePosts results)
CREATE TABLE IF NOT EXISTS public.posts_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_url text NOT NULL,
  post_url text NOT NULL UNIQUE,
  raw_data jsonb NOT NULL,
  published_at timestamptz,
  cached_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_cache_profile ON posts_cache(profile_url);
CREATE INDEX IF NOT EXISTS idx_posts_cache_published ON posts_cache(published_at DESC);

-- Cache SERP results to avoid repeating identical searches
CREATE TABLE IF NOT EXISTS public.serp_cache (
  query_hash text PRIMARY KEY,
  query text NOT NULL,
  options jsonb,
  results jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now()
);
