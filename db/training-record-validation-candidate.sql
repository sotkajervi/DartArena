-- Candidate only: require replayable logs for NEW personal training results.
-- Historical records remain unchanged. Apply only with coordinated frontend deployment.
begin;
create schema if not exists dartarena_training_internal;
revoke all on schema dartarena_training_internal from public,anon,authenticated;
create or replace function dartarena_training_internal.validate_record(g text,v text,s integer,d jsonb)
returns void language plpgsql immutable set search_path='' as $record$
declare h jsonb; a jsonb; dart jsonb; t integer:=61; best integer:=0; next_t integer; r integer:=0;
 kinds text[]; targets integer[]; k text; target integer; n integer; m integer; pts integer; total integer; nonmiss integer;
 color text; colors text[]; board integer[]:=array[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5]; pos integer;
 ok boolean; acc integer:=0; before_score integer; label text; goal integer;
begin
 if s is null or jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>500000 then raise exception 'TRAINING_INVALID_PAYLOAD';end if;
 if g='61' then
  if v is null or v not in ('10','20','30','45','60') or d->'duration_minutes' is distinct from to_jsonb(v::int)
  or jsonb_typeof(d->'attempts') is distinct from 'array' or jsonb_array_length(d->'attempts')>5000 then raise exception 'TRAINING_INVALID_61';end if;
  for a in select value from jsonb_array_elements(d->'attempts') loop
   if a->>'result'='hit' then
    best:=greatest(best,t);next_t:=least(170,t+5);
    while next_t=any(array[159,162,163,165,166,168,169]) loop next_t:=next_t+1;end loop;
   elsif a->>'result'='miss' then
    next_t:=greatest(2,t-1);
    while next_t=any(array[159,162,163,165,166,168,169]) loop next_t:=next_t-1;end loop;
   else raise exception 'TRAINING_INVALID_ATTEMPT';end if;
   if a is distinct from jsonb_build_object('result',a->>'result','before',t,'after',next_t) then raise exception 'TRAINING_INVALID_ATTEMPT';end if;
   t:=next_t;
  end loop;
  if s<>best or d->'end_target' is distinct from to_jsonb(t) then raise exception 'TRAINING_INVALID_SCORE';end if;
 elsif g='half_it' then
  if v='standard' then
   kinds:=array['number','number','double','number','number','treble','number','number','exact41','number','number','bull'];
   targets:=array[13,14,0,15,16,0,17,18,41,19,20,25];
  elsif v='dartcounter' then
   kinds:=array['number','double','number','treble','number','different','number','exact','number','same','number','bull'];
   targets:=array[20,0,19,0,18,0,17,0,16,0,15,25];
  else raise exception 'TRAINING_INVALID_VARIANT';end if;
  if d->'rounds' is distinct from '12'::jsonb or jsonb_typeof(d->'history') is distinct from 'array' or jsonb_array_length(d->'history')<>12 then raise exception 'TRAINING_INVALID_ROUNDS';end if;
  for h in select value from jsonb_array_elements(d->'history') loop
   r:=r+1;k:=kinds[r];target:=targets[r];pts:=0;total:=0;nonmiss:=0;colors:=array[]::text[];before_score:=acc;goal:=null;
   if jsonb_typeof(h->'darts') is distinct from 'array' or jsonb_array_length(h->'darts')<>3 then raise exception 'TRAINING_INVALID_DARTS';end if;
   label:=case k when 'number' then target::text when 'double' then case v when 'standard' then 'Dobbel' else 'Double' end when 'treble' then case v when 'standard' then 'Trippel' else 'Treble' end when 'different' then '3 forskjellige farger' when 'same' then 'Samme farge' when 'bull' then 'Bull' when 'exact41' then '41' else h->>'target' end;
   if k='exact' then
    if label ~ '^Eksakt [0-9]{2,3}$' then goal:=substring(label from 8)::int;
     if goal not between 41 and 170 or goal in (163,166,169) then raise exception 'TRAINING_INVALID_TARGET';end if;
    elsif label is distinct from 'Eksakt score' then raise exception 'TRAINING_INVALID_TARGET';end if;
   end if;
   for dart in select value from jsonb_array_elements(h->'darts') loop
    n:=(dart->>'n')::int;m:=(dart->>'mult')::int;
    if n is null or m is null or not ((n=0 and m=0) or (n between 1 and 20 and m between 1 and 3) or (n=25 and m in (1,2))) or dart is distinct from jsonb_build_object('n',n,'mult',m) then raise exception 'TRAINING_INVALID_DART';end if;
    total:=total+n*m;
    if n<>0 then nonmiss:=nonmiss+1;
     if n=25 then color:=case m when 1 then 'green' else 'red' end;
     else pos:=array_position(board,n);color:=case when m=1 then case when pos%2=1 then 'black' else 'white' end else case when pos%2=1 then 'red' else 'green' end end;end if;
     if not(color=any(colors)) then colors:=array_append(colors,color);end if;
    end if;
    if (k='number' and n=target) or (k='double' and m=2) or (k='treble' and m=3) or (k='bull' and n=25) then pts:=pts+n*m;end if;
   end loop;
   if k='exact' and goal is null and nonmiss<>0 then raise exception 'TRAINING_INVALID_TARGET';end if;
   ok:=case k when 'same' then nonmiss=3 and cardinality(colors)=1 when 'different' then nonmiss=3 and cardinality(colors)=3 when 'exact' then coalesce(goal=total,false) when 'exact41' then nonmiss=3 and total=41 else pts>0 end;
   if k in ('same','different','exact','exact41') then pts:=case when ok then total else 0 end;end if;
   acc:=case when ok then acc+pts when v='standard' then (acc+1)/2 else acc/2 end;
   if h is distinct from jsonb_build_object('round',r,'target',label,'success',ok,'points',pts,'score',acc,'before',before_score,'darts',h->'darts') then raise exception 'TRAINING_INVALID_ROUND';end if;
  end loop;
  if s<>acc then raise exception 'TRAINING_INVALID_SCORE';end if;
 else raise exception 'TRAINING_INVALID_GAME';end if;
end;
$record$;
-- A narrow privileged trigger is required because authenticated clients insert
-- their own rows using RLS, and the validator schema must remain inaccessible.
create or replace function dartarena_training_internal.guard_record()
returns trigger language plpgsql security definer set search_path='' as $guard$
begin
 if auth.uid() is null or new.user_id is distinct from auth.uid() then raise exception 'TRAINING_ACCESS_DENIED';end if;
 perform dartarena_training_internal.validate_record(new.game,new.variant,new.score,new.details);
 new.created_at:=clock_timestamp();
 return new;
end;
$guard$;
revoke all on all functions in schema dartarena_training_internal from public,anon,authenticated;
-- Replace only the redundant old variant whitelist; preserve combined game/variant rule.
do $constraint$
declare c record; n integer:=0;
begin
 for c in select conname from pg_constraint where conrelid='public.personal_training_results'::regclass and contype='c'
 and pg_get_constraintdef(oid) like 'CHECK ((variant = ANY (%'
 loop execute format('alter table public.personal_training_results drop constraint %I',c.conname);n:=n+1;end loop;
 if n<>1 then raise exception 'TRAINING_UNEXPECTED_VARIANT_CONSTRAINT';end if;
end;
$constraint$;
create trigger dartarena_training_validate_record before insert on public.personal_training_results for each row execute function dartarena_training_internal.guard_record();
commit;
