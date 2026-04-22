-- Change competitors from text[] (plain names) to jsonb (objects with name + logoUrl + url).
-- Must drop default first, then change type, then set new default.
ALTER TABLE public.lg_options ALTER COLUMN competitors DROP DEFAULT;
ALTER TABLE public.lg_options ALTER COLUMN competitors TYPE jsonb USING to_jsonb(competitors);
ALTER TABLE public.lg_options ALTER COLUMN competitors SET DEFAULT '[]'::jsonb;
