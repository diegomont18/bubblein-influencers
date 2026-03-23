-- Migration 017: Add credits column to user_roles
-- credits = -1 means infinite (for admins), default 3 for new users (trial)

ALTER TABLE public.user_roles ADD COLUMN credits integer NOT NULL DEFAULT 3;

-- Set existing admins to infinite credits
UPDATE public.user_roles SET credits = -1 WHERE role = 'admin';
