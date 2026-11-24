begin;
CREATE OR REPLACE FUNCTION public.cancel_tournament_match(p_tournament_match_id uuid, p_live_match_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     or (
       auth.uid() is distinct from tm.player1_id
       and auth.uid() is distinct from tm.player2_id
     )
  then
    raise exception 'Not a player in this tournament match';
  end if;

  if tm.status <> 'live'
     or tm.live_match_id is distinct from p_live_match_id
  then
    raise exception 'Tournament match is not the active live match';
  end if;

  select * into lm from public.matches where id=p_live_match_id for update;
  if not found or lm.player1_id is distinct from tm.player1_id or lm.player2_id is distinct from tm.player2_id or lm.deleted_at is not null then raise exception 'Linked match is unavailable or player mismatch';end if;
  if lm.status='finished' then raise exception 'Completed match must be synchronized, not cancelled';end if;
  if lm.status not in ('playing','cancelled') then raise exception 'Linked match cannot be reset';end if;
  -- An already cancelled room may still require fixture recovery.
  update public.matches
  set
    status = 'cancelled',
    finished_at = now(),
    updated_at = now()
  where id = p_live_match_id
    and status = 'playing';

  update public.tournament_matches
  set
    status = 'pending',
    live_match_id = null,
    player1_legs = 0,
    player2_legs = 0,
    winner_id = null,
    is_wo = false,
    updated_at = now()
  where id = tm.id;

  update public.profiles
  set
    status = 'unavailable',
    last_seen = now()
  where id in (tm.player1_id, tm.player2_id);

  return tm.tournament_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finish_tournament_match(p_tournament_match_id uuid, p_live_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
   where id = p_live_match_id for update;

  if not found or lm.status <> 'finished' or lm.deleted_at is not null then
    raise exception 'Live match is not finished';
  end if;

  if lm.player1_id is distinct from tm.player1_id
     or lm.player2_id is distinct from tm.player2_id then
    raise exception 'Player mismatch';
  end if;

  -- An old match tab must never overwrite a result already finalized or corrected.
  if tm.status='finished' then return;end if;
  if tm.status is distinct from 'live' then raise exception 'Tournament match is not live';end if;
  update public.tournament_matches
     set player1_legs = lm.player1_legs,
         player2_legs = lm.player2_legs,
         winner_id = lm.winner_id,
         status = 'finished',
         updated_at = now()
   where id = tm.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_tournament_match(p_tournament_match_id uuid, p_starter_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  tm public.tournament_matches%rowtype;
  v_live_match_id uuid;
  v_starter uuid;
  v_game integer;
  v_tournament_status text;
  v_tournament_variant text;
  v_match_game integer;
  v_match_legs integer;
  v_game_config jsonb;
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

  select
    case when tm.stage='cup' then t.cup_game else t.game end,
    t.status,
    case when tm.stage='cup' then coalesce(t.cup_game_variant,'x01') else coalesce(t.game_variant,'x01') end
  into v_game,v_tournament_status,v_tournament_variant
  from public.tournaments t
  where t.id=tm.tournament_id;

  if not found then raise exception 'Tournament not found'; end if;
  if not ((tm.stage='group' and v_tournament_status='groups') or (tm.stage='cup' and v_tournament_status='cup')) then raise exception 'Tournament match is not in its active phase'; end if;
  if v_tournament_variant not in ('x01','chicago') then raise exception 'Unsupported tournament game variant'; end if;
  if v_tournament_variant='x01' and v_game not in (170,301,501,1001) then raise exception 'Unsupported tournament game'; end if;

  if tm.status='live' and tm.live_match_id is not null then
    if exists(select 1 from public.matches m where m.id=tm.live_match_id and m.player1_id=tm.player1_id and m.player2_id=tm.player2_id and m.deleted_at is null and m.status in ('playing','finished')) then return tm.live_match_id;end if;
    raise exception 'Linked match is no longer available';
  end if;
  if tm.status<>'pending' then raise exception 'Tournament match is not pending'; end if;
  if tm.player1_id is null or tm.player2_id is null or tm.player1_id=tm.player2_id then raise exception 'Tournament match is missing a player'; end if;

  if p_starter_id is null then
    v_starter:=case when random()<0.5 then tm.player1_id else tm.player2_id end;
  elsif p_starter_id=tm.player1_id or p_starter_id=tm.player2_id then
    v_starter:=p_starter_id;
  else
    raise exception 'Starter must be one of the players in this tournament match';
  end if;

  if v_tournament_variant='chicago' then
    v_match_game:=301;
    v_match_legs:=3;
    v_game_config:=jsonb_build_object(
      'chicago',true,
      'chicago_stage',1,
      'ranked',false
    );
  else
    v_match_game:=v_game;
    v_match_legs:=tm.best_of;
    v_game_config:='{}'::jsonb;
  end if;

  insert into public.matches(
    player1_id,player2_id,game,game_variant,legs,status,turn_player_id,
    player1_score,player2_score,match_mode,best_of_sets,player1_sets,
    player2_sets,match_starter_id,current_set,current_leg,game_config
  ) values (
    tm.player1_id,tm.player2_id,v_match_game,'x01',v_match_legs,'playing',v_starter,
    v_match_game,v_match_game,'legs',1,0,0,v_starter,1,1,v_game_config
  ) returning id into v_live_match_id;

  update public.tournament_matches
  set status='live',live_match_id=v_live_match_id,updated_at=now()
  where id=tm.id;

  update public.profiles
  set status='in_game',last_seen=now()
  where id in (tm.player1_id,tm.player2_id);

  return v_live_match_id;
end;
$function$;
revoke all on function public.start_tournament_match(uuid,uuid),public.finish_tournament_match(uuid,uuid),public.cancel_tournament_match(uuid,uuid) from public,anon;
grant execute on function public.start_tournament_match(uuid,uuid),public.finish_tournament_match(uuid,uuid),public.cancel_tournament_match(uuid,uuid) to authenticated,service_role;
commit;
