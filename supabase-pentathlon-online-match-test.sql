-- Owner-only Pentathlon Online test. New variant follows standard challenge proposal,
-- accepted match and coin flip, with isolated Pentathlon scoring (not ranked).
-- This migration documents the live database definitions tested 22 Nov 2026.
alter table public.matches drop constraint if exists matches_game_variant_check;
alter table public.matches add constraint matches_game_variant_check
  check(game_variant in ('x01','cricket','half_it','sixty_one','jdc','pentathlon'));
alter table public.challenge_match_proposals drop constraint if exists challenge_match_proposals_game_variant_check;
alter table public.challenge_match_proposals add constraint challenge_match_proposals_game_variant_check
  check(game_variant in ('x01','cricket','half_it','sixty_one','jdc','pentathlon'));
alter table public.pentathlon_room_tests add column if not exists
  match_id uuid unique references public.matches(id);
CREATE OR REPLACE FUNCTION public.apply_pentathlon_room_test(p_challenge_id uuid, p_expected_version bigint, p_action text, p_next jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.pentathlon_room_tests%rowtype;v_user uuid:=auth.uid();v_slot integer;
  v_old jsonb;v_old_count integer;v_new_count integer;
begin
  if v_user is null then raise exception 'Authentication required';end if;
  select * into r from public.pentathlon_room_tests where challenge_id=p_challenge_id for update;
  if not found or v_user not in(r.player1_id,r.player2_id) then raise exception 'Pentathlon test not found';end if;
  if r.version<>p_expected_version then raise exception 'PENTATHLON_STALE_VERSION';end if;
  if r.match_id is not null and not exists(select 1 from public.matches where id=r.match_id and game_variant='pentathlon' and status='playing')
  then raise exception 'Pentathlon match is no longer active';end if;
  if p_action not in ('turn','advance','undo') then raise exception 'Invalid Pentathlon action';end if;
  if jsonb_typeof(p_next)<>'object' or octet_length(p_next::text)>180000
    or p_next->'players' is distinct from r.state->'players'
    or p_next->'firstStarter' is distinct from r.state->'firstStarter'
    or p_next->'createdAt' is distinct from r.state->'createdAt'
    or p_next->>'version'<>'1'
    or (p_next->>'stageIndex')::integer not between 0 and 7
    or p_next->>'status' not in ('playing','review','finished')
    then raise exception 'Invalid Pentathlon state';end if;
  v_slot:=case when v_user=r.player1_id then 0 else 1 end;
  v_old:=r.state;
  if p_action='turn' then
    if v_old->>'status'<>'playing' or (v_old->'current'->>'turn')::integer<>v_slot
      or p_next->'stageIndex' is distinct from v_old->'stageIndex'
      or p_next->'summaries' is distinct from v_old->'summaries'
         and p_next->>'status'<>'review'
      then raise exception 'Not your turn';end if;
    v_old_count:=jsonb_array_length(coalesce(v_old->'current'->'entries','[]'::jsonb));
    v_new_count:=jsonb_array_length(coalesce(p_next->'current'->'entries','[]'::jsonb));
    if v_new_count<v_old_count or v_new_count>v_old_count+3
      or (v_old_count>0 and p_next->'current'->'entries'->(v_old_count-1) is distinct from v_old->'current'->'entries'->(v_old_count-1))
      then raise exception 'Unexpected turn data';end if;
  elsif p_action='advance' then
    if v_old->>'status'<>'review'
       or (p_next->>'stageIndex')::integer<>(v_old->>'stageIndex')::integer+1
       or p_next->'summaries' is distinct from v_old->'summaries'
       or p_next->'total' is distinct from v_old->'total'
       then raise exception 'Cannot advance Pentathlon stage';end if;
  else
    if r.last_actor is distinct from v_user or v_old->>'status' not in ('playing','review')
       or jsonb_array_length(coalesce(v_old->'undo','[]'::jsonb))<>1
       or p_next-'undo' is distinct from (v_old->'undo'->0)-'undo'
       then raise exception 'Cannot undo another player''s turn';end if;
  end if;
  update public.pentathlon_room_tests set state=p_next,version=version+1,
    last_actor=case when p_action='advance' then null else v_user end,
    updated_at=now()
  where challenge_id=p_challenge_id returning * into r;
  if r.match_id is not null and p_next->>'status'='finished' then
    update public.matches
      set status='finished',finished_at=now(),updated_at=now(),
        winner_id=case
          when (p_next->'total'->>0)::integer>(p_next->'total'->>1)::integer then r.player1_id
          when (p_next->'total'->>1)::integer>(p_next->'total'->>0)::integer then r.player2_id
          else null end
      where id=r.match_id and game_variant='pentathlon' and status='playing';
    update public.profiles set status='unavailable'
      where id in(r.player1_id,r.player2_id);
  end if;
  return to_jsonb(r);
end;$function$
;

CREATE OR REPLACE FUNCTION public.cancel_pentathlon_match_test(p_match_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m public.matches%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into m from public.matches where id=p_match_id for update;
 if not found or m.game_variant<>'pentathlon' or auth.uid() not in(m.player1_id,m.player2_id)
   then raise exception 'Pentathlon match not found';end if;
 if m.status<>'playing' then return false;end if;
 update public.matches set status='cancelled',finished_at=now(),updated_at=now() where id=p_match_id;
 update public.profiles set status='unavailable' where id in(m.player1_id,m.player2_id);
 return true;
end;$function$
;

CREATE OR REPLACE FUNCTION public.create_match_from_challenge(p_challenge_id uuid, p_game_variant text, p_game integer, p_legs integer, p_match_mode text, p_best_of_sets integer, p_starter_id uuid DEFAULT NULL::uuid, p_game_config jsonb DEFAULT '{}'::jsonb, p_is_warmup boolean DEFAULT false, p_is_live boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid:=auth.uid();
  c public.challenges%rowtype;
  m public.matches%rowtype;
  v_starter uuid;
  v_variant text:=lower(coalesce(p_game_variant,'x01'));
  v_mode text:=lower(coalesce(p_match_mode,'legs'));
  v_game integer;
  v_legs integer;
  v_sets integer;
  v_score integer;
  v_config jsonb:='{}'::jsonb;
  v_half_mode text;
  v_duration integer;
  v_warmup boolean:=coalesce(p_is_warmup,false);
  v_live boolean:=coalesce(p_is_live,true);
  v_chicago boolean:=lower(coalesce(p_game_config->>'chicago','false'))='true';
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into c
  from public.challenges
  where id=p_challenge_id
  for update;

  if not found then raise exception 'Challenge not found'; end if;
  if v_uid not in (c.challenger_id,c.challenged_id) then raise exception 'Not a participant in this challenge'; end if;
  if c.status<>'room' then raise exception 'Challenge is not ready to start'; end if;
  if v_variant not in ('x01','cricket','half_it','sixty_one','jdc','pentathlon') then raise exception 'Invalid game variant'; end if;

  v_legs:=coalesce(p_legs,1);
  if v_variant='jdc' then v_legs:=1; end if;
  if v_variant='pentathlon' then
    v_legs:=1;v_warmup:=true;
    if not exists(select 1 from public.challenge_match_proposals p
      join public.user_roles ur on ur.user_id=p.proposer_id and ur.role='owner'
      where p.challenge_id=c.id and p.status='pending' and p.game_variant='pentathlon'
        and p.proposer_id<>v_uid and p.starter_id is not distinct from p_starter_id)
      then raise exception 'Owner Pentathlon proposal awaiting acceptance required';end if;
  end if;
  if v_chicago then v_legs:=3; end if;
  if v_legs<1 or v_legs>21 or mod(v_legs,2)=0 then raise exception 'Best of legs must be an odd number from 1 to 21'; end if;

  if p_starter_id is null then
    v_starter:=case when random()<0.5 then c.challenger_id else c.challenged_id end;
  elsif p_starter_id in (c.challenger_id,c.challenged_id) then
    v_starter:=p_starter_id;
  else
    raise exception 'Starter must be one of the players';
  end if;

  if v_variant='x01' then
    v_game:=p_game;
    if v_game not in (170,301,501,1001,2001) then raise exception 'Invalid X01 game'; end if;

    if v_chicago then
      if v_game<>301 then raise exception 'Chicago Style must start with 301'; end if;
      v_mode:='legs';
      v_sets:=1;
      v_legs:=3;
      v_score:=301;
      v_config:=jsonb_build_object(
        'chicago',true,
        'chicago_stage',1,
        'ranked',false,
        'chicago_results','[]'::jsonb
      );
    else
      if v_mode not in ('legs','sets') then raise exception 'Invalid match mode'; end if;
      v_sets:=case when v_mode='sets' then coalesce(p_best_of_sets,1) else 1 end;
      if v_sets<1 or v_sets>11 or mod(v_sets,2)=0 then raise exception 'Best of sets must be an odd number from 1 to 11'; end if;
      v_score:=v_game;
    end if;
  elsif v_variant='sixty_one' then
    v_game:=501; v_mode:='legs'; v_sets:=1; v_score:=61;
    v_duration:=coalesce((p_game_config->>'duration_seconds')::integer,600);
    if v_duration not in (600,1200,1800,2700,3600) then raise exception 'Invalid 61 duration'; end if;
    v_config:=jsonb_build_object('duration_seconds',v_duration);
  elsif v_variant='half_it' then
    v_game:=501; v_mode:='legs'; v_sets:=1; v_score:=0;
    v_half_mode:=lower(coalesce(p_game_config->>'half_it_mode','dartcounter'));
    if v_half_mode not in ('dartcounter','standard') then raise exception 'Invalid Half-It mode'; end if;
    v_config:=jsonb_build_object('half_it_mode',v_half_mode);
  elsif v_variant='jdc' then
    v_game:=501; v_mode:='legs'; v_sets:=1; v_score:=0;
    v_config:=jsonb_build_object('ranked',not v_warmup);
  elsif v_variant='pentathlon' then
    v_game:=501;v_mode:='legs';v_sets:=1;v_score:=501;
    v_config:=jsonb_build_object('pentathlon',true,'ranked',false);
  else
    v_game:=501; v_mode:='legs'; v_sets:=1; v_score:=0;
  end if;

  insert into public.matches(
    player1_id,player2_id,game,game_variant,legs,status,turn_player_id,
    player1_score,player2_score,match_mode,best_of_sets,player1_sets,player2_sets,
    match_starter_id,current_set,current_leg,game_config,is_warmup,is_live
  ) values (
    c.challenger_id,c.challenged_id,v_game,v_variant,v_legs,'playing',v_starter,
    v_score,v_score,v_mode,v_sets,0,0,v_starter,1,1,v_config,v_warmup,v_live
  )
  returning * into m;

  update public.challenges set status='accepted' where id=c.id;
  update public.profiles
  set status='in_game',last_seen=now()
  where id in (c.challenger_id,c.challenged_id);

  return to_jsonb(m);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.propose_challenge_match(p_challenge_id uuid, p_game_variant text, p_game integer, p_legs integer, p_match_mode text, p_best_of_sets integer, p_starter_id uuid DEFAULT NULL::uuid, p_game_config jsonb DEFAULT '{}'::jsonb, p_is_warmup boolean DEFAULT false, p_is_live boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid:=auth.uid();
  c public.challenges%rowtype;
  v_variant text:=lower(coalesce(p_game_variant,'x01'));
  v_game integer;
  v_legs integer:=coalesce(p_legs,1);
  v_mode text:=lower(coalesce(p_match_mode,'legs'));
  v_sets integer:=coalesce(p_best_of_sets,1);
  v_config jsonb:='{}'::jsonb;
  v_half_mode text;
  v_duration integer;
  v_warmup boolean:=coalesce(p_is_warmup,false);
  v_live boolean:=coalesce(p_is_live,true);
  v_chicago boolean:=lower(coalesce(p_game_config->>'chicago','false'))='true';
  r public.challenge_match_proposals%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into c
  from public.challenges
  where id=p_challenge_id
  for update;

  if not found then raise exception 'Challenge not found'; end if;
  if v_uid not in (c.challenger_id,c.challenged_id) then raise exception 'Not a participant in this challenge'; end if;
  if c.status<>'room' then raise exception 'Challenge is not ready for proposals'; end if;
  if v_variant not in ('x01','cricket','half_it','sixty_one','jdc','pentathlon') then raise exception 'Invalid game variant'; end if;
  if v_variant='jdc' then v_legs:=1; end if;
  if v_variant='pentathlon' then
    if not public.is_owner() then raise exception 'Pentathlon is Owner-only test';end if;
    v_legs:=1;v_warmup:=true;
  end if;
  if v_chicago then v_legs:=3; end if;
  if v_legs<1 or v_legs>21 or mod(v_legs,2)=0 then raise exception 'Best of legs must be an odd number from 1 to 21'; end if;
  if p_starter_id is not null and p_starter_id not in (c.challenger_id,c.challenged_id) then raise exception 'Starter must be one of the players'; end if;

  if v_variant='x01' then
    v_game:=p_game;
    if v_game not in (170,301,501,1001,2001) then raise exception 'Invalid X01 game'; end if;

    if v_chicago then
      if v_game<>301 then raise exception 'Chicago Style must start with 301'; end if;
      v_mode:='legs';
      v_sets:=1;
      v_legs:=3;
      v_config:=jsonb_build_object(
        'chicago',true,
        'chicago_stage',1,
        'ranked',false,
        'chicago_results','[]'::jsonb
      );
    else
      if v_mode not in ('legs','sets') then raise exception 'Invalid match mode'; end if;
      if v_mode='sets' then
        if v_sets<1 or v_sets>11 or mod(v_sets,2)=0 then raise exception 'Best of sets must be an odd number from 1 to 11'; end if;
      else
        v_sets:=1;
      end if;
    end if;
  elsif v_variant='sixty_one' then
    v_game:=501; v_mode:='legs'; v_sets:=1;
    v_duration:=coalesce((p_game_config->>'duration_seconds')::integer,600);
    if v_duration not in (600,1200,1800,2700,3600) then raise exception 'Invalid 61 duration'; end if;
    v_config:=jsonb_build_object('duration_seconds',v_duration);
  elsif v_variant='half_it' then
    v_game:=501; v_mode:='legs'; v_sets:=1;
    v_half_mode:=lower(coalesce(p_game_config->>'half_it_mode','dartcounter'));
    if v_half_mode not in ('dartcounter','standard') then raise exception 'Invalid Half-It mode'; end if;
    v_config:=jsonb_build_object('half_it_mode',v_half_mode);
  elsif v_variant='jdc' then
    v_game:=501; v_mode:='legs'; v_sets:=1;
    v_config:=jsonb_build_object('ranked',not v_warmup);
  elsif v_variant='pentathlon' then
    v_game:=501;v_mode:='legs';v_sets:=1;v_config:=jsonb_build_object('pentathlon',true,'ranked',false);
  else
    v_game:=501; v_mode:='legs'; v_sets:=1;
  end if;

  update public.challenge_match_proposals
  set status='superseded',resolved_at=now()
  where challenge_id=c.id and status='pending';

  insert into public.challenge_match_proposals(
    challenge_id,proposer_id,game_variant,game,legs,match_mode,best_of_sets,
    starter_id,game_config,is_warmup,is_live,status
  ) values (
    c.id,v_uid,v_variant,v_game,v_legs,v_mode,v_sets,p_starter_id,
    v_config,v_warmup,v_live,'pending'
  )
  returning * into r;

  return to_jsonb(r);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.start_pentathlon_match_test(p_match_id uuid, p_challenge_id uuid, p_state jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m public.matches%rowtype;c public.challenges%rowtype;r public.pentathlon_room_tests%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into m from public.matches where id=p_match_id;
 select * into c from public.challenges where id=p_challenge_id for update;
 if m.id is null or m.game_variant<>'pentathlon' or m.status<>'playing'
  or c.id is null or c.status<>'accepted'
  or m.player1_id<>c.challenger_id or m.player2_id<>c.challenged_id
  or m.created_at<c.created_at or auth.uid() not in(m.player1_id,m.player2_id)
 then raise exception 'Valid Pentathlon match required';end if;
 if jsonb_typeof(p_state)<>'object' or p_state->>'status'<>'playing'
  or p_state->>'stageIndex'<>'0' or p_state->>'version'<>'1'
  or p_state->'current'->>'kind'<>'x01'
  or p_state->'current'->'entries'<>'[]'::jsonb
  or jsonb_array_length(coalesce(p_state->'players','[]'::jsonb))<>2
  or ((p_state->>'firstStarter')::int=0 and m.match_starter_id<>m.player1_id)
  or ((p_state->>'firstStarter')::int=1 and m.match_starter_id<>m.player2_id)
  or p_state->'current'->'turn'<>p_state->'firstStarter'
  or p_state->'current'->'remaining'<>'[501, 501]'::jsonb
  or p_state->'current'->'used'<>'[0, 0]'::jsonb
  or p_state->'total'<>'[0, 0]'::jsonb
  or p_state->'summaries'<>'[]'::jsonb
  or octet_length(p_state::text)>150000
  then raise exception 'Invalid Pentathlon initial state';end if;
 insert into public.pentathlon_room_tests(challenge_id,match_id,player1_id,player2_id,state)
 values(p_challenge_id,p_match_id,m.player1_id,m.player2_id,p_state)
 on conflict(challenge_id) do nothing;
 select * into r from public.pentathlon_room_tests where challenge_id=p_challenge_id;
 if r.match_id is null and r.state->>'status'='playing'
     and r.state->>'stageIndex'='0'
     and r.state->'current'->'entries'='[]'::jsonb
     and r.state->'current'->'used'='[0, 0]'::jsonb
     and r.version<=1
   then
     update public.pentathlon_room_tests
       set match_id=p_match_id,state=p_state,version=version+1,updated_at=now()
       where challenge_id=p_challenge_id returning * into r;
   end if;
   if r.match_id is distinct from p_match_id then
     raise exception 'An existing Pentathlon test has throws. Create a new challenge for the match';
   end if;
 return to_jsonb(r);
end;$function$
;
revoke all on function public.start_pentathlon_match_test(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.start_pentathlon_match_test(uuid,uuid,jsonb) to authenticated;
revoke all on function public.cancel_pentathlon_match_test(uuid) from public,anon,authenticated;
grant execute on function public.cancel_pentathlon_match_test(uuid) to authenticated;
