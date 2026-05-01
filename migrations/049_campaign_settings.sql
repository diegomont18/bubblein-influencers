-- Add settings JSONB column to campaigns to persist per-campaign filters
-- (themes, language, follower range, results count) configured on /casting.
-- Default '{}' so existing campaigns keep working with empty settings (UI falls back to defaults).
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;
