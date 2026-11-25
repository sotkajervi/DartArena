-- The existing username is the canonical public display name; UUIDs and old accounts stay intact.
begin;
alter table public.profiles add column if not exists nickname_changed_at timestamptz;
alter table public.player_details add column if not exists full_name text not null default '' check(char_length(full_name)<=80);
create unique index if not exists profiles_username_casefold_uidx on public.profiles(lower(btrim(username)));
revoke update on public.profiles from authenticated;
revoke update(id,created_at,nickname_changed_at) on public.profiles from authenticated;
grant update(username,status,last_seen) on public.profiles to authenticated;
grant insert(full_name),update(full_name) on public.player_details to authenticated;
create schema if not exists dartarena_identity_private;
revoke all on schema dartarena_identity_private from public,anon,authenticated;
create or replace function dartarena_identity_private.valid_nick(n text) returns boolean
language sql immutable set search_path='' as $$
 select n is not null and n=btrim(n) and char_length(n) between 2 and 24
 and n ~ '^[[:alnum:]][[:alnum:]_.-]*$'
 and lower(n) not in ('admin','owner','moderator','dartarena','support','system','administrator')
$$;
create or replace function dartarena_identity_private.guard_name() returns trigger language plpgsql set search_path='' as $$
begin
 if new.username is distinct from old.username then
   if not dartarena_identity_private.valid_nick(new.username) then raise exception 'invalid_nickname' using errcode='22023';end if;
   if old.nickname_changed_at is not null and old.nickname_changed_at>now()-interval '30 days' and not (select public.is_admin()) then raise exception 'nickname_cooldown' using errcode='22023';end if;
   new.nickname_changed_at=now();
 end if;
 return new;
end$$;
create trigger dartarena_nickname_guard before update of username on public.profiles for each row execute function dartarena_identity_private.guard_name();
-- Trigger helper executes under the ordinary updating role. Give only the validation helper needed by the trigger.
grant usage on schema dartarena_identity_private to authenticated;
revoke all on function dartarena_identity_private.valid_nick(text) from public,anon;
grant execute on function dartarena_identity_private.valid_nick(text) to authenticated;
revoke all on function dartarena_identity_private.guard_name() from public,anon,authenticated;
-- Preserve existing signup contract for already-cached clients; new clients explicitly mark nickname registration.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare n text:=coalesce(new.raw_user_meta_data->>'username','Player-'||substr(new.id::text,1,8));
begin
 if new.raw_user_meta_data->>'nickname_signup'='true' then
   n=btrim(n);
   if not dartarena_identity_private.valid_nick(n) then raise exception 'invalid_nickname' using errcode='22023';end if;
   insert into public.profiles(id,username,status,nickname_changed_at) values(new.id,n,'unavailable',now());
   insert into public.player_details(user_id,nickname) values(new.id,n);
 else
   insert into public.profiles(id,username,status) values(new.id,n,'unavailable');
 end if;
 return new;
end$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
-- Save profile and display name atomically, under existing owner RLS.
create or replace function public.save_player_identity(p_nickname text,p_country text,p_club text,p_equipment text,p_bio text,p_full_name text)
returns text language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); n text:=btrim(coalesce(p_nickname,'')); shown text; changed timestamptz;
begin
 if uid is null then raise exception 'authentication_required' using errcode='42501';end if;
 select username,nickname_changed_at into shown,changed from public.profiles where id=uid;
 if not found then raise exception 'profile_not_found';end if;
 if n='' and changed is not null then n:=shown;end if;
 if n<>'' and n is distinct from shown then update public.profiles set username=n where id=uid returning username into shown;end if;
 insert into public.player_details(user_id,nickname,country,club,equipment,bio,full_name)
 values(uid,n,btrim(coalesce(p_country,'')),btrim(coalesce(p_club,'')),btrim(coalesce(p_equipment,'')),btrim(coalesce(p_bio,'')),btrim(coalesce(p_full_name,'')))
 on conflict(user_id) do update set nickname=excluded.nickname,country=excluded.country,club=excluded.club,equipment=excluded.equipment,bio=excluded.bio,full_name=excluded.full_name;
 return shown;
end$$;
revoke all on function public.save_player_identity(text,text,text,text,text,text) from public,anon;
grant execute on function public.save_player_identity(text,text,text,text,text,text) to authenticated;
-- Narrow privileged edit path for staff. No broad UPDATE policy on profiles.
create table dartarena_identity_private.staff_profile_edits(
 id bigint generated always as identity primary key,
 actor_id uuid not null,target_id uuid not null,edited_at timestamptz not null default now(),
 action text not null check(action in ('profile','avatar'))
);
revoke all on dartarena_identity_private.staff_profile_edits from public,anon,authenticated;
create or replace function dartarena_identity_private.staff_save(p_user_id uuid,p_nickname text,p_country text,p_club text,p_equipment text,p_bio text,p_full_name text)
returns text language plpgsql security definer set search_path='' as $
declare actor uuid:=auth.uid(); n text:=btrim(coalesce(p_nickname,'')); shown text; changed timestamptz;
begin
 if actor is null or not (select public.is_admin()) then raise exception 'staff_required' using errcode='42501';end if;
 select username,nickname_changed_at into shown,changed from public.profiles where id=p_user_id for update;
 if not found then raise exception 'profile_not_found';end if;
 if n='' and changed is not null then n:=shown;end if;
 if n<>'' and n is distinct from shown then update public.profiles set username=n where id=p_user_id returning username into shown;end if;
 insert into public.player_details(user_id,nickname,country,club,equipment,bio,full_name)
 values(p_user_id,n,btrim(coalesce(p_country,'')),btrim(coalesce(p_club,'')),btrim(coalesce(p_equipment,'')),btrim(coalesce(p_bio,'')),btrim(coalesce(p_full_name,'')))
 on conflict(user_id) do update set nickname=excluded.nickname,country=excluded.country,club=excluded.club,equipment=excluded.equipment,bio=excluded.bio,full_name=excluded.full_name;
 insert into dartarena_identity_private.staff_profile_edits(actor_id,target_id,action) values(actor,p_user_id,'profile');
 return shown;
end$;
revoke all on function dartarena_identity_private.staff_save(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function dartarena_identity_private.staff_save(uuid,text,text,text,text,text,text) to authenticated;
create or replace function public.staff_save_player_identity(p_user_id uuid,p_nickname text,p_country text,p_club text,p_equipment text,p_bio text,p_full_name text)
returns text language sql security invoker set search_path='' as $
 select dartarena_identity_private.staff_save(p_user_id,p_nickname,p_country,p_club,p_equipment,p_bio,p_full_name)
$;
revoke all on function public.staff_save_player_identity(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.staff_save_player_identity(uuid,text,text,text,text,text,text) to authenticated;
-- Private JPEG-only bucket. Owners and staff can upload and remove profile images.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('player-avatars','player-avatars',false,102400,array['image/jpeg']) on conflict(id) do nothing;
create policy da_avatar_read on storage.objects for select to authenticated using(bucket_id='player-avatars' and (select auth.uid()) is not null);
create policy da_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='player-avatars' and (name=(select auth.uid())::text||'/avatar.jpg' or ((select public.is_admin()) and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar[.]jpg on storage.objects for update to authenticated using(bucket_id='player-avatars' and (name=(select auth.uid())::text||'/avatar.jpg' or ((select public.is_admin()) and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar[.]jpg
create policy da_avatar_delete on storage.objects for delete to authenticated using(bucket_id='player-avatars' and (name=(select auth.uid())::text||'/avatar.jpg' or (select public.is_admin())));
create table public.player_avatars(user_id uuid primary key references public.profiles(id) on delete cascade,updated_at timestamptz not null default now());
alter table public.player_avatars enable row level security;
revoke all on public.player_avatars from public,anon,authenticated;
grant select,insert,update,delete on public.player_avatars to authenticated;
create policy avatar_meta_read on public.player_avatars for select to authenticated using((select auth.uid()) is not null);
create policy avatar_meta_insert on public.player_avatars for insert to authenticated with check(user_id=(select auth.uid()) or (select public.is_admin()));
create policy avatar_meta_update on public.player_avatars for update to authenticated using(user_id=(select auth.uid()) or (select public.is_admin())) with check(user_id=(select auth.uid()) or (select public.is_admin()));
create policy avatar_meta_delete on public.player_avatars for delete to authenticated using(user_id=(select auth.uid()) or (select public.is_admin()));
-- Record staff avatar metadata changes, without copying images or personal profile text.
create or replace function dartarena_identity_private.log_avatar_edit() returns trigger language plpgsql security definer set search_path='' as $
declare actor uuid:=auth.uid(); target uuid;
begin
 if tg_op='DELETE' then target:=old.user_id;else target:=new.user_id;end if;
 if actor is not null and actor<>target and (select public.is_admin()) then
  insert into dartarena_identity_private.staff_profile_edits(actor_id,target_id,action) values(actor,target,'avatar');
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end$;
revoke all on function dartarena_identity_private.log_avatar_edit() from public,anon,authenticated;
create trigger da_log_staff_avatar after insert or update or delete on public.player_avatars for each row execute function dartarena_identity_private.log_avatar_edit();
commit;
)));
create policy da_avatar_update on storage.objects for update to authenticated using(bucket_id='player-avatars' and name=(select auth.uid())::text||'/avatar.jpg') with check(bucket_id='player-avatars' and name=(select auth.uid())::text||'/avatar.jpg');
create policy da_avatar_delete on storage.objects for delete to authenticated using(bucket_id='player-avatars' and (name=(select auth.uid())::text||'/avatar.jpg' or (select public.is_admin())));
create table public.player_avatars(user_id uuid primary key references public.profiles(id) on delete cascade,updated_at timestamptz not null default now());
alter table public.player_avatars enable row level security;
revoke all on public.player_avatars from public,anon,authenticated;
grant select,insert,update,delete on public.player_avatars to authenticated;
create policy avatar_meta_read on public.player_avatars for select to authenticated using((select auth.uid()) is not null);
create policy avatar_meta_insert on public.player_avatars for insert to authenticated with check(user_id=(select auth.uid()));
create policy avatar_meta_update on public.player_avatars for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy avatar_meta_delete on public.player_avatars for delete to authenticated using(user_id=(select auth.uid()) or (select public.is_admin()));
commit;
))) with check(bucket_id='player-avatars' and (name=(select auth.uid())::text||'/avatar.jpg' or ((select public.is_admin()) and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar[.]jpg
create policy da_avatar_delete on storage.objects for delete to authenticated using(bucket_id='player-avatars' and (name=(select auth.uid())::text||'/avatar.jpg' or (select public.is_admin())));
create table public.player_avatars(user_id uuid primary key references public.profiles(id) on delete cascade,updated_at timestamptz not null default now());
alter table public.player_avatars enable row level security;
revoke all on public.player_avatars from public,anon,authenticated;
grant select,insert,update,delete on public.player_avatars to authenticated;
create policy avatar_meta_read on public.player_avatars for select to authenticated using((select auth.uid()) is not null);
create policy avatar_meta_insert on public.player_avatars for insert to authenticated with check(user_id=(select auth.uid()));
create policy avatar_meta_update on public.player_avatars for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy avatar_meta_delete on public.player_avatars for delete to authenticated using(user_id=(select auth.uid()) or (select public.is_admin()));
commit;
)));
create policy da_avatar_update on storage.objects for update to authenticated using(bucket_id='player-avatars' and name=(select auth.uid())::text||'/avatar.jpg') with check(bucket_id='player-avatars' and name=(select auth.uid())::text||'/avatar.jpg');
create policy da_avatar_delete on storage.objects for delete to authenticated using(bucket_id='player-avatars' and (name=(select auth.uid())::text||'/avatar.jpg' or (select public.is_admin())));
create table public.player_avatars(user_id uuid primary key references public.profiles(id) on delete cascade,updated_at timestamptz not null default now());
alter table public.player_avatars enable row level security;
revoke all on public.player_avatars from public,anon,authenticated;
grant select,insert,update,delete on public.player_avatars to authenticated;
create policy avatar_meta_read on public.player_avatars for select to authenticated using((select auth.uid()) is not null);
create policy avatar_meta_insert on public.player_avatars for insert to authenticated with check(user_id=(select auth.uid()));
create policy avatar_meta_update on public.player_avatars for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy avatar_meta_delete on public.player_avatars for delete to authenticated using(user_id=(select auth.uid()) or (select public.is_admin()));
commit;
)));
create policy da_avatar_delete on storage.objects for delete to authenticated using(bucket_id='player-avatars' and (name=(select auth.uid())::text||'/avatar.jpg' or (select public.is_admin())));
create table public.player_avatars(user_id uuid primary key references public.profiles(id) on delete cascade,updated_at timestamptz not null default now());
alter table public.player_avatars enable row level security;
revoke all on public.player_avatars from public,anon,authenticated;
grant select,insert,update,delete on public.player_avatars to authenticated;
create policy avatar_meta_read on public.player_avatars for select to authenticated using((select auth.uid()) is not null);
create policy avatar_meta_insert on public.player_avatars for insert to authenticated with check(user_id=(select auth.uid()));
create policy avatar_meta_update on public.player_avatars for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy avatar_meta_delete on public.player_avatars for delete to authenticated using(user_id=(select auth.uid()) or (select public.is_admin()));
commit;
)));
create policy da_avatar_update on storage.objects for update to authenticated using(bucket_id='player-avatars' and name=(select auth.uid())::text||'/avatar.jpg') with check(bucket_id='player-avatars' and name=(select auth.uid())::text||'/avatar.jpg');
create policy da_avatar_delete on storage.objects for delete to authenticated using(bucket_id='player-avatars' and (name=(select auth.uid())::text||'/avatar.jpg' or (select public.is_admin())));
create table public.player_avatars(user_id uuid primary key references public.profiles(id) on delete cascade,updated_at timestamptz not null default now());
alter table public.player_avatars enable row level security;
revoke all on public.player_avatars from public,anon,authenticated;
grant select,insert,update,delete on public.player_avatars to authenticated;
create policy avatar_meta_read on public.player_avatars for select to authenticated using((select auth.uid()) is not null);
create policy avatar_meta_insert on public.player_avatars for insert to authenticated with check(user_id=(select auth.uid()));
create policy avatar_meta_update on public.player_avatars for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy avatar_meta_delete on public.player_avatars for delete to authenticated using(user_id=(select auth.uid()) or (select public.is_admin()));
commit;
