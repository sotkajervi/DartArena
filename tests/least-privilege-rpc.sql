\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.matches(id uuid primary key,player1_id uuid,player2_id uuid,turn_player_id uuid,status text,game_variant text,deleted_at timestamptz,updated_at timestamptz,game_config jsonb);
create table public.practice_matches(id text primary key);
alter table public.practice_matches enable row level security;
grant select,insert,update on public.practice_matches to anon;
create function public.submit_x01_visit(uuid,integer) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('route','submit_x01_visit','signature',0)$$;
revoke execute on function public.submit_x01_visit(uuid,integer) from public;
grant execute on function public.submit_x01_visit(uuid,integer) to authenticated,service_role;
create function public.submit_match_checkout(uuid,integer,integer) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('route','submit_match_checkout','signature',1)$$;
revoke execute on function public.submit_match_checkout(uuid,integer,integer) from public;
grant execute on function public.submit_match_checkout(uuid,integer,integer) to authenticated,service_role;
create function public.submit_chicago_x01_visit(uuid,integer) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('route','submit_chicago_x01_visit','signature',2)$$;
revoke execute on function public.submit_chicago_x01_visit(uuid,integer) from public;
grant execute on function public.submit_chicago_x01_visit(uuid,integer) to authenticated,service_role;
create function public.submit_chicago_checkout(uuid,integer,integer) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('route','submit_chicago_checkout','signature',3)$$;
revoke execute on function public.submit_chicago_checkout(uuid,integer,integer) from public;
grant execute on function public.submit_chicago_checkout(uuid,integer,integer) to authenticated,service_role;
create function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('route','propose_challenge_match','signature',4)$$;
revoke execute on function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb) from public;
grant execute on function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb) to authenticated,service_role;
create function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb,boolean) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('route','propose_challenge_match','signature',5)$$;
revoke execute on function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb,boolean) from public;
grant execute on function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb,boolean) to authenticated,service_role;
create function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb,boolean,boolean) returns jsonb language sql security definer set search_path='' as $$select '{}'::jsonb$$;
revoke execute on function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb,boolean,boolean) from public;
grant execute on function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb,boolean,boolean) to authenticated,service_role;
\ir ../supabase-x01-score-revision-guard-20261121.sql
\ir ../supabase-least-privilege-rpc-20261126.sql
insert into public.matches values
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000011','playing','x01',null,'2026-01-01Z','{}'),
('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000011','playing','x01',null,'2026-01-01Z','{"chicago":true}');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',false);
do $$declare x jsonb; m uuid:='00000000-0000-4000-8000-000000000001'; c uuid:='00000000-0000-4000-8000-000000000002'; t timestamptz:='2026-01-01Z'; begin
 if public.submit_x01_checked(m,60,t)->>'route' is distinct from 'submit_x01_visit' then raise exception 'X01 visit route';end if;
 if public.submit_x01_checked(m,40,t,1)->>'route' is distinct from 'submit_match_checkout' then raise exception 'X01 checkout route';end if;
 if public.submit_x01_checked(c,60,t)->>'route' is distinct from 'submit_chicago_x01_visit' then raise exception 'Chicago visit route';end if;
 if public.submit_x01_checked(c,40,t,1)->>'route' is distinct from 'submit_chicago_checkout' then raise exception 'Chicago checkout route';end if;
 begin perform public.submit_x01_visit(m,60);raise exception 'legacy RPC accepted';exception when insufficient_privilege then null;end;
 begin perform public.submit_x01_checked(m,60,t-interval '1 second');raise exception 'stale accepted';exception when raise_exception then if sqlerrm<>'DA_STALE_SCORE_STATE' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);
 begin perform public.submit_x01_checked(m,60,t);raise exception 'wrong turn accepted';exception when raise_exception then if sqlerrm<>'DA_INVALID_SCORE_TURN' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',false);
 begin perform public.submit_x01_checked(m,60,t);raise exception 'outsider accepted';exception when raise_exception then if sqlerrm<>'Match access denied' then raise;end if;end;
end $$;
reset role;
\ir ../supabase-least-privilege-rpc-rollback-20261126.sql
do $$ begin if not has_function_privilege('authenticated','public.submit_x01_visit(uuid,integer)','EXECUTE') then raise exception 'rollback failed';end if;end $$;
