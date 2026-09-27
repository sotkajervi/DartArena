-- DartArena match fixes 2026-09-27
-- Run once in Supabase SQL Editor.
-- Fixes:
-- 1) tournament match cancellation/reset
-- 2) atomic checkout: throw log + leg/match advancement in one transaction
-- 3) correcting a previously registered throw into a checkout

create or replace function public.cancel_tournament_match(
  p_tournament_match_id uuid,
  p_live_match_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tm public.tournament_matches%rowtype;
begin
  select * into tm
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

  if tm.status <> 'live' or tm.live_match_id is distinct from p_live_match_id then
    raise exception 'Tournament match is not the active live match';
  end if;

  update public.matches
     set status = 'cancelled',
         finished_at = now(),
         updated_at = now()
   where id = p_live_match_id
     and status = 'playing';

  update public.tournament_matches
     set status = 'pending',
         live_match_id = null,
         player1_legs = 0,
         player2_legs = 0,
         winner_id = null,
         is_wo = false,
         updated_at = now()
   where id = tm.id;

  update public.profiles
     set status = 'unavailable',
         last_seen = now()
   where id in (tm.player1_id, tm.player2_id);

  return tm.tournament_id;
end;
$$;

revoke all on function public.cancel_tournament_match(uuid, uuid) from public;
grant execute on function public.cancel_tournament_match(uuid, uuid) to authenticated;

create or replace function public.submit_match_checkout(
  p_match_id uuid,
  p_score integer,
  p_darts integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_me uuid := auth.uid();
  v_remaining integer;
  v_new_legs integer;
  v_legs_needed integer;
  v_new_sets integer;
  v_sets_needed integer;
  v_visit integer;
  v_next_leg integer;
  v_next_set integer;
  v_base uuid;
  v_set_starter uuid;
  v_next_starter uuid;
begin
  select * into m
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'Match not found'; end if;
  if v_me is null or (v_me is distinct from m.player1_id and v_me is distinct from m.player2_id) then
    raise exception 'Not a player in this match';
  end if;
  if m.status <> 'playing' then raise exception 'Match is not active'; end if;
  if m.turn_player_id is distinct from v_me then raise exception 'It is not your turn'; end if;
  if p_score < 2 or p_score > 170 then raise exception 'Invalid checkout score'; end if;
  if p_darts not between 1 and 3 then raise exception 'Darts must be 1, 2 or 3'; end if;

  if v_me = m.player1_id then
    v_remaining := m.player1_score;
    v_new_legs := coalesce(m.player1_legs,0) + 1;
  else
    v_remaining := m.player2_score;
    v_new_legs := coalesce(m.player2_legs,0) + 1;
  end if;

  if p_score <> v_remaining then
    raise exception 'Checkout score does not match remaining score';
  end if;

  select coalesce(max(visit_no),0)+1 into v_visit
  from public.match_throws
  where match_id = m.id
    and player_id = v_me
    and set_no = coalesce(m.current_set,1)
    and leg_no = coalesce(m.current_leg,1);

  insert into public.match_throws(match_id,player_id,set_no,leg_no,visit_no,score,darts_used,is_checkout)
  values(m.id,v_me,coalesce(m.current_set,1),coalesce(m.current_leg,1),v_visit,p_score,p_darts,true);

  v_legs_needed := (m.legs / 2) + 1;
  v_base := coalesce(m.match_starter_id,m.turn_player_id);

  if coalesce(m.match_mode,'legs') <> 'sets' then
    if v_new_legs >= v_legs_needed then
      if v_me = m.player1_id then
        update public.matches set player1_legs=v_new_legs,player1_score=0,status='finished',winner_id=v_me,finished_at=now(),updated_at=now() where id=m.id returning * into m;
      else
        update public.matches set player2_legs=v_new_legs,player2_score=0,status='finished',winner_id=v_me,finished_at=now(),updated_at=now() where id=m.id returning * into m;
      end if;
    else
      v_next_leg := coalesce(m.current_leg,1)+1;
      v_set_starter := case when mod(coalesce(m.current_set,1),2)=1 then v_base else case when v_base=m.player1_id then m.player2_id else m.player1_id end end;
      v_next_starter := case when mod(v_next_leg,2)=1 then v_set_starter else case when v_set_starter=m.player1_id then m.player2_id else m.player1_id end end;
      if v_me = m.player1_id then
        update public.matches set player1_legs=v_new_legs,player1_score=m.game,player2_score=m.game,current_leg=v_next_leg,turn_player_id=v_next_starter,updated_at=now() where id=m.id returning * into m;
      else
        update public.matches set player2_legs=v_new_legs,player1_score=m.game,player2_score=m.game,current_leg=v_next_leg,turn_player_id=v_next_starter,updated_at=now() where id=m.id returning * into m;
      end if;
    end if;
  else
    if v_new_legs >= v_legs_needed then
      v_sets_needed := (coalesce(m.best_of_sets,1) / 2) + 1;
      v_new_sets := case when v_me=m.player1_id then coalesce(m.player1_sets,0)+1 else coalesce(m.player2_sets,0)+1 end;
      if v_new_sets >= v_sets_needed then
        if v_me = m.player1_id then
          update public.matches set player1_legs=v_new_legs,player1_sets=v_new_sets,player1_score=0,status='finished',winner_id=v_me,finished_at=now(),updated_at=now() where id=m.id returning * into m;
        else
          update public.matches set player2_legs=v_new_legs,player2_sets=v_new_sets,player2_score=0,status='finished',winner_id=v_me,finished_at=now(),updated_at=now() where id=m.id returning * into m;
        end if;
      else
        v_next_set := coalesce(m.current_set,1)+1;
        v_set_starter := case when mod(v_next_set,2)=1 then v_base else case when v_base=m.player1_id then m.player2_id else m.player1_id end end;
        if v_me = m.player1_id then
          update public.matches set player1_sets=v_new_sets,player1_legs=0,player2_legs=0,player1_score=m.game,player2_score=m.game,current_set=v_next_set,current_leg=1,turn_player_id=v_set_starter,updated_at=now() where id=m.id returning * into m;
        else
          update public.matches set player2_sets=v_new_sets,player1_legs=0,player2_legs=0,player1_score=m.game,player2_score=m.game,current_set=v_next_set,current_leg=1,turn_player_id=v_set_starter,updated_at=now() where id=m.id returning * into m;
        end if;
      end if;
    else
      v_next_leg := coalesce(m.current_leg,1)+1;
      v_set_starter := case when mod(coalesce(m.current_set,1),2)=1 then v_base else case when v_base=m.player1_id then m.player2_id else m.player1_id end end;
      v_next_starter := case when mod(v_next_leg,2)=1 then v_set_starter else case when v_set_starter=m.player1_id then m.player2_id else m.player1_id end end;
      if v_me = m.player1_id then
        update public.matches set player1_legs=v_new_legs,player1_score=m.game,player2_score=m.game,current_leg=v_next_leg,turn_player_id=v_next_starter,updated_at=now() where id=m.id returning * into m;
      else
        update public.matches set player2_legs=v_new_legs,player1_score=m.game,player2_score=m.game,current_leg=v_next_leg,turn_player_id=v_next_starter,updated_at=now() where id=m.id returning * into m;
      end if;
    end if;
  end if;

  return to_jsonb(m);
end;
$$;

revoke all on function public.submit_match_checkout(uuid, integer, integer) from public;
grant execute on function public.submit_match_checkout(uuid, integer, integer) to authenticated;

create or replace function public.correct_throw_to_checkout(
  p_throw_id bigint,
  p_score integer,
  p_darts integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.match_throws%rowtype;
  m public.matches%rowtype;
  v_me uuid := auth.uid();
  v_remaining integer;
  v_new_remaining integer;
  v_new_legs integer;
  v_legs_needed integer;
  v_new_sets integer;
  v_sets_needed integer;
  v_next_leg integer;
  v_next_set integer;
  v_base uuid;
  v_set_starter uuid;
  v_next_starter uuid;
begin
  select * into t from public.match_throws where id=p_throw_id for update;
  if not found then raise exception 'Throw not found'; end if;
  if v_me is null or t.player_id is distinct from v_me then raise exception 'You can only correct your own throw'; end if;
  if t.is_checkout then raise exception 'Throw is already a checkout'; end if;
  if p_score < 0 or p_score > 180 then raise exception 'Score must be 0-180'; end if;
  if p_darts not between 1 and 3 then raise exception 'Darts must be 1, 2 or 3'; end if;

  select * into m from public.matches where id=t.match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if m.status <> 'playing' then raise exception 'Only the active leg can be corrected'; end if;
  if coalesce(m.current_set,1) <> t.set_no or coalesce(m.current_leg,1) <> t.leg_no then
    raise exception 'Throw is not in the active leg';
  end if;
  if exists(
    select 1 from public.match_throws x
    where x.match_id=t.match_id and x.set_no=t.set_no and x.leg_no=t.leg_no
      and (x.created_at>t.created_at or (x.created_at=t.created_at and x.id>t.id))
  ) then
    raise exception 'There are later throws in this leg. Correct the checkout before the next throw is registered';
  end if;

  if v_me=m.player1_id then
    v_remaining:=m.player1_score;
    v_new_legs:=coalesce(m.player1_legs,0)+1;
  elsif v_me=m.player2_id then
    v_remaining:=m.player2_score;
    v_new_legs:=coalesce(m.player2_legs,0)+1;
  else
    raise exception 'Not a player in this match';
  end if;

  v_new_remaining:=v_remaining-(p_score-t.score);
  if v_new_remaining<>0 then raise exception 'Correction does not produce a checkout'; end if;

  update public.match_throws set score=p_score,darts_used=p_darts,is_checkout=true,updated_at=now() where id=t.id;

  v_legs_needed:=(m.legs/2)+1;
  v_base:=coalesce(m.match_starter_id,m.turn_player_id);

  if coalesce(m.match_mode,'legs')<>'sets' then
    if v_new_legs>=v_legs_needed then
      if v_me=m.player1_id then
        update public.matches set player1_legs=v_new_legs,player1_score=0,status='finished',winner_id=v_me,finished_at=now(),updated_at=now() where id=m.id returning * into m;
      else
        update public.matches set player2_legs=v_new_legs,player2_score=0,status='finished',winner_id=v_me,finished_at=now(),updated_at=now() where id=m.id returning * into m;
      end if;
    else
      v_next_leg:=coalesce(m.current_leg,1)+1;
      v_set_starter:=case when mod(coalesce(m.current_set,1),2)=1 then v_base else case when v_base=m.player1_id then m.player2_id else m.player1_id end end;
      v_next_starter:=case when mod(v_next_leg,2)=1 then v_set_starter else case when v_set_starter=m.player1_id then m.player2_id else m.player1_id end end;
      if v_me=m.player1_id then
        update public.matches set player1_legs=v_new_legs,player1_score=m.game,player2_score=m.game,current_leg=v_next_leg,turn_player_id=v_next_starter,updated_at=now() where id=m.id returning * into m;
      else
        update public.matches set player2_legs=v_new_legs,player1_score=m.game,player2_score=m.game,current_leg=v_next_leg,turn_player_id=v_next_starter,updated_at=now() where id=m.id returning * into m;
      end if;
    end if;
  else
    if v_new_legs>=v_legs_needed then
      v_sets_needed:=(coalesce(m.best_of_sets,1)/2)+1;
      v_new_sets:=case when v_me=m.player1_id then coalesce(m.player1_sets,0)+1 else coalesce(m.player2_sets,0)+1 end;
      if v_new_sets>=v_sets_needed then
        if v_me=m.player1_id then
          update public.matches set player1_legs=v_new_legs,player1_sets=v_new_sets,player1_score=0,status='finished',winner_id=v_me,finished_at=now(),updated_at=now() where id=m.id returning * into m;
        else
          update public.matches set player2_legs=v_new_legs,player2_sets=v_new_sets,player2_score=0,status='finished',winner_id=v_me,finished_at=now(),updated_at=now() where id=m.id returning * into m;
        end if;
      else
        v_next_set:=coalesce(m.current_set,1)+1;
        v_set_starter:=case when mod(v_next_set,2)=1 then v_base else case when v_base=m.player1_id then m.player2_id else m.player1_id end end;
        if v_me=m.player1_id then
          update public.matches set player1_sets=v_new_sets,player1_legs=0,player2_legs=0,player1_score=m.game,player2_score=m.game,current_set=v_next_set,current_leg=1,turn_player_id=v_set_starter,updated_at=now() where id=m.id returning * into m;
        else
          update public.matches set player2_sets=v_new_sets,player1_legs=0,player2_legs=0,player1_score=m.game,player2_score=m.game,current_set=v_next_set,current_leg=1,turn_player_id=v_set_starter,updated_at=now() where id=m.id returning * into m;
        end if;
      end if;
    else
      v_next_leg:=coalesce(m.current_leg,1)+1;
      v_set_starter:=case when mod(coalesce(m.current_set,1),2)=1 then v_base else case when v_base=m.player1_id then m.player2_id else m.player1_id end end;
      v_next_starter:=case when mod(v_next_leg,2)=1 then v_set_starter else case when v_set_starter=m.player1_id then m.player2_id else m.player1_id end end;
      if v_me=m.player1_id then
        update public.matches set player1_legs=v_new_legs,player1_score=m.game,player2_score=m.game,current_leg=v_next_leg,turn_player_id=v_next_starter,updated_at=now() where id=m.id returning * into m;
      else
        update public.matches set player2_legs=v_new_legs,player1_score=m.game,player2_score=m.game,current_leg=v_next_leg,turn_player_id=v_next_starter,updated_at=now() where id=m.id returning * into m;
      end if;
    end if;
  end if;

  return to_jsonb(m);
end;
$$;

revoke all on function public.correct_throw_to_checkout(bigint, integer, integer) from public;
grant execute on function public.correct_throw_to_checkout(bigint, integer, integer) to authenticated;
