-- Add status tracking for background function leads scanning
ALTER TABLE leads_scans ADD COLUMN status text NOT NULL DEFAULT 'complete';
ALTER TABLE leads_scans ADD COLUMN error_message text;
