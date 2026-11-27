\set ON_ERROR_STOP on
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.challenges(id uuid,status text,challenger_id uuid,challenged_id uuid);
create table public.matches(id uuid,status text,deleted_at timestamptz,player1_id uuid,player2_id uuid,is_live boolean);
create table public.tournament_matches(id uuid,status text,player1_id uuid,player2_id uuid);
insert into public.challenges values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','room','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
insert into public.matches values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','playing',null,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',false),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','playing',null,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',true),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','finished',null,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',true),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','playing',now(),'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',true);
insert into public.tournament_matches values ('ffffffff-ffff-4fff-8fff-ffffffffffff','pending','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
grant select on public.challenges,public.matches,public.tournament_matches to authenticated;
\ir ../supabase-sfu-intent-hardening-20261127.sql
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$begin
 if not public.can_access_sfu_room('challenge','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish') then raise exception 'challenge denied';end if;
 if not public.can_access_sfu_room('match','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','publish') then raise exception 'player denied';end if;
 if not public.can_access_sfu_room('tournament_match','ffffffff-ffff-4fff-8fff-ffffffffffff','subscribe') then raise exception 'tournament player denied';end if;
 if public.can_access_sfu_room('match','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null) or public.can_access_sfu_room('challenge','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null) or public.can_access_sfu_room('tournament_match','ffffffff-ffff-4fff-8fff-ffffffffffff',null) then raise exception 'NULL action accepted';end if;
 if public.can_access_sfu_room('match','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','invalid') then raise exception 'invalid action accepted';end if;
 if public.can_access_sfu_room('match','dddddddd-dddd-4ddd-8ddd-dddddddddddd','subscribe') or public.can_access_sfu_room('match','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','subscribe') then raise exception 'finished/deleted match allowed';end if;
end$$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$begin
 if public.can_access_sfu_room('challenge','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','subscribe') or public.can_access_sfu_room('match','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','subscribe') or public.can_access_sfu_room('tournament_match','ffffffff-ffff-4fff-8fff-ffffffffffff','publish') then raise exception 'foreign room allowed';end if;
 if not public.can_access_sfu_room('match','cccccccc-cccc-4ccc-8ccc-cccccccccccc','subscribe') then raise exception 'live spectator denied';end if;
 if public.can_access_sfu_room('match','cccccccc-cccc-4ccc-8ccc-cccccccccccc','publish') then raise exception 'spectator publish allowed';end if;
end$$;
select set_config('request.jwt.claim.sub','',false);
do $$begin if public.can_access_sfu_room('match','cccccccc-cccc-4ccc-8ccc-cccccccccccc','subscribe') then raise exception 'anonymous session allowed';end if;end$$;
reset role;
do $$begin if has_function_privilege('anon','public.can_access_sfu_room(text,uuid,text)','execute') then raise exception 'anon RPC executable';end if;end$$;
select 'PASS: SFU intent and room authorization matrix' as result;
