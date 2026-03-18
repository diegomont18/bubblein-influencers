-- Add median engagement metrics to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS median_likes_per_post numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS median_comments_per_post numeric;
