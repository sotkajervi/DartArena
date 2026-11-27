\set ON_ERROR_STOP on
\ir player-identity-db.sql
reset role;
create table public.lobby_messages(body text not null check(char_length(btrim(body)) between 1 and 500));
create table public.tournaments(name text not null check(char_length(btrim(name)) between 2 and 80));
create table public.player_reports(description text not null check(char_length(btrim(description)) between 1 and 2000));
create table public.issue_reports(description text not null check(char_length(btrim(description)) between 1 and 2000));
\ir ../supabase-user-text-hardening-20261127.sql
do $test$
declare meta jsonb; uid uuid; tbl text; col text; lim int;
begin
 for meta in select value from jsonb_array_elements('[{"username":"Owner"},{"username":"Bad Name","nickname_signup":false},{"username":"<img>","nickname_signup":true},{"username":"a"},{"username":"abcdefghijklmnopqrstuvwxyz"}]'::jsonb) loop
   uid:=gen_random_uuid();
   begin
     insert into auth.users values(uid,meta);
     raise exception 'invalid signup accepted: %',meta;
   exception when invalid_parameter_value then null;
   end;
   if exists(select 1 from auth.users where id=uid) or exists(select 1 from public.profiles where id=uid) then raise exception 'failed signup persisted';end if;
 end loop;
 uid:=gen_random_uuid();
 insert into auth.users values(uid,'{"username":"ValidNick"}');
 if not exists(select 1 from public.player_details where user_id=uid and nickname='ValidNick') then raise exception 'missing profile details';end if;
 uid:=gen_random_uuid();
 insert into auth.users values(uid,'{}');
 if not exists(select 1 from public.profiles where id=uid and username='Player-'||substr(uid::text,1,8)) then raise exception 'generated nickname failed';end if;
 if (select username from public.profiles where id='22222222-2222-4222-8222-222222222222')<>'Other Name' then raise exception 'legacy name changed';end if;
 if has_function_privilege('anon','public.handle_new_user()','execute') or has_function_privilege('authenticated','public.handle_new_user()','execute') then raise exception 'trigger became callable';end if;
 for tbl,col,lim in select * from (values ('lobby_messages','body',500),('tournaments','name',80),('player_reports','description',2000),('issue_reports','description',2000)) v loop
   execute format('insert into public.%I(%I) values($1)',tbl,col) using repeat('a',lim);
   begin
     execute format('insert into public.%I(%I) values($1)',tbl,col) using 'ok'||repeat(' ',lim);
     raise exception 'padded length bypass allowed: %',tbl;
   exception when check_violation then null;
   end;
 end loop;
 raise notice 'PASS: 5 invalid signups rejected, valid and fallback signup, legacy name, trigger ACL and 4 raw limits';
end $test$;
\ir ../supabase-user-text-hardening-rollback-20261127.sql
do $test$ begin
 if exists(select 1 from pg_constraint where conname in ('da_chat_body_raw_limit','da_tournament_name_raw_limit','da_player_report_raw_limit','da_issue_report_raw_limit')) then raise exception 'rollback left constraints';end if;
 if position('nickname_signup' in pg_get_functiondef('public.handle_new_user()'::regprocedure))=0 then raise exception 'rollback failed';end if;
end $test$;
