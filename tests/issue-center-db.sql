\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='22222222-2222-4222-8222-222222222222'::uuid$$;
grant execute on function public.is_admin() to authenticated;
\ir ../supabase-issue-center.sql
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into public.issue_reports(category,description,page) values ('video','Test','match.html');
do $$begin
 if (select count(*) from public.issue_reports)<>0 then raise exception 'ordinary user can read reports'; end if;
 begin insert into public.issue_reports(user_id,category,description,page) values ('22222222-2222-4222-8222-222222222222','other','spoof','index.html');raise exception 'spoof succeeded';exception when insufficient_privilege then null;end;
 begin update public.issue_reports set status='resolved';if found then raise exception 'ordinary user update succeeded';end if;end;
end$$;
insert into public.issue_reports(category,description,page) select 'other','Test','index.html' from generate_series(1,4);
do $$begin
 begin insert into public.issue_reports(category,description,page) values ('other','sixth','index.html');raise exception 'rate limit failed' using errcode='XX000';exception when sqlstate 'P0001' then null;end;
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$begin if (select count(*) from public.issue_reports)<>5 then raise exception 'admin cannot read';end if;end$$;
update public.issue_reports set status='resolved',internal_note='verified';
do $$begin if (select count(*) from public.issue_reports where status='resolved')<>5 then raise exception 'admin cannot update';end if;end$$;
reset role;
set role anon;
do $$begin
 begin perform count(*) from public.issue_reports;raise exception 'anon read succeeded';exception when insufficient_privilege then null;end;
 begin insert into public.issue_reports(category,description,page) values ('other','anon','index.html');raise exception 'anon insert succeeded';exception when insufficient_privilege then null;end;
end$$;
reset role;
