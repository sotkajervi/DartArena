-- DartArena tournament X01 game selection.
-- Applied to Supabase on 2026-09-30.

alter table public.tournaments
  add column if not exists game integer not null default 501;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='tournaments_game_check'
      and conrelid='public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_game_check check (game in (170,301,501,1001));
  end if;
end $$;

create or replace function public.start_tournament_match(
  p_tournament_match_id uuid,
  p_starter_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tm public.tournament_matches%rowtype;
  v_live_match_id uuid;
  v_starter uuid;
  v_game integer;
  v_tournament_status text;
begin
  select * into tm
  from public.tournament_matches
  where id=p_tournament_match_id
  for update;

  if not found then raise exception 'Tournament match not found'; end if;

  if auth.uid() is null or (
    auth.uid() is distinct from tm.player1_id
    and auth.uid() is distinct from tm.player2_id
  ) then
    raise exception 'Not a player in this tournament match';
  end if;

  select t.game,t.status into v_game,v_tournament_status
  from public.tournaments t
  where t.id=tm.tournament_id;

  if not found then raise exception 'Tournament not found'; end if;
  if v_tournament_status not in ('groups','cup') then raise exception 'Tournament is not active'; end if;
  if v_game not in (170,301,501,1001) then raise exception 'Unsupported tournament game'; end if;

  if tm.status='live' and tm.live_match_id is not null then return tm.live_match_id; end if;
  if tm.status<>'pending' then raise exception 'Tournament match is not pending'; end if;
  if tm.player1_id is null or tm.player2_id is null then raise exception 'Tournament match is missing a player'; end if;

  if p_starter_id is null then
    v_starter:=case when random()<0.5 then tm.player1_id else tm.player2_id end;
  elsif p_starter_id=tm.player1_id or p_starter_id=tm.player2_id then
    v_starter:=p_starter_id;
  else
    raise exception 'Starter must be one of the players in this tournament match';
  end if;

  insert into public.matches(
    player1_id,player2_id,game,game_variant,legs,status,turn_player_id,
    player1_score,player2_score,match_mode,best_of_sets,player1_sets,
    player2_sets,match_starter_id,current_set,current_leg
  ) values (
    tm.player1_id,tm.player2_id,v_game,'x01',tm.best_of,'playing',v_starter,
    v_game,v_game,'legs',1,0,0,v_starter,1,1
  ) returning id into v_live_match_id;

  update public.tournament_matches
  set status='live',live_match_id=v_live_match_id,updated_at=now()
  where id=tm.id;

  update public.profiles
  set status='in_game',last_seen=now()
  where id in (tm.player1_id,tm.player2_id);

  return v_live_match_id;
end;
$$;

revoke all on function public.start_tournament_match(uuid,uuid) from public,anon;
grant execute on function public.start_tournament_match(uuid,uuid) to authenticated;
