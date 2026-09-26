-- DartArena: puljer + turneringskamper
-- Kjør hele filen i Supabase SQL Editor én gang.

create table if not exists public.tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_no integer not null check (group_no > 0),
  best_of integer not null default 5 check (best_of in (3,5,7,9)),
  advance_mode text not null default 'all',
  advance_count integer,
  created_at timestamptz not null default now(),
  unique(tournament_id, group_no)
);

create table if not exists public.tournament_group_players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_id uuid not null references public.tournament_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seed_no integer not null,
  created_at timestamptz not null default now(),
  unique(tournament_id, user_id),
  unique(group_id, seed_no)
);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  stage text not null check (stage in ('group','cup')),
  group_id uuid references public.tournament_groups(id) on delete cascade,
  round_no integer not null default 1,
  match_no integer not null,
  player1_id uuid references auth.users(id) on delete set null,
  player2_id uuid references auth.users(id) on delete set null,
  best_of integer not null check (best_of in (3,5,7,9)),
  player1_legs integer,
  player2_legs integer,
  winner_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','live','finished','wo')),
  is_wo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tournament_id, stage, group_id, match_no)
);

alter table public.tournament_groups enable row level security;
alter table public.tournament_group_players enable row level security;
alter table public.tournament_matches enable row level security;

-- Alle innloggede kan lese turneringsdata. Dette trengs senere for spectators/live-visning.
drop policy if exists "tournament groups readable" on public.tournament_groups;
create policy "tournament groups readable" on public.tournament_groups for select to authenticated using (true);
drop policy if exists "tournament group players readable" on public.tournament_group_players;
create policy "tournament group players readable" on public.tournament_group_players for select to authenticated using (true);
drop policy if exists "tournament matches readable" on public.tournament_matches;
create policy "tournament matches readable" on public.tournament_matches for select to authenticated using (true);

-- Bare turneringsleder kan opprette/endre/slette oppsett og kamper.
drop policy if exists "owner manages tournament groups" on public.tournament_groups;
create policy "owner manages tournament groups" on public.tournament_groups for all to authenticated using (exists(select 1 from public.tournaments t where t.id=tournament_id and t.owner_id=auth.uid())) with check (exists(select 1 from public.tournaments t where t.id=tournament_id and t.owner_id=auth.uid()));
drop policy if exists "owner manages tournament group players" on public.tournament_group_players;
create policy "owner manages tournament group players" on public.tournament_group_players for all to authenticated using (exists(select 1 from public.tournaments t where t.id=tournament_id and t.owner_id=auth.uid())) with check (exists(select 1 from public.tournaments t where t.id=tournament_id and t.owner_id=auth.uid()));
drop policy if exists "owner manages tournament matches" on public.tournament_matches;
create policy "owner manages tournament matches" on public.tournament_matches for all to authenticated using (exists(select 1 from public.tournaments t where t.id=tournament_id and t.owner_id=auth.uid())) with check (exists(select 1 from public.tournaments t where t.id=tournament_id and t.owner_id=auth.uid()));

create index if not exists tournament_groups_tid_idx on public.tournament_groups(tournament_id);
create index if not exists tournament_group_players_tid_idx on public.tournament_group_players(tournament_id);
create index if not exists tournament_matches_tid_idx on public.tournament_matches(tournament_id);
create index if not exists tournament_matches_group_idx on public.tournament_matches(group_id);
