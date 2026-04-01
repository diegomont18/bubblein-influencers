-- Add status tracking for background function search processing
ALTER TABLE casting_lists ADD COLUMN status text NOT NULL DEFAULT 'complete';
ALTER TABLE casting_lists ADD COLUMN error_message text;
