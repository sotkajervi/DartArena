\set ON_ERROR_STOP on
create role anon;create role authenticated;
create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table public.matches(id uuid primary key,player1_id uuid,player2_id uuid,finished_at timestamptz,status text,deleted_at timestamptz,is_warmup boolean,game integer,game_variant text,game_config jsonb);
create table public.match_throws(match_id uuid,player_id uuid,set_no integer,leg_no integer,is_checkout boolean,score integer,darts_used integer);
create table public.tournaments(id uuid,status text,stats_enabled boolean,game integer,cup_game integer,game_variant text,cup_game_variant text);
create table public.tournament_matches(live_match_id uuid,tournament_id uuid,status text,player1_id uuid,player2_id uuid,stage text);
grant select on all tables in schema public to authenticated;
\ir ../supabase-lobby-form-avg.sql
insert into public.matches select md5(i::text)::uuid,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',now()+i*interval '1 minute','finished',null,false,case when i=23 then 301 else 501 end,'x01','{}' from generate_series(1,23) i;
insert into public.match_throws select md5(i::text)::uuid,'11111111-1111-4111-8111-111111111111',1,j,true,case when i<=2 then 10 else 60 end,3 from generate_series(1,23)i cross join lateral generate_series(1,case when i=22 then 5 else 6 end) j;
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$declare r record;begin select * into r from public.get_lobby_form_avg(array['11111111-1111-4111-8111-111111111111'::uuid]);if r.matches_count<>20 or r.form_avg<>57.50 then raise exception 'wrong result %',r;end if;end$$;
reset role;set role anon;
do $$begin begin perform public.get_lobby_form_avg(array[]::uuid[]);raise exception 'anon allowed';exception when insufficient_privilege then null;end;end$$;
