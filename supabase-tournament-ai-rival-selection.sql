-- Optional AI Rival model for a groups+cup tournament.
-- Model choice is separate from auth-backed players until bot match integration.
create table if not exists public.tournament_ai_rivals (
 tournament_id uuid primary key references public.tournaments(id) on delete cascade,
 model_player_id uuid not null references public.profiles(id) on delete restrict,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.tournament_ai_rivals enable row level security;
revoke all on public.tournament_ai_rivals from anon;
grant select,insert,delete on public.tournament_ai_rivals to authenticated;
drop policy if exists "read tournament ai rival" on public.tournament_ai_rivals;
create policy "read tournament ai rival" on public.tournament_ai_rivals for select to authenticated using (true);
drop policy if exists "owner add tournament ai rival" on public.tournament_ai_rivals;
create policy "owner add tournament ai rival" on public.tournament_ai_rivals for insert to authenticated with check (
 created_by=auth.uid() and exists (
 select 1 from public.tournaments t where t.id=tournament_id and t.owner_id=auth.uid()
 and t.status='groups_setup' and t.tournament_type='groups_cup'
 )
);
drop policy if exists "owner remove tournament ai rival" on public.tournament_ai_rivals;
create policy "owner remove tournament ai rival" on public.tournament_ai_rivals for delete to authenticated using (
 exists(select 1 from public.tournaments t where t.id=tournament_id and t.owner_id=auth.uid() and t.status='groups_setup')
);
