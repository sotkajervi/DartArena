begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
CREATE OR REPLACE FUNCTION public.apply_pentathlon_room_test(p_challenge_id uuid, p_expected_version bigint, p_action text, p_next jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.pentathlon_room_tests%rowtype;v_user uuid:=auth.uid();v_slot integer;
  v_old jsonb;v_old_count integer;v_new_count integer;v_idx integer;v_changed integer:=0;v_owned_later integer;
  v_prev_entry jsonb;v_next_entry jsonb;v_other_slot integer;
begin
  if v_user is null then raise exception 'Authentication required';end if;
  select * into r from public.pentathlon_room_tests where challenge_id=p_challenge_id for update;
  if not found or v_user not in(r.player1_id,r.player2_id) then raise exception 'Pentathlon test not found';end if;
  if r.version<>p_expected_version then raise exception 'PENTATHLON_STALE_VERSION';end if;
  if r.match_id is not null and not exists(select 1 from public.matches where id=r.match_id and game_variant='pentathlon' and status='playing')
  then raise exception 'Pentathlon match is no longer active';end if;
  if p_action not in ('turn','advance','undo','correct') then raise exception 'Invalid Pentathlon action';end if;
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
  elsif p_action='correct' then
    -- Require the same live X01 stage, turn and visit count.
    if v_old->>'status'<>'playing' or p_next->>'status'<>'playing'
      or v_old->'current'->>'kind'<>'x01' or p_next->'current'->>'kind'<>'x01'
      or p_next->'stageIndex' is distinct from v_old->'stageIndex'
      or p_next->'summaries' is distinct from v_old->'summaries'
      or p_next->'total' is distinct from v_old->'total'
      or p_next->'current'->'turn' is distinct from v_old->'current'->'turn'
      or p_next->'current'->'starter' is distinct from v_old->'current'->'starter'
      or p_next->'current'->'start' is distinct from v_old->'current'->'start'
      or p_next->'current'->'used' is distinct from v_old->'current'->'used'
      or p_next->'current'->'pending' is distinct from v_old->'current'->'pending'
      or p_next->'current'->'done' is distinct from v_old->'current'->'done'
      or p_next->'current'->'win' is distinct from v_old->'current'->'win'
      then raise exception 'Pentathlon correction must preserve stage and turn order';end if;
    v_other_slot:=1-v_slot;
    if p_next->'current'->'remaining'->v_other_slot is distinct from v_old->'current'->'remaining'->v_other_slot
      or p_next->'current'->'pent'->v_other_slot is distinct from v_old->'current'->'pent'->v_other_slot
      or p_next->'current'->'visitCounts'->v_other_slot is distinct from v_old->'current'->'visitCounts'->v_other_slot
      then raise exception 'Cannot change opponent Pentathlon totals';end if;
    v_old_count:=jsonb_array_length(coalesce(v_old->'current'->'entries','[]'::jsonb));
    v_new_count:=jsonb_array_length(coalesce(p_next->'current'->'entries','[]'::jsonb));
    if v_old_count<1 or v_old_count<>v_new_count then raise exception 'Correction must preserve visit count';end if;
    for v_idx in 0..v_old_count-1 loop
      v_prev_entry:=v_old->'current'->'entries'->v_idx;
      v_next_entry:=p_next->'current'->'entries'->v_idx;
      if v_prev_entry->>'type' is distinct from v_next_entry->>'type'
        or v_prev_entry->'player' is distinct from v_next_entry->'player'
        or v_prev_entry->'darts' is distinct from v_next_entry->'darts'
        or v_prev_entry->'checkout' is distinct from v_next_entry->'checkout'
        then raise exception 'Correction cannot change visits or checkout';end if;
      if v_prev_entry->'attempt' is distinct from v_next_entry->'attempt' then
        v_changed:=v_changed+1;
        if v_changed<>1 or v_prev_entry->>'type'<>'visit'
          or (v_prev_entry->>'player')::integer<>v_slot
          or v_prev_entry->>'checkout'='true'
          or jsonb_typeof(v_next_entry->'attempt')<>'number'
          or (v_next_entry->>'attempt')::integer not between 0 and 180
          then raise exception 'Only own recent non-checkout X01 visit may change';end if;
        select count(*) into v_owned_later
          from jsonb_array_elements(v_old->'current'->'entries') with ordinality as e(entry,ord)
          where e.ord>v_idx+1 and e.entry->>'type'='visit'
            and (e.entry->>'player')::integer=v_slot;
        if v_owned_later>=3 then raise exception 'Only last three own visits may be corrected';end if;
      end if;
    end loop;
    if v_changed<>1 then raise exception 'Exactly one visit score must change';end if;
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
end;$function$;
revoke execute on function public.apply_pentathlon_room_test(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.apply_pentathlon_room_test(uuid,bigint,text,jsonb) to authenticated;
alter table public.pentathlon_room_tests drop column stage_ready_mask;
commit;
