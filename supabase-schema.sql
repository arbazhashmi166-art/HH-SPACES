create table if not exists public.hh_spaces_app_state (
  id text primary key default 'main',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hh_spaces_app_state enable row level security;

drop policy if exists "hh spaces public read" on public.hh_spaces_app_state;
drop policy if exists "hh spaces public insert" on public.hh_spaces_app_state;
drop policy if exists "hh spaces public update" on public.hh_spaces_app_state;

create policy "hh spaces public read"
on public.hh_spaces_app_state
for select
to anon
using (id = 'main');

create policy "hh spaces public insert"
on public.hh_spaces_app_state
for insert
to anon
with check (id = 'main');

create policy "hh spaces public update"
on public.hh_spaces_app_state
for update
to anon
using (id = 'main')
with check (id = 'main');

grant select, insert, update on public.hh_spaces_app_state to anon;
