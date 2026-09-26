-- DartArena: tournament waiting-room starter choice + finished-match statistics
-- Run once in Supabase SQL Editor.

-- Replace the original one-argument function with a starter-aware version.
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

-- Finished tournament matches may expose their throw log for the tournament
-- statistics and finished-match statistics pages. Live match throws keep the
-- existing player-only read policy.
drop policy if exists "finished tournament throws readable" on public.match_throws;
create policy "finished tournament throws readable"
on public.match_throws
for select
to authenticated
using (
  exists (
    select 1
      from public.tournament_matches tm
     where tm.live_match_id = match_id
       and tm.status in ('finished','wo')
  )
);
