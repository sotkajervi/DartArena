-- Candidate: correction of own last three registered rounds, active leg only.
-- The two evaluation blocks below are copied from the deployed submission RPCs.
-- Never reopen a completed leg or change the turn/leg winner.
create or replace function public.correct_half_it_visit(p_visit_id bigint,p_expected_darts jsonb,p_darts jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
 v_uid uuid:=auth.uid();
 v_match public.matches%rowtype;
 v_visit public.half_it_visits%rowtype;
 v_row public.half_it_visits%rowtype;
 v_state public.half_it_match_state%rowtype;
 v_match_id uuid; v_standard boolean; v_leg integer; v_round integer;
 v_dart jsonb; v_n integer; v_mult integer; v_value integer; v_target integer; v_idx integer; v_color text;
 v_colors text[]:=array[]::text[]; v_nonmiss integer:=0; v_total integer:=0; v_points integer:=0; v_success boolean:=false;
 v_exact_choice integer; v_before integer; v_after integer; v_latest integer; v_next integer; v_current integer;
 v_board integer[]:=array[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
begin
 if v_uid is null then raise exception 'HALF_CORRECTION_AUTH'; end if;
 if p_darts is null or jsonb_typeof(p_darts) is distinct from 'array' then raise exception 'HALF_CORRECTION_DARTS'; end if;
 if jsonb_array_length(p_darts)<>3 then raise exception 'HALF_CORRECTION_DARTS'; end if;
 for v_dart in select value from jsonb_array_elements(p_darts) loop
   if jsonb_typeof(v_dart) is distinct from 'object'
     or jsonb_typeof(v_dart->'n') is distinct from 'number'
     or jsonb_typeof(v_dart->'mult') is distinct from 'number'
     or (v_dart->>'n') !~ '^[0-9]{1,2}$' or (v_dart->>'mult') !~ '^[0-3]$'
     then raise exception 'HALF_CORRECTION_DARTS'; end if;
 end loop;
 select match_id into v_match_id from public.half_it_visits where id=p_visit_id and player_id=v_uid;
 if not found then raise exception 'HALF_CORRECTION_OWNER'; end if;
 select * into v_match from public.matches where id=v_match_id for update;
 if not found or v_match.game_variant is distinct from 'half_it' or v_match.status is distinct from 'playing'
   or (v_uid is distinct from v_match.player1_id and v_uid is distinct from v_match.player2_id)
   then raise exception 'HALF_CORRECTION_ACTIVE'; end if;
 select * into v_visit from public.half_it_visits where id=p_visit_id and player_id=v_uid and match_id=v_match_id for update;
 if not found then raise exception 'HALF_CORRECTION_OWNER'; end if;
 v_leg:=greatest(coalesce(v_match.current_leg,1),1);
 if v_visit.leg_no<>v_leg then raise exception 'HALF_CORRECTION_LEG'; end if;
 if v_visit.darts is distinct from p_expected_darts then raise exception 'HALF_CORRECTION_STALE'; end if;
 select max(round_no) into v_latest from public.half_it_visits where match_id=v_match_id and player_id=v_uid and leg_no=v_leg;
 v_round:=v_visit.round_no;
 if v_round not between 1 and 12 or v_round<v_latest-2 then raise exception 'HALF_CORRECTION_RECENT'; end if;
 v_standard:=coalesce(v_match.game_config->>'half_it_mode','dartcounter')='standard';
 v_before:=v_visit.score_before;
 -- Preserve existing exact-choice rules, including 121+ and the original
 -- three targets for this active leg. Never generate replacement targets.
 if v_standard then
  v_target:=case v_round when 1 then 13 when 2 then 14 when 4 then 15 when 5 then 16 when 7 then 17 when 8 then 18 when 10 then 19 when 11 then 20 else null end;

  for v_dart in select value from jsonb_array_elements(p_darts)
  loop
    v_n:=coalesce((v_dart->>'n')::integer,0);
    v_mult:=coalesce((v_dart->>'mult')::integer,0);
    if v_n=0 then
      if v_mult<>0 then raise exception 'MISS must use multiplier 0'; end if;
      continue;
    elsif v_n between 1 and 20 then
      if v_mult not between 1 and 3 then raise exception 'Number darts must use S, D or T'; end if;
      v_value:=v_n*v_mult;
    elsif v_n=25 then
      if v_mult not between 1 and 2 then raise exception 'Bull must be 25 or 50'; end if;
      v_value:=25*v_mult;
    else
      raise exception 'Invalid dart target';
    end if;

    v_nonmiss:=v_nonmiss+1;
    v_total:=v_total+v_value;

    if v_round in (1,2,4,5,7,8,10,11) and v_n=v_target then
      v_points:=v_points+v_value;
    elsif v_round=3 and v_mult=2 then
      v_points:=v_points+v_value;
    elsif v_round=6 and v_mult=3 then
      v_points:=v_points+v_value;
    elsif v_round=12 and v_n=25 then
      v_points:=v_points+v_value;
    end if;
  end loop;

  if v_round=9 then
    v_success:=v_nonmiss=3 and v_total=41;
    v_points:=case when v_success then 41 else 0 end;
  else
    v_success:=v_points>0;
  end if;


   v_exact_choice:=case when v_round=9 then 41 else null end;
 else
   if v_round=8 then
     select * into v_state from public.half_it_match_state where match_id=v_match_id for update;
     if not found then raise exception 'HALF_CORRECTION_EXACT'; end if;
     v_exact_choice:=coalesce(nullif(p_darts->0->>'exact_target','')::integer,v_visit.exact_target);
     if v_exact_choice is null or not coalesce(v_exact_choice=any(v_state.exact_options),false) then raise exception 'HALF_CORRECTION_EXACT'; end if;
   end if;
  for v_dart in select value from jsonb_array_elements(p_darts) loop
    v_n:=coalesce((v_dart->>'n')::integer,0); v_mult:=coalesce((v_dart->>'mult')::integer,0);
    if v_n=0 then
      if v_mult<>0 then raise exception 'MISS must use multiplier 0'; end if;
      v_colors:=array_append(v_colors,'miss'); continue;
    elsif v_n between 1 and 20 then
      if v_mult not between 1 and 3 then raise exception 'Number darts must use S, D or T'; end if;
      v_value:=v_n*v_mult; v_idx:=array_position(v_board,v_n);
      if v_mult=1 then v_color:=case when (v_idx%2)=1 then 'black' else 'white' end; else v_color:=case when (v_idx%2)=1 then 'red' else 'green' end; end if;
    elsif v_n=25 then
      if v_mult not between 1 and 2 then raise exception 'Bull must be 25 or 50'; end if;
      v_value:=25*v_mult; v_color:=case when v_mult=1 then 'green' else 'red' end;
    else raise exception 'Invalid dart target'; end if;
    v_nonmiss:=v_nonmiss+1; v_total:=v_total+v_value; v_colors:=array_append(v_colors,v_color);
    if v_round=1 and v_n=20 then v_points:=v_points+v_value;
    elsif v_round=2 and v_mult=2 then v_points:=v_points+v_value;
    elsif v_round=3 and v_n=19 then v_points:=v_points+v_value;
    elsif v_round=4 and v_mult=3 then v_points:=v_points+v_value;
    elsif v_round=5 and v_n=18 then v_points:=v_points+v_value;
    elsif v_round=7 and v_n=17 then v_points:=v_points+v_value;
    elsif v_round=9 and v_n=16 then v_points:=v_points+v_value;
    elsif v_round=11 and v_n=15 then v_points:=v_points+v_value;
    elsif v_round=12 and v_n=25 then v_points:=v_points+v_value; end if;
  end loop;
  if v_round in (1,2,3,4,5,7,9,11,12) then v_success:=v_points>0;
  elsif v_round=6 then v_success:=v_nonmiss=3 and v_colors[1]<>v_colors[2] and v_colors[1]<>v_colors[3] and v_colors[2]<>v_colors[3]; if v_success then v_points:=v_total; else v_points:=0; end if;
  elsif v_round=8 then v_success:=case when v_exact_choice=121 then v_total>=121 else v_total=v_exact_choice end; if v_success then v_points:=v_total; else v_points:=0; end if;
  elsif v_round=10 then v_success:=v_nonmiss=3 and v_colors[1]=v_colors[2] and v_colors[2]=v_colors[3]; if v_success then v_points:=v_total; else v_points:=0; end if; end if;

 end if;
 -- Canonicalize the payload; the exact target is stored once, on dart 1.
 select jsonb_agg(jsonb_build_object('n',(value->>'n')::integer,'mult',(value->>'mult')::integer) ||
   case when ordinality=1 and not v_standard and v_round=8 then jsonb_build_object('exact_target',v_exact_choice) else '{}'::jsonb end order by ordinality)
 into p_darts from jsonb_array_elements(p_darts) with ordinality;
 v_after:=case when v_success then v_before+v_points when v_standard then (v_before+1)/2 else v_before/2 end;
 update public.half_it_visits set darts=p_darts,success=v_success,round_points=v_points,score_after=v_after,exact_target=v_exact_choice where id=v_visit.id;
 v_current:=v_after; v_next:=v_round+1;
 -- Later visits already have server-evaluated points and success. Only their
 -- running score depends on this correction. Do not change the opponent.
 for v_row in select * from public.half_it_visits where match_id=v_match_id and player_id=v_uid and leg_no=v_leg and round_no>v_round order by round_no for update loop
   if v_row.round_no<>v_next then raise exception 'HALF_CORRECTION_HISTORY'; end if;
   v_after:=case when v_row.success then v_current+v_row.round_points when v_standard then (v_current+1)/2 else v_current/2 end;
   update public.half_it_visits set score_before=v_current,score_after=v_after where id=v_row.id;
   v_current:=v_after;v_next:=v_next+1;
 end loop;
 update public.matches set player1_score=case when player1_id=v_uid then v_current else player1_score end,
   player2_score=case when player2_id=v_uid then v_current else player2_score end,updated_at=now() where id=v_match_id;
 return jsonb_build_object('round_no',v_round,'leg_no',v_leg,'score_after',v_current);
end $function$;
revoke all on function public.correct_half_it_visit(bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.correct_half_it_visit(bigint,jsonb,jsonb) to authenticated;
