-- Migration 026: Increase default credits from 3 to 5 for new users
ALTER TABLE public.user_roles ALTER COLUMN credits SET DEFAULT 5;
