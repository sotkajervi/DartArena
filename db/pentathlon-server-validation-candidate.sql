-- Candidate migration: run isolated tests before any production deployment.
-- Server-side deterministic replay of the existing online Pentathlon engine.
begin;
create schema if not exists dartarena_internal;
revoke all on schema dartarena_internal from public, anon, authenticated;
create or replace function dartarena_internal.pentathlon_replay(idx integer, starter integer, log jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
 k text; start_score integer; turn_slot integer:=starter; j integer; a integer; n integer; m integer;
 rem integer[]; used integer[]:=array[0,0]; points integer[]:=array[0,0];
 c95 integer[]:=array[0,0]; c131 integer[]:=array[0,0]; c160 integer[]:=array[0,0]; tons integer[]:=array[0,0];
 done boolean[]:=array[false,false]; clocks integer[]:=array[1,1]; halves integer[]:=array[0,0];
 half_round integer:=0; pending jsonb:='[]'; entries jsonb:='[]'; e jsonb; expected jsonb;
 target integer; target_mult integer; target_label text; hit text; raw integer; credited integer; bonus integer;
 dart_count integer; speed integer; bust boolean; checkout boolean; winner integer; value integer;
 finished boolean:=false; extra integer; mask integer:=0; matches_hit boolean;
begin
 if idx is null or idx not between 0 and 6 or starter is null or starter not in (0,1)
 or jsonb_typeof(log) is distinct from 'array' then raise exception 'PENTATHLON_INVALID_LOG';end if;
 k:=case when idx<4 then 'x01' when idx=4 then 'shanghai' when idx=5 then 'clock' else 'half' end;
 start_score:=case idx when 0 then 501 when 1 then 501 when 2 then 1001 when 3 then 2001 else null end;
 rem:=array[coalesce(start_score,0),coalesce(start_score,0)];
 for e in select item from jsonb_array_elements(log) as t(item) loop
  if finished or e->'player' is distinct from to_jsonb(turn_slot) then raise exception 'PENTATHLON_INVALID_TURN';end if;
  j:=turn_slot+1;
  if k='x01' then
   raw:=(e->>'attempt')::int;
   if raw is null or raw not between 0 and 180 or raw in (163,166,169,172,173,175,176,178,179) then raise exception 'PENTATHLON_INVALID_SCORE';end if;
   bust:=raw>rem[j] or rem[j]-raw=1;checkout:=raw=rem[j] and not bust;
   dart_count:=case when checkout then (e->>'darts')::int else 3 end;
   if checkout and not coalesce(case dart_count when 1 then raw=any(array[2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,50]) when 2 then raw=any(array[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,100,101,104,107,110]) when 3 then raw=any(array[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,160,161,164,167,170]) else false end,false) then raise exception 'PENTATHLON_INVALID_CHECKOUT';end if;
   credited:=case when bust then 0 else raw end;
   bonus:=case when credited>=160 then 3 when credited>=131 then 2 when credited>=95 then 1 else 0 end;
   rem[j]:=rem[j]-credited;used[j]:=used[j]+dart_count;
   if credited between 95 and 130 then c95[j]:=c95[j]+1;end if;
   if credited between 131 and 159 then c131[j]:=c131[j]+1;end if;
   if credited>=160 then c160[j]:=c160[j]+1;end if;
   if credited>=100 then tons[j]:=tons[j]+1;end if;
   expected:=jsonb_build_object('player',turn_slot,'type','visit','score',credited,'attempt',raw,'bust',bust,'checkout',checkout,'darts',dart_count,'bonus',bonus,'remaining',rem[j]);
   if checkout then
    speed:=case when used[j]=9 then 10 when used[j] between 10 and 12 then 4 when used[j] between 13 and 15 then 3 when used[j] between 16 and 18 then 2 when used[j] between 19 and 21 then 1 else 0 end;
    bonus:=bonus+2+speed;expected:=expected||jsonb_build_object('bonus',bonus,'legPoints',2,'speedBonus',speed);
    winner:=turn_slot;finished:=true;
   else turn_slot:=1-turn_slot;end if;
   points[j]:=points[j]+bonus;
  else
   if done[j] then raise exception 'PENTATHLON_INVALID_TURN';end if;
   hit:=e->>'hit';
   if hit='BOM' then n:=0;m:=0;
   elsif hit='BULL 50' then n:=25;m:=2;
   elsif hit='BULL 25' then n:=25;m:=1;
   elsif hit ~ '^[SDT]([1-9]|1[0-9]|20)$' then n:=substring(hit from 2)::int;m:=case left(hit,1) when 'S' then 1 when 'D' then 2 else 3 end;
   else raise exception 'PENTATHLON_INVALID_DART';end if;
   if k='shanghai' then target:=used[j]/3+1;target_label:='TALL '||target;
   elsif k='clock' then target:=clocks[j];target_label:='D'||target;
   else
    a:=used[j]/3+1;target:=(array[20,16,7,14,10,17,25])[a];target_mult:=(array[0,0,2,0,3,0,2])[a];target_label:=(array['20','16','D7','14','T10','17','BULL 50'])[a];
   end if;
   used[j]:=used[j]+1;
   pending:=pending||jsonb_build_array(jsonb_build_object('n',n,'m',m));
   bonus:=0;
   expected:=jsonb_build_object('player',turn_slot,'type','dart','hit',hit,'target',target_label,'bonus',0,'dart',used[j]);
   if k='shanghai' then
    if n=target then bonus:=m;mask:=mask | (1 << (m-1));end if;
    if jsonb_array_length(pending)=3 and mask=7 then bonus:=bonus+6;expected:=expected||'{"shanghai":true}'::jsonb;end if;
    done[j]:=used[j]=27;
   elsif k='clock' then
    if n=target and m=2 then
     bonus:=2;clocks[j]:=clocks[j]+1;
     if clocks[j]=21 then extra:=42-used[j];bonus:=bonus+extra;done[j]:=true;expected:=expected||jsonb_build_object('finishBonus',extra);end if;
    end if;
    if used[j]>=42 then done[j]:=true;end if;
   else
    matches_hit:=n=target and (target_mult=0 or m=target_mult);
    value:=case when matches_hit then n*m else 0 end;
    bonus:=case when matches_hit then m else 0 end;
    half_round:=half_round+value;expected:=expected||jsonb_build_object('scoreValue',value);
    if jsonb_array_length(pending)=3 then
     halves[j]:=case when half_round=0 then (halves[j]+1)/2 else halves[j]+half_round end;
     expected:=expected||jsonb_build_object('roundScore',half_round,'halfAfter',halves[j],'halved',half_round=0);
    end if;
    done[j]:=used[j]=21;
   end if;
   points[j]:=points[j]+bonus;expected:=expected||jsonb_build_object('bonus',bonus);
   if done[1] and done[2] then pending:='[]';half_round:=0;finished:=true;
   elsif jsonb_array_length(pending)=3 or done[j] then
    pending:='[]';half_round:=0;mask:=0;
    if not done[3-j] then turn_slot:=1-turn_slot;end if;
   end if;
  end if;
  if e is distinct from expected then raise exception 'PENTATHLON_INVALID_ENTRY';end if;
  entries:=entries||jsonb_build_array(expected);
 end loop;
 return jsonb_build_object('finished',finished,'current',jsonb_build_object('kind',k,'start',start_score,'turn',turn_slot,'starter',starter,'remaining',rem,'used',used,'pent',points,'visitCounts',jsonb_build_array(jsonb_build_object('n95',c95[1],'n131',c131[1],'n160',c160[1],'tons',tons[1]),jsonb_build_object('n95',c95[2],'n131',c131[2],'n160',c160[2],'tons',tons[2])),'entries',entries,'pending',pending,'done',done,'win',winner,'clockTarget',clocks,'halfScores',halves,'halfRoundScore',half_round));
end;$$;
create or replace function dartarena_internal.pentathlon_validate(s jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare idx integer; first_slot integer; phase text; count_done integer; i integer; result jsonb; c jsonb; summary jsonb; expected jsonb;
 total integer[]:=array[0,0]; ids text[]:=array['501a','501b','1001','2001','shanghai','clock','half'];
 labels text[]:=array['501 · Leg 1','501 · Leg 2','1001','2001','Shanghai','Klokka rundt på dobbel','Half-It · Pentathlon'];
begin
 if jsonb_typeof(s) is distinct from 'object' or s->'version' is distinct from '1'::jsonb or jsonb_typeof(s->'players') is distinct from 'array'
 or jsonb_array_length(s->'players')<>2 or jsonb_typeof(s->'createdAt') is distinct from 'number'
 or jsonb_typeof(s->'undo') is distinct from 'array' or jsonb_array_length(s->'undo')>1 or jsonb_typeof(s->'summaries') is distinct from 'array' then raise exception 'PENTATHLON_INVALID_STATE';end if;
 idx:=(s->>'stageIndex')::int;first_slot:=(s->>'firstStarter')::int;phase:=s->>'status';
 if idx is null or first_slot is null or first_slot not in (0,1) or phase is null or phase not in ('playing','review','finished') or idx not between 0 and 7 or (idx=7) is distinct from (phase='finished') then raise exception 'PENTATHLON_INVALID_STAGE';end if;
 count_done:=case when phase='finished' then 7 when phase='review' then idx+1 else idx end;
 if jsonb_array_length(s->'summaries')<>count_done then raise exception 'PENTATHLON_INVALID_SUMMARIES';end if;
 for i in 0..count_done-1 loop
  summary:=s->'summaries'->i;
  result:=dartarena_internal.pentathlon_replay(i,(first_slot+i)%2,summary->'entries');c:=result->'current';
  if result->'finished' is distinct from 'true'::jsonb then raise exception 'PENTATHLON_INCOMPLETE_SUMMARY';end if;
  total[1]:=total[1]+(c->'pent'->>0)::int;total[2]:=total[2]+(c->'pent'->>1)::int;
  expected:=jsonb_build_object('id',ids[i+1],'label',labels[i+1],'kind',c->'kind','pent',c->'pent','after',total,'remaining',c->'remaining','used',c->'used','winner',c->'win','halfScores',c->'halfScores','counts',c->'visitCounts','entries',c->'entries');
  if summary is distinct from expected then raise exception 'PENTATHLON_INVALID_SUMMARY';end if;
 end loop;
 if phase='playing' then
  result:=dartarena_internal.pentathlon_replay(idx,(first_slot+idx)%2,s->'current'->'entries');c:=result->'current';
  if result->'finished' is distinct from 'false'::jsonb then raise exception 'PENTATHLON_INVALID_COMPLETION';end if;
 end if;
 if s->'total' is distinct from to_jsonb(total) or s->'current' is distinct from c then raise exception 'PENTATHLON_INVALID_TOTALS';end if;
 if s-'undo' is distinct from jsonb_build_object('version',1,'players',s->'players','firstStarter',first_slot,'createdAt',s->'createdAt','stageIndex',idx,'status',phase,'total',total,'summaries',s->'summaries','current',c) then raise exception 'PENTATHLON_INVALID_STATE_FIELDS';end if;
end;$$;
create or replace function dartarena_internal.pentathlon_guard()
returns trigger language plpgsql set search_path='' as $$
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
  if a->'current'->'turn' is distinct from to_jsonb(slot) or new_n-old_n>case when a->'current'->>'kind'='x01' then 1 else 3 end
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
end;$$;
revoke all on all functions in schema dartarena_internal from public, anon, authenticated;
drop trigger if exists dartarena_pentathlon_validate_state on public.pentathlon_room_tests;
create trigger dartarena_pentathlon_validate_state before insert or update of state on public.pentathlon_room_tests for each row execute function dartarena_internal.pentathlon_guard();
commit;
