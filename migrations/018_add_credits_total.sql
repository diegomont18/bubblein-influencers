-- Migration 018: Add credits_total to track total credits ever injected
-- credits_total = total credits ever added (initial trial + admin injections)
-- credits_spent = credits_total - credits (computed, not stored)

ALTER TABLE public.user_roles ADD COLUMN credits_total integer NOT NULL DEFAULT 3;

-- Sync existing users: total = current (no spending history yet)
UPDATE public.user_roles SET credits_total = credits WHERE credits >= 0;
UPDATE public.user_roles SET credits_total = -1 WHERE credits = -1;
