-- DartArena: tournament match play flow
-- Run once in Supabase SQL Editor.
--
-- Design:
--  * Players can start only a tournament match they participate in.
--  * Live scoring happens in public.matches using the existing match room.
--  * The tournament result is synced back only after the live match is finished.
--  * Tournament leader does NOT get direct UPDATE access to live matches.
--  * Finished tournament results can be corrected only through the constrained RPC below.

alter table public.tournament_matches
  add column if not exists live_match_id uuid references public.matches(id) on delete set null;

create unique index if not exists tournament_matches_live_match_uidx
  on public.tournament_matches(live_match_id)
  where live_match_id is not null;

-- Replace the earlier broad owner ALL policy for tournament_matches.
drop policy if exists "owner manages tournament matches" on public.tournament_matches;
drop policy if exists "owner inserts tournament matches" on public.tournament_matches;
drop policy if exists "owner deletes pending tournament matches" on public.tournament_matches;

create policy "owner inserts tournament matches"
on public.tournament_matches
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tournaments t
    where t.id = tournament_id
      and t.owner_id = auth.uid()
  )
);

create policy "owner deletes pending tournament matches"
on public.tournament_matches
for delete
to authenticated
using (
  status = 'pending'
  and exists (
    select 1
    from public.tournaments t
    where t.id = tournament_id
      and t.owner_id = auth.uid()
  )
);

-- Starter can be chosen in the waiting room. NULL means random.
drop function if exists public.start_tournament_match(uuid);
drop function if exists public.start_tournament_match(uuid, uuid);

create function public.start_tournament_match(
  p_tournament_match_id uuid,
  p_starter_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tm public.tournament_matches%rowtype;
  v_live_match_id uuid;
  v_starter uuid;
begin
  select *
    into tm
    from public.tournament_matches
   where id = p_tournament_match_id
   for update;

  if not found then
    raise exception 'Tournament match not found';
  end if;

  if auth.uid() is null
     or (auth.uid() is distinct from tm.player1_id
         and auth.uid() is distinct from tm.player2_id) then
    raise exception 'Not a player in this tournament match';
  end if;

  if tm.status = 'live' and tm.live_match_id is not null then
    return tm.live_match_id;
  end if;

  if tm.status <> 'pending' then
    raise exception 'Tournament match is not pending';
  end if;

  if tm.player1_id is null or tm.player2_id is null then
    raise exception 'Tournament match is missing a player';
  end if;

  if p_starter_id is null then
    v_starter := case when random() < 0.5 then tm.player1_id else tm.player2_id end;
  elsif p_starter_id = tm.player1_id or p_starter_id = tm.player2_id then
    v_starter := p_starter_id;
  else
    raise exception 'Starter must be one of the players in this tournament match';
  end if;

  insert into public.matches (
    player1_id,
    player2_id,
    game,
    legs,
    status,
    turn_player_id,
    player1_score,
    player2_score,
    match_mode,
    best_of_sets,
    player1_sets,
    player2_sets,
    match_starter_id,
    current_set,
    current_leg
  ) values (
    tm.player1_id,
    tm.player2_id,
    501,
    tm.best_of,
    'playing',
    v_starter,
    501,
    501,
    'legs',
    1,
    0,
    0,
    v_starter,
    1,
    1
  )
  returning id into v_live_match_id;

  update public.tournament_matches
     set status = 'live',
         live_match_id = v_live_match_id,
         updated_at = now()
   where id = tm.id;

  update public.profiles
     set status = 'in_game',
         last_seen = now()
   where id in (tm.player1_id, tm.player2_id);

  return v_live_match_id;
end;
$$;

revoke all on function public.start_tournament_match(uuid, uuid) from public;
grant execute on function public.start_tournament_match(uuid, uuid) to authenticated;

create or replace function public.finish_tournament_match(
  p_tournament_match_id uuid,
  p_live_match_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tm public.tournament_matches%rowtype;
  lm public.matches%rowtype;
begin
  select *
    into tm
    from public.tournament_matches
   where id = p_tournament_match_id
   for update;

  if not found then
    raise exception 'Tournament match not found';
  end if;

  if auth.uid() is null
     or (auth.uid() is distinct from tm.player1_id
         and auth.uid() is distinct from tm.player2_id) then
    raise exception 'Not a player in this tournament match';
  end if;

  if tm.live_match_id is distinct from p_live_match_id then
    raise exception 'Live match does not belong to this tournament match';
  end if;

  select *
    into lm
    from public.matches
   where id = p_live_match_id;

  if not found or lm.status <> 'finished' then
    raise exception 'Live match is not finished';
  end if;

  if lm.player1_id is distinct from tm.player1_id
     or lm.player2_id is distinct from tm.player2_id then
    raise exception 'Player mismatch';
  end if;

  update public.tournament_matches
     set player1_legs = lm.player1_legs,
         player2_legs = lm.player2_legs,
         winner_id = lm.winner_id,
         status = 'finished',
         updated_at = now()
   where id = tm.id;
end;
$$;

revoke all on function public.finish_tournament_match(uuid, uuid) from public;
grant execute on function public.finish_tournament_match(uuid, uuid) to authenticated;

create or replace function public.correct_finished_tournament_result(
  p_tournament_match_id uuid,
  p_player1_legs integer,
  p_player2_legs integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tm public.tournament_matches%rowtype;
  v_owner uuid;
  v_needed integer;
  v_winner uuid;
begin
  select *
    into tm
    from public.tournament_matches
   where id = p_tournament_match_id
   for update;

  if not found then
    raise exception 'Tournament match not found';
  end if;

  select owner_id
    into v_owner
    from public.tournaments
   where id = tm.tournament_id;

  if auth.uid() is null or auth.uid() is distinct from v_owner then
    raise exception 'Only the tournament leader can correct a finished result';
  end if;

  if tm.status not in ('finished', 'wo') then
    raise exception 'Only finished results can be corrected';
  end if;

  if p_player1_legs < 0 or p_player2_legs < 0 then
    raise exception 'Leg scores cannot be negative';
  end if;

  v_needed := (tm.best_of / 2) + 1;

  if p_player1_legs = v_needed and p_player2_legs < v_needed then
    v_winner := tm.player1_id;
  elsif p_player2_legs = v_needed and p_player1_legs < v_needed then
    v_winner := tm.player2_id;
  else
    raise exception 'Result must have exactly one winner at % legs', v_needed;
  end if;

  update public.tournament_matches
     set player1_legs = p_player1_legs,
         player2_legs = p_player2_legs,
         winner_id = v_winner,
         status = 'finished',
         is_wo = false,
         updated_at = now()
   where id = tm.id;
end;
$$;

revoke all on function public.correct_finished_tournament_result(uuid, integer, integer) from public;
grant execute on function public.correct_finished_tournament_result(uuid, integer, integer) to authenticated;
