-- Flag to track when AI analysis was incomplete (e.g. all models returned 429)
ALTER TABLE lg_options ADD COLUMN IF NOT EXISTS ai_incomplete boolean DEFAULT false;
ALTER TABLE sol_reports ADD COLUMN IF NOT EXISTS ai_incomplete boolean DEFAULT false;
