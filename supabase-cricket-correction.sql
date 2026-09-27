-- DartArena Cricket correction support
-- Adds corrected_at plus secure correction of the latest visit in the active leg.

begin;

alter table public.cricket_visits
  add column if not exists corrected_at timestamptz;

create or replace function public.correct_last_cricket_visit(
  p_visit_id bigint,
  p_darts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_visit public.cricket_visits%rowtype;
  v_row public.cricket_visits%rowtype;
  v_dart jsonb;
  v_target text;
  v_key text;
  v_mult integer;
  v_value integer;
  v_p1_marks jsonb := '{"20":0,"19":0,"18":0,"17":0,"16":0,"15":0,"B":0}'::jsonb;
  v_p2_marks jsonb := '{"20":0,"19":0,"18":0,"17":0,"16":0,"15":0,"B":0}'::jsonb;
  v_own_marks jsonb;
  v_opp_marks jsonb;
  v_current integer;
  v_opp integer;
  v_close integer;
  v_extra integer;
  v_points_scored integer;
  v_p1_points integer := 0;
  v_p2_points integer := 0;
  v_all_closed boolean;
  v_leg_won boolean := false;
  v_winner uuid;
  v_last_player uuid;
  v_new_legs integer;
  v_needed integer;
  v_next_starter uuid;
  v_empty_marks jsonb := '{"20":0,"19":0,"18":0,"17":0,"16":0,"15":0,"B":0}'::jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_darts is null or jsonb_typeof(p_darts) <> 'array' then raise exception 'Darts must be an array'; end if;
  if jsonb_array_length(p_darts) < 1 or jsonb_array_length(p_darts) > 3 then raise exception 'A cricket visit must contain 1 to 3 darts'; end if;

  select * into v_visit
  from public.cricket_visits
  where id = p_visit_id
  for update;
  if not found then raise exception 'Visit not found'; end if;

  select * into v_match
  from public.matches
  where id = v_visit.match_id
  for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.game_variant <> 'cricket' then raise exception 'This is not a cricket match'; end if;
  if v_match.status <> 'playing' then raise exception 'Only an active match can be corrected'; end if;
  if v_visit.player_id <> v_uid then raise exception 'You can only correct your own visit'; end if;
  if v_visit.leg_no <> v_match.current_leg then raise exception 'Only the active leg can be corrected'; end if;
  if p_visit_id <> (
    select max(cv.id) from public.cricket_visits cv
    where cv.match_id = v_match.id and cv.leg_no = v_match.current_leg
  ) then
    raise exception 'Only the latest visit in the active leg can be corrected';
  end if;

  for v_dart in select value from jsonb_array_elements(p_darts)
  loop
    v_target := upper(coalesce(v_dart->>'target',''));
    v_mult := coalesce((v_dart->>'mult')::integer, 0);
    if v_target = 'MISS' then
      if v_mult <> 0 then raise exception 'MISS must have multiplier 0'; end if;
    elsif v_target in ('20','19','18','17','16','15') then
      if v_mult not between 1 and 3 then raise exception 'Number targets must use multiplier 1, 2 or 3'; end if;
    elsif v_target in ('B','BULL') then
      if v_mult not between 1 and 2 then raise exception 'Bull must use multiplier 1 or 2'; end if;
    else
      raise exception 'Invalid cricket target';
    end if;
  end loop;

  update public.cricket_visits
  set darts = p_darts, corrected_at = now()
  where id = p_visit_id;

  for v_row in
    select * from public.cricket_visits
    where match_id = v_match.id and leg_no = v_match.current_leg
    order by id
    for update
  loop
    v_points_scored := 0;
    v_last_player := v_row.player_id;

    if v_row.player_id = v_match.player1_id then
      v_own_marks := v_p1_marks;
      v_opp_marks := v_p2_marks;
    elsif v_row.player_id = v_match.player2_id then
      v_own_marks := v_p2_marks;
      v_opp_marks := v_p1_marks;
    else
      raise exception 'Visit belongs to a player outside this match';
    end if;

    for v_dart in select value from jsonb_array_elements(v_row.darts)
    loop
      v_target := upper(coalesce(v_dart->>'target',''));
      v_mult := coalesce((v_dart->>'mult')::integer, 0);
      if v_target = 'MISS' then
        continue;
      elsif v_target in ('20','19','18','17','16','15') then
        v_key := v_target;
        v_value := v_target::integer;
      elsif v_target in ('B','BULL') then
        v_key := 'B';
        v_value := 25;
      else
        raise exception 'Invalid cricket target in visit log';
      end if;

      v_current := coalesce((v_own_marks->>v_key)::integer, 0);
      v_opp := coalesce((v_opp_marks->>v_key)::integer, 0);
      v_close := least(v_mult, greatest(3 - v_current, 0));
      v_extra := v_mult - v_close;
      v_own_marks := jsonb_set(v_own_marks, array[v_key], to_jsonb(least(3, v_current + v_mult)), true);

      if v_extra > 0 and v_opp < 3 then
        if v_row.player_id = v_match.player1_id then
          v_p1_points := v_p1_points + (v_extra * v_value);
        else
          v_p2_points := v_p2_points + (v_extra * v_value);
        end if;
        v_points_scored := v_points_scored + (v_extra * v_value);
      end if;
    end loop;

    if v_row.player_id = v_match.player1_id then
      v_p1_marks := v_own_marks;
      v_all_closed :=
        coalesce((v_p1_marks->>'20')::integer,0) >= 3 and coalesce((v_p1_marks->>'19')::integer,0) >= 3 and
        coalesce((v_p1_marks->>'18')::integer,0) >= 3 and coalesce((v_p1_marks->>'17')::integer,0) >= 3 and
        coalesce((v_p1_marks->>'16')::integer,0) >= 3 and coalesce((v_p1_marks->>'15')::integer,0) >= 3 and
        coalesce((v_p1_marks->>'B')::integer,0) >= 3;
      if v_all_closed and v_p1_points >= v_p2_points then v_leg_won := true; v_winner := v_match.player1_id; end if;
    else
      v_p2_marks := v_own_marks;
      v_all_closed :=
        coalesce((v_p2_marks->>'20')::integer,0) >= 3 and coalesce((v_p2_marks->>'19')::integer,0) >= 3 and
        coalesce((v_p2_marks->>'18')::integer,0) >= 3 and coalesce((v_p2_marks->>'17')::integer,0) >= 3 and
        coalesce((v_p2_marks->>'16')::integer,0) >= 3 and coalesce((v_p2_marks->>'15')::integer,0) >= 3 and
        coalesce((v_p2_marks->>'B')::integer,0) >= 3;
      if v_all_closed and v_p2_points >= v_p1_points then v_leg_won := true; v_winner := v_match.player2_id; end if;
    end if;

    update public.cricket_visits
    set points_scored = v_points_scored
    where id = v_row.id;
  end loop;

  if v_leg_won then
    v_needed := floor(v_match.legs::numeric / 2)::integer + 1;
    if v_winner = v_match.player1_id then v_new_legs := v_match.player1_legs + 1;
    else v_new_legs := v_match.player2_legs + 1;
    end if;

    if v_new_legs >= v_needed then
      update public.cricket_match_state
      set player1_marks = v_p1_marks, player2_marks = v_p2_marks, updated_at = now()
      where match_id = v_match.id;

      update public.matches
      set player1_score = v_p1_points,
          player2_score = v_p2_points,
          player1_legs = case when v_winner = player1_id then v_new_legs else player1_legs end,
          player2_legs = case when v_winner = player2_id then v_new_legs else player2_legs end,
          status = 'finished', winner_id = v_winner, finished_at = now(), updated_at = now()
      where id = v_match.id;
    else
      v_next_starter := case
        when coalesce(v_match.match_starter_id, v_match.player1_id) = v_match.player1_id then v_match.player2_id
        else v_match.player1_id
      end;

      update public.cricket_match_state
      set player1_marks = v_empty_marks, player2_marks = v_empty_marks, updated_at = now()
      where match_id = v_match.id;

      update public.matches
      set player1_score = 0,
          player2_score = 0,
          player1_legs = case when v_winner = player1_id then v_new_legs else player1_legs end,
          player2_legs = case when v_winner = player2_id then v_new_legs else player2_legs end,
          current_leg = v_match.current_leg + 1,
          match_starter_id = v_next_starter,
          turn_player_id = v_next_starter,
          updated_at = now()
      where id = v_match.id;
    end if;
  else
    update public.cricket_match_state
    set player1_marks = v_p1_marks, player2_marks = v_p2_marks, updated_at = now()
    where match_id = v_match.id;

    update public.matches
    set player1_score = v_p1_points,
        player2_score = v_p2_points,
        turn_player_id = case when v_last_player = player1_id then player2_id else player1_id end,
        updated_at = now()
    where id = v_match.id;
  end if;

  return jsonb_build_object('leg_won', v_leg_won, 'winner_id', v_winner, 'corrected_visit_id', p_visit_id);
end;
$$;

revoke execute on function public.correct_last_cricket_visit(bigint,jsonb) from public, anon;
grant execute on function public.correct_last_cricket_visit(bigint,jsonb) to authenticated;

commit;
