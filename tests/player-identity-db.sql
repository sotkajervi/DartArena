\set ON_ERROR_STOP on
create role anon;create role authenticated;
create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
create table public.profiles(id uuid primary key references auth.users(id),username text unique,status text default 'unavailable',last_seen timestamptz,created_at timestamptz default now());
alter table public.profiles enable row level security;
grant select,update on public.profiles to authenticated;
create policy read_profiles on public.profiles for select to authenticated using(true);
create policy edit_own on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create table public.player_details(user_id uuid primary key references public.profiles(id),nickname text default '',country text default '',club text default '',equipment text default '',bio text default '');
alter table public.player_details enable row level security;
grant select,insert,update on public.player_details to authenticated;
create policy read_details on public.player_details for select to authenticated using(true);
create policy insert_details on public.player_details for insert to authenticated with check(user_id=auth.uid());
create policy update_details on public.player_details for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create function public.is_admin() returns boolean language sql stable as $$select false$$;
create schema storage;grant usage on schema storage to authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;
insert into auth.users values('11111111-1111-4111-8111-111111111111','{}'),('22222222-2222-4222-8222-222222222222','{}');
insert into public.profiles(id,username) values('11111111-1111-4111-8111-111111111111','Old Name'),('22222222-2222-4222-8222-222222222222','Other Name');
\ir ../supabase-player-identity.sql
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into auth.users values('33333333-3333-4333-8333-333333333333','{"username":"NewNick","nickname_signup":true}');
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$begin
 if (select username from public.profiles where id=auth.uid())<>'Old Name' then raise exception 'legacy changed';end if;
 if public.save_player_identity('Ace','','','','','')<>'Ace' then raise exception 'save failed';end if;
 begin perform public.save_player_identity('NewAce','','','','','');raise exception 'cooldown failed';exception when invalid_parameter_value then null;end;
 if public.save_player_identity('','','','','','')<>'Ace' then raise exception 'blank reset';end if;
 insert into storage.objects values('player-avatars',auth.uid()::text||'/avatar.jpg');
 begin insert into storage.objects values('player-avatars','22222222-2222-4222-8222-222222222222/avatar.jpg');raise exception 'foreign upload allowed';exception when insufficient_privilege then null;end;
 insert into public.player_avatars(user_id) values(auth.uid());
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$declare n int;begin
 begin perform public.save_player_identity('ace','','','','','');raise exception 'duplicate allowed';exception when unique_violation then null;end;
 begin perform public.save_player_identity('Owner','','','','','');raise exception 'reserved allowed';exception when invalid_parameter_value then null;end;
 if (select count(*) from storage.objects)<>1 then raise exception 'avatar not readable';end if;
 delete from storage.objects;get diagnostics n=row_count;if n<>0 then raise exception 'foreign delete allowed';end if;
 delete from public.player_avatars;get diagnostics n=row_count;if n<>0 then raise exception 'foreign metadata delete allowed';end if;
end$$;
reset role;set role anon;
do $$begin begin perform public.save_player_identity('abc','','','','','');raise exception 'anon allowed';exception when insufficient_privilege then null;end;end$$;
