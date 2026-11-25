\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.profiles(id uuid primary key);
insert into public.profiles values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
\ir ../supabase-player-details.sql
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into public.player_details(user_id,club) values(auth.uid(),'Club A');
insert into public.player_details(user_id,club) values(auth.uid(),'Club B') on conflict(user_id) do update set user_id=excluded.user_id,club=excluded.club;
do $$begin
 if (select club from public.player_details where user_id=auth.uid())<>'Club B' then raise exception 'own upsert failed';end if;
 begin insert into public.player_details(user_id) values('22222222-2222-4222-8222-222222222222');raise exception 'spoof accepted';exception when insufficient_privilege then null;end;
 begin update public.player_details set user_id='22222222-2222-4222-8222-222222222222' where user_id=auth.uid();raise exception 'reassignment accepted';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$begin
 if (select count(*) from public.player_details)<>1 then raise exception 'profile not readable';end if;
 update public.player_details set club='bad';if found then raise exception 'other update allowed';end if;
end$$;
insert into public.player_details(user_id,bio) values(auth.uid(),'Other profile');
do $$begin
 begin update public.player_details set bio=repeat('x',301) where user_id=auth.uid();raise exception 'too long accepted';exception when check_violation then null;end;
end$$;
reset role;
set role anon;
do $$begin
 begin perform count(*) from public.player_details;raise exception 'anon read accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
