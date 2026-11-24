begin;
CREATE OR REPLACE FUNCTION public.correct_x01_throw(p_throw_id bigint, p_score integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid:=auth.uid();
  t public.match_throws%rowtype;
  m public.matches%rowtype;
  v_old_remaining integer;
  v_new_remaining integer;
  v_delta integer;
  v_rank integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.x01_valid_visit_score(p_score) then raise exception 'Invalid three-dart score'; end if;

  select * into t from public.match_throws where id=p_throw_id for update;
  if not found then raise exception 'Throw not found'; end if;
  if t.player_id is distinct from v_uid then raise exception 'You can only correct your own throw'; end if;
  if t.is_checkout then raise exception 'Checkout throws use checkout correction'; end if;

  select * into m from public.matches where id=t.match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if coalesce(m.game_variant,'x01') <> 'x01' then raise exception 'This is not an X01 match'; end if;
  if m.status <> 'playing' then raise exception 'Only an active match can be corrected'; end if;
  if coalesce(m.current_set,1)<>t.set_no or coalesce(m.current_leg,1)<>t.leg_no then raise exception 'Throw is not in the active leg'; end if;

  select rnk into v_rank from (
    select id,row_number() over(order by created_at desc,id desc) as rnk
    from public.match_throws
    where match_id=t.match_id and player_id=v_uid and set_no=t.set_no and leg_no=t.leg_no
  ) q where id=t.id;
  if coalesce(v_rank,999)>3 then raise exception 'Only your three latest throws can be corrected'; end if;

  v_old_remaining := case when v_uid=m.player1_id then m.player1_score else m.player2_score end;
  v_delta := p_score-t.score;
  v_new_remaining := v_old_remaining-v_delta;
  if v_new_remaining=0 then raise exception 'Use checkout correction for a checkout'; end if;
  if v_new_remaining<2 then raise exception 'Correction would create an invalid remaining score'; end if;

  update public.match_throws set score=p_score,darts_used=3,is_checkout=false,updated_at=now() where id=t.id;

  if v_uid=m.player1_id then
    update public.matches set player1_score=v_new_remaining,updated_at=now() where id=m.id returning * into m;
  elsif v_uid=m.player2_id then
    update public.matches set player2_score=v_new_remaining,updated_at=now() where id=m.id returning * into m;
  else
    raise exception 'Not a player in this match';
  end if;

  return to_jsonb(m);
end;
$function$;

CREATE OR REPLACE FUNCTION public.correct_throw_to_checkout(p_throw_id bigint, p_score integer, p_darts integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  select *
  into t
  from public.match_throws
  where id = p_throw_id
  for update;

  if not found then
    raise exception 'Throw not found';
  end if;

  if v_me is null or t.player_id is distinct from v_me then
    raise exception 'You can only correct your own throw';
  end if;

  if t.is_checkout then
    raise exception 'Throw is already a checkout';
  end if;

  if p_score < 0 or p_score > 180 then
    raise exception 'Score must be 0-180';
  end if;

  if p_darts not between 1 and 3 then
    raise exception 'Darts must be 1, 2 or 3';
  end if;

  select *
  into m
  from public.matches
  where id = t.match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if m.status <> 'playing' then
    raise exception 'Only the active leg can be corrected';
  end if;

  if coalesce(m.current_set, 1) <> t.set_no
     or coalesce(m.current_leg, 1) <> t.leg_no
  then
    raise exception 'Throw is not in the active leg';
  end if;

  if exists(
    select 1
    from public.match_throws x
    where x.match_id = t.match_id
      and x.set_no = t.set_no
      and x.leg_no = t.leg_no
      and (
        x.created_at > t.created_at
        or (
          x.created_at = t.created_at
          and x.id > t.id
        )
      )
  )
  then
    raise exception
      'There are later throws in this leg. Correct the checkout before the next throw is registered';
  end if;

  if v_me = m.player1_id then
    v_remaining := m.player1_score;
    v_new_legs := coalesce(m.player1_legs, 0) + 1;
  elsif v_me = m.player2_id then
    v_remaining := m.player2_score;
    v_new_legs := coalesce(m.player2_legs, 0) + 1;
  else
    raise exception 'Not a player in this match';
  end if;

  v_new_remaining :=
    v_remaining - (p_score - t.score);

  if v_new_remaining <> 0 then
    raise exception 'Correction does not produce a checkout';
  end if;

  update public.match_throws
  set
    score = p_score,
    darts_used = p_darts,
    is_checkout = true,
    updated_at = now()
  where id = t.id;

  v_legs_needed := (m.legs / 2) + 1;
  v_base := coalesce(m.match_starter_id, m.turn_player_id);

  if coalesce(m.match_mode, 'legs') <> 'sets' then

    if v_new_legs >= v_legs_needed then

      if v_me = m.player1_id then
        update public.matches
        set
          player1_legs = v_new_legs,
          player1_score = 0,
          status = 'finished',
          winner_id = v_me,
          finished_at = now(),
          updated_at = now()
        where id = m.id
        returning * into m;
      else
        update public.matches
        set
          player2_legs = v_new_legs,
          player2_score = 0,
          status = 'finished',
          winner_id = v_me,
          finished_at = now(),
          updated_at = now()
        where id = m.id
        returning * into m;
      end if;

    else

      v_next_leg := coalesce(m.current_leg, 1) + 1;

      v_set_starter :=
        case
          when mod(coalesce(m.current_set, 1), 2) = 1
            then v_base
          else
            case
              when v_base = m.player1_id
                then m.player2_id
              else m.player1_id
            end
        end;

      v_next_starter :=
        case
          when mod(v_next_leg, 2) = 1
            then v_set_starter
          else
            case
              when v_set_starter = m.player1_id
                then m.player2_id
              else m.player1_id
            end
        end;

      if v_me = m.player1_id then
        update public.matches
        set
          player1_legs = v_new_legs,
          player1_score = m.game,
          player2_score = m.game,
          current_leg = v_next_leg,
          turn_player_id = v_next_starter,
          updated_at = now()
        where id = m.id
        returning * into m;
      else
        update public.matches
        set
          player2_legs = v_new_legs,
          player1_score = m.game,
          player2_score = m.game,
          current_leg = v_next_leg,
          turn_player_id = v_next_starter,
          updated_at = now()
        where id = m.id
        returning * into m;
      end if;

    end if;

  else

    if v_new_legs >= v_legs_needed then

      v_sets_needed :=
        (coalesce(m.best_of_sets, 1) / 2) + 1;

      v_new_sets :=
        case
          when v_me = m.player1_id
            then coalesce(m.player1_sets, 0) + 1
          else
            coalesce(m.player2_sets, 0) + 1
        end;

      if v_new_sets >= v_sets_needed then

        if v_me = m.player1_id then
          update public.matches
          set
            player1_legs = v_new_legs,
            player1_sets = v_new_sets,
            player1_score = 0,
            status = 'finished',
            winner_id = v_me,
            finished_at = now(),
            updated_at = now()
          where id = m.id
          returning * into m;
        else
          update public.matches
          set
            player2_legs = v_new_legs,
            player2_sets = v_new_sets,
            player2_score = 0,
            status = 'finished',
            winner_id = v_me,
            finished_at = now(),
            updated_at = now()
          where id = m.id
          returning * into m;
        end if;

      else

        v_next_set :=
          coalesce(m.current_set, 1) + 1;

        v_set_starter :=
          case
            when mod(v_next_set, 2) = 1
              then v_base
            else
              case
                when v_base = m.player1_id
                  then m.player2_id
                else m.player1_id
              end
          end;

        if v_me = m.player1_id then
          update public.matches
          set
            player1_sets = v_new_sets,
            player1_legs = 0,
            player2_legs = 0,
            player1_score = m.game,
            player2_score = m.game,
            current_set = v_next_set,
            current_leg = 1,
            turn_player_id = v_set_starter,
            updated_at = now()
          where id = m.id
          returning * into m;
        else
          update public.matches
          set
            player2_sets = v_new_sets,
            player1_legs = 0,
            player2_legs = 0,
            player1_score = m.game,
            player2_score = m.game,
            current_set = v_next_set,
            current_leg = 1,
            turn_player_id = v_set_starter,
            updated_at = now()
          where id = m.id
          returning * into m;
        end if;

      end if;

    else

      v_next_leg :=
        coalesce(m.current_leg, 1) + 1;

      v_set_starter :=
        case
          when mod(coalesce(m.current_set, 1), 2) = 1
            then v_base
          else
            case
              when v_base = m.player1_id
                then m.player2_id
              else m.player1_id
            end
        end;

      v_next_starter :=
        case
          when mod(v_next_leg, 2) = 1
            then v_set_starter
          else
            case
              when v_set_starter = m.player1_id
                then m.player2_id
              else m.player1_id
            end
        end;

      if v_me = m.player1_id then
        update public.matches
        set
          player1_legs = v_new_legs,
          player1_score = m.game,
          player2_score = m.game,
          current_leg = v_next_leg,
          turn_player_id = v_next_starter,
          updated_at = now()
        where id = m.id
        returning * into m;
      else
        update public.matches
        set
          player2_legs = v_new_legs,
          player1_score = m.game,
          player2_score = m.game,
          current_leg = v_next_leg,
          turn_player_id = v_next_starter,
          updated_at = now()
        where id = m.id
        returning * into m;
      end if;

    end if;

  end if;

  return to_jsonb(m);
end;
$function$;

CREATE OR REPLACE FUNCTION public.undo_sixty_one_last(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_match public.matches%rowtype;
  v_state public.sixty_one_match_state%rowtype;
  s jsonb;
  v_latest bigint;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.game_variant<>'sixty_one' then raise exception 'This is not a 61 match'; end if;
  if v_uid not in (v_match.player1_id,v_match.player2_id) then raise exception 'You are not a player in this match'; end if;
  select * into v_state from public.sixty_one_match_state where match_id=p_match_id for update;
  if v_state.undo_snapshot is null or v_state.undo_visit_id is null or v_state.undo_player_id is distinct from v_uid then raise exception 'Nothing to undo'; end if;
  select max(id) into v_latest from public.sixty_one_visits where match_id=p_match_id;
  if v_latest is distinct from v_state.undo_visit_id then raise exception 'Only the latest attempt can be undone'; end if;
  s:=v_state.undo_snapshot;

  delete from public.sixty_one_visits where id=v_state.undo_visit_id;
  update public.matches set
    player1_score=(s->>'match_player1_score')::integer,
    player2_score=(s->>'match_player2_score')::integer,
    player1_legs=(s->>'match_player1_legs')::integer,
    player2_legs=(s->>'match_player2_legs')::integer,
    status=s->>'match_status',
    winner_id=nullif(s->>'match_winner_id','')::uuid,
    finished_at=nullif(s->>'match_finished_at','')::timestamptz,
    turn_player_id=nullif(s->>'match_turn_player_id','')::uuid,
    current_leg=(s->>'match_current_leg')::integer,
    match_starter_id=nullif(s->>'match_starter_id','')::uuid,
    updated_at=now()
  where id=p_match_id;
  update public.sixty_one_match_state set
    player1_target=(s->>'state_player1_target')::integer,
    player2_target=(s->>'state_player2_target')::integer,
    player1_attempts=(s->>'state_player1_attempts')::integer,
    player2_attempts=(s->>'state_player2_attempts')::integer,
    leg_started_at=(s->>'state_leg_started_at')::timestamptz,
    game_started_at=nullif(s->>'state_game_started_at','')::timestamptz,
    leg_duration_seconds=(s->>'state_leg_duration_seconds')::integer,
    player1_high_checkout=coalesce((s->>'state_player1_high_checkout')::integer,0),
    player2_high_checkout=coalesce((s->>'state_player2_high_checkout')::integer,0),
    sudden_death=(s->>'state_sudden_death')::boolean,
    sudden_death_first_player_id=nullif(s->>'state_sudden_death_first_player_id','')::uuid,
    sudden_death_first_result=nullif(s->>'state_sudden_death_first_result',''),
    undo_snapshot=null,undo_visit_id=null,undo_player_id=null,updated_at=now()
  where match_id=p_match_id;
  return jsonb_build_object('undone',true);
end $function$;
revoke all on function public.correct_x01_throw(bigint,integer),public.correct_throw_to_checkout(bigint,integer,integer),public.undo_sixty_one_last(uuid) from public,anon;
grant execute on function public.correct_x01_throw(bigint,integer),public.correct_throw_to_checkout(bigint,integer,integer),public.undo_sixty_one_last(uuid) to authenticated,service_role;
commit;
