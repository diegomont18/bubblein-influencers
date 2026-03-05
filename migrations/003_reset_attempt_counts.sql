-- Reset attempt_count for all queued profiles so they get fresh retries
-- after adding premium=true to ScrapingDog API calls.
UPDATE enrichment_jobs
SET attempt_count = 0
WHERE status = 'queued';
