-- Add average engagement metrics per post
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avg_likes_per_post numeric,
  ADD COLUMN IF NOT EXISTS avg_comments_per_post numeric;
