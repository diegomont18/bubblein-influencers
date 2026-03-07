-- Checker entries: stores imported rows for LinkedIn URL verification
create table if not exists public.checker_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  headline text not null default '',
  original_url text not null,
  verified_url text,
  status text not null default 'pending'
    check (status in ('pending', 'checking', 'valid', 'not_found', 'found')),
  search_results jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for filtering by status
create index if not exists idx_checker_entries_status on public.checker_entries (status);

-- Auto-update updated_at
create or replace function public.checker_entries_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_checker_entries_updated_at
  before update on public.checker_entries
  for each row execute function public.checker_entries_updated_at();
