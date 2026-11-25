drop function if exists public.correct_pentathlon_half_dart(uuid,bigint,jsonb);
CREATE OR REPLACE FUNCTION dartarena_internal.pentathlon_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 a jsonb; b jsonb; old_log jsonb; new_log jsonb; old_n integer; new_n integer; i integer; slot integer; actor uuid:=auth.uid();
 changes integer:=0; later_count integer; raw_key text; before_entry jsonb; after_entry jsonb;
begin
 b:=new.state;
 perform dartarena_internal.pentathlon_validate(b);
 if tg_op='INSERT' or (old.match_id is null and new.match_id is not null) then
  if b->>'status' is distinct from 'playing' or b->'stageIndex' is distinct from '0'::jsonb or b->'current'->'entries' is distinct from '[]'::jsonb or b->'undo' is distinct from '[]'::jsonb then raise exception 'PENTATHLON_INVALID_INITIAL_STATE';end if;
  return new;
 end if;
 a:=old.state;
 if actor is null or actor not in (old.player1_id,old.player2_id) then raise exception 'PENTATHLON_ACCESS_DENIED';end if;
 slot:=case when actor=old.player1_id then 0 else 1 end;
 if new.version is distinct from old.version+1 or new.match_id is distinct from old.match_id
 or new.player1_id is distinct from old.player1_id or new.player2_id is distinct from old.player2_id
 or b->'players' is distinct from a->'players' or b->'firstStarter' is distinct from a->'firstStarter' or b->'createdAt' is distinct from a->'createdAt' then raise exception 'PENTATHLON_INVALID_TRANSITION';end if;
 -- Undo only the exact previously stored, server-validated snapshot.
 if b->'undo'='[]'::jsonb and old.last_actor=actor and jsonb_array_length(a->'undo')=1 and b-'undo'=a->'undo'->0 then
  if new.last_actor is distinct from actor then raise exception 'PENTATHLON_INVALID_ACTOR';end if;
  return new;
 end if;
 -- Advance may only open an empty next stage or finish the seventh stage.
 if a->>'status'='review' and (b->>'stageIndex')::int=(a->>'stageIndex')::int+1 then
  if b->'summaries' is distinct from a->'summaries' or b->'total' is distinct from a->'total' or b->'undo' is distinct from '[]'::jsonb or new.last_actor is not null
  or (b->>'status'='playing' and b->'current'->'entries' is distinct from '[]'::jsonb)
  or b->>'status' not in ('playing','finished') then raise exception 'PENTATHLON_INVALID_ADVANCE';end if;
  return new;
 end if;
 if a->>'status' is distinct from 'playing' or b->'stageIndex' is distinct from a->'stageIndex' or b->>'status' not in ('playing','review')
 or b->'undo' is distinct from jsonb_build_array(a-'undo') or new.last_actor is distinct from actor
 or (select coalesce(jsonb_agg(x order by ord),'[]'::jsonb) from jsonb_array_elements(b->'summaries') with ordinality as q(x,ord) where ord<=jsonb_array_length(a->'summaries')) is distinct from a->'summaries'
 then raise exception 'PENTATHLON_INVALID_TRANSITION';end if;
 old_log:=a->'current'->'entries';new_log:=b->'current'->'entries';old_n:=jsonb_array_length(old_log);new_n:=jsonb_array_length(new_log);
 if new_n>old_n then
  if a->'current'->'turn' is distinct from to_jsonb(slot) or new_n-old_n>(case when a->'current'->>'kind'='x01' then 1 else 3 end)
  or b->'current'->'pending' is distinct from '[]'::jsonb then raise exception 'PENTATHLON_INVALID_TURN';end if;
  for i in 0..new_n-1 loop
   if i<old_n then
    if old_log->i is distinct from new_log->i then raise exception 'PENTATHLON_CHANGED_HISTORY';end if;
   elsif new_log->i->'player' is distinct from to_jsonb(slot) then raise exception 'PENTATHLON_WRONG_PLAYER';end if;
  end loop;
 elsif new_n=old_n then
  if b->>'status' is distinct from 'playing' or b->'current'->'turn' is distinct from a->'current'->'turn' or b->'current'->'done' is distinct from a->'current'->'done' then raise exception 'PENTATHLON_INVALID_CORRECTION';end if;
  raw_key:=case when a->'current'->>'kind'='x01' then 'attempt' else 'hit' end;
  if a->'current'->>'kind' not in ('x01','clock','shanghai') then raise exception 'PENTATHLON_INVALID_CORRECTION';end if;
  for i in 0..old_n-1 loop
   before_entry:=old_log->i;after_entry:=new_log->i;
   if before_entry->'player' is distinct from after_entry->'player' or before_entry->'type' is distinct from after_entry->'type' or before_entry->'darts' is distinct from after_entry->'darts' or before_entry->'checkout' is distinct from after_entry->'checkout' then raise exception 'PENTATHLON_INVALID_CORRECTION';end if;
   if before_entry->raw_key is distinct from after_entry->raw_key then
    changes:=changes+1;
    select count(*) into later_count from jsonb_array_elements(old_log) with ordinality as z(item,ord) where ord>i+1 and item->'player'=to_jsonb(slot);
    if changes>1 or before_entry->'player' is distinct from to_jsonb(slot) or before_entry->>'checkout'='true' or later_count>=3 then raise exception 'PENTATHLON_INVALID_CORRECTION';end if;
   end if;
  end loop;
  if changes<>1 then raise exception 'PENTATHLON_INVALID_CORRECTION';end if;
 else raise exception 'PENTATHLON_CHANGED_HISTORY';end if;
 return new;
end;$function$
;
