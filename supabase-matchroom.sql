-- DartArena match room migration
-- Kjor denne EN gang i Supabase SQL Editor.

alter table public.matches
  add column if not exists player1_score integer not null default 501,
  add column if not exists player2_score integer not null default 501,
  add column if not exists turn_player_id uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

-- Spillere kan opprette en kamp de selv deltar i.
create policy "Players can create matches"
on public.matches
for insert
to authenticated
with check (auth.uid() = player1_id or auth.uid() = player2_id);

-- Begge spillere kan lese profiler de trenger i kamprommet (finnes normalt allerede).
-- Realtime for matches. Ignorer duplicate_object hvis tabellen allerede er lagt til manuelt.
do $$
begin
  alter publication supabase_realtime add table public.matches;
exception
  when duplicate_object then null;
end $$;
