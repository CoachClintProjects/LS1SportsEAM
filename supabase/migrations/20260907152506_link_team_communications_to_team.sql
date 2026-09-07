alter table public.communication_threads add column if not exists team_id uuid references public.teams(id) on delete cascade;
create index if not exists communication_threads_team_idx on public.communication_threads(team_id,status);
