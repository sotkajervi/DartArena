-- DartArena tournament foundation v1
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  tournament_type text not null check (tournament_type in ('groups_cup','cup')),
  starts_at timestamptz not null,
  status text not null default 'registration' check (status in ('registration','groups_setup','groups','cup_setup','cup','finished','cancelled')),
  registration_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_members (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'participant' check (role in ('admin','participant')),
  joined_at timestamptz not null default now(),
  primary key (tournament_id,user_id)
);

create index if not exists tournaments_starts_idx on public.tournaments(starts_at);
create index if not exists tournament_members_user_idx on public.tournament_members(user_id);

alter table public.tournaments enable row level security;
alter table public.tournament_members enable row level security;

drop policy if exists "signed in users read tournaments" on public.tournaments;
create policy "signed in users read tournaments" on public.tournaments for select to authenticated using (true);

drop policy if exists "users create owned tournaments" on public.tournaments;
create policy "users create owned tournaments" on public.tournaments for insert to authenticated with check (owner_id=auth.uid());

drop policy if exists "owner updates tournament" on public.tournaments;
create policy "owner updates tournament" on public.tournaments for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());

drop policy if exists "signed in users read tournament members" on public.tournament_members;
create policy "signed in users read tournament members" on public.tournament_members for select to authenticated using (true);

drop policy if exists "join open tournament" on public.tournament_members;
create policy "join open tournament" on public.tournament_members for insert to authenticated with check (
  user_id=auth.uid() and role='participant' and exists (
    select 1 from public.tournaments t where t.id=tournament_id and t.registration_open=true and t.status='registration'
  )
);

drop policy if exists "leave open tournament" on public.tournament_members;
create policy "leave open tournament" on public.tournament_members for delete to authenticated using (
  user_id=auth.uid() and role='participant' and exists (
    select 1 from public.tournaments t where t.id=tournament_id and t.registration_open=true and t.status='registration'
  )
);

-- Owner is represented by tournaments.owner_id. Admin membership can be added later by the owner.

do $$ begin
  alter publication supabase_realtime add table public.tournaments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tournament_members;
exception when duplicate_object then null; end $$;