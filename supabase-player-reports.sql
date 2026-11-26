-- Separate confidential player reports. Existing technical reports are unchanged.
begin;
create schema if not exists dartarena_moderation_private;
revoke all on schema dartarena_moderation_private from public,anon,authenticated;
grant usage on schema dartarena_moderation_private to authenticated;
create table public.player_reports(
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null,
 target_id uuid not null,
 created_at timestamptz not null default now(),
 category text not null check(category in ('name','avatar','behavior','cheating','no_show','spam','other')),
 description text not null check(char_length(btrim(description)) between 1 and 2000),
 target_nickname text not null,
 target_full_name text not null default '',
 target_display_mode text not null default 'nick',
 reporter_nickname text not null,
 avatar_updated_at timestamptz,
 avatar_evidence text check(avatar_evidence is null or char_length(avatar_evidence)<=136536),
 status text not null default 'new' check(status in ('new','investigating','dismissed','resolved')),
 internal_note text not null default '' check(char_length(internal_note)<=2000),
 handled_by uuid,
 handled_at timestamptz,
 check(reporter_id<>target_id)
);
create index player_reports_reporter_time_idx on public.player_reports(reporter_id,created_at desc);
create index player_reports_status_time_idx on public.player_reports(status,created_at desc);
alter table public.player_reports enable row level security;
revoke all on public.player_reports from public,anon,authenticated;
grant select on public.player_reports to authenticated;
grant update(status,internal_note) on public.player_reports to authenticated;
create policy player_reports_staff_read on public.player_reports for select to authenticated using((select public.is_admin()) and target_id<>(select auth.uid()));
create policy player_reports_staff_update on public.player_reports for update to authenticated using((select public.is_admin()) and target_id<>(select auth.uid())) with check((select public.is_admin()) and target_id<>(select auth.uid()));
create table dartarena_moderation_private.report_audit(
 id bigint generated always as identity primary key,
 report_id uuid not null references public.player_reports(id) on delete cascade,
 actor_id uuid not null,
 changed_at timestamptz not null default now(),
 old_status text not null,new_status text not null,
 old_note text not null,new_note text not null
);
revoke all on dartarena_moderation_private.report_audit from public,anon,authenticated;
alter table dartarena_moderation_private.report_audit enable row level security;
create function dartarena_moderation_private.submit_report(p_target_id uuid,p_category text,p_description text,p_avatar_evidence text)
returns void language plpgsql security definer set search_path='' as $body$
declare actor uuid:=auth.uid();target_name text;reporter_name text;full_name text;mode text;avatar_at timestamptz;image_bytes bytea;
begin
 if actor is null or p_target_id is null or actor=p_target_id then raise exception 'invalid_report_target' using errcode='42501';end if;
 if p_category is null or p_category not in ('name','avatar','behavior','cheating','no_show','spam','other') or p_description is null or char_length(btrim(p_description)) not between 1 and 2000 then raise exception 'invalid_report' using errcode='22023';end if;
 select username into reporter_name from public.profiles where id=actor;
 select username into target_name from public.profiles where id=p_target_id;
 if reporter_name is null or target_name is null then raise exception 'invalid_report_target' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,765));
 if (select count(*) from public.player_reports where reporter_id=actor and created_at>now()-interval '10 minutes')>=3 or (select count(*) from public.player_reports where reporter_id=actor and created_at>now()-interval '24 hours')>=10 then raise exception 'report_rate_limit' using errcode='P0001';end if;
 select d.full_name,d.display_mode into full_name,mode from public.player_details d where d.user_id=p_target_id;
 select updated_at into avatar_at from public.player_avatars where user_id=p_target_id;
 if p_avatar_evidence is not null then
   if p_category<>'avatar' or avatar_at is null or char_length(p_avatar_evidence)>136536 or p_avatar_evidence !~ '^[A-Za-z0-9+/]+={0,2}$' then raise exception 'invalid_evidence' using errcode='22023';end if;
   image_bytes:=pg_catalog.decode(p_avatar_evidence,'base64');
   if octet_length(image_bytes) not between 4 and 102400 or substring(image_bytes from 1 for 3)<>pg_catalog.decode('ffd8ff','hex') then raise exception 'invalid_evidence' using errcode='22023';end if;
 end if;
 insert into public.player_reports(reporter_id,target_id,category,description,target_nickname,target_full_name,target_display_mode,reporter_nickname,avatar_updated_at,avatar_evidence)
 values(actor,p_target_id,p_category,btrim(p_description),target_name,coalesce(full_name,''),coalesce(mode,'nick'),reporter_name,avatar_at,p_avatar_evidence);
end $body$;
revoke all on function dartarena_moderation_private.submit_report(uuid,text,text,text) from public,anon,authenticated;
grant execute on function dartarena_moderation_private.submit_report(uuid,text,text,text) to authenticated;
create function public.submit_player_report(p_target_id uuid,p_category text,p_description text,p_avatar_evidence text default null)
returns void language sql security invoker set search_path='' as $body$
 select dartarena_moderation_private.submit_report(p_target_id,p_category,p_description,p_avatar_evidence)
$body$;
revoke all on function public.submit_player_report(uuid,text,text,text) from public,anon;
grant execute on function public.submit_player_report(uuid,text,text,text) to authenticated;
create function dartarena_moderation_private.audit_report() returns trigger language plpgsql security definer set search_path='' as $body$
begin
 if new.status is distinct from old.status or new.internal_note is distinct from old.internal_note then
  if auth.uid() is null or not (select public.is_admin()) then raise exception 'staff_required' using errcode='42501';end if;
  new.handled_by:=auth.uid();new.handled_at:=now();
  insert into dartarena_moderation_private.report_audit(report_id,actor_id,old_status,new_status,old_note,new_note)
  values(old.id,auth.uid(),old.status,new.status,old.internal_note,new.internal_note);
 end if;
 return new;
end $body$;
revoke all on function dartarena_moderation_private.audit_report() from public,anon,authenticated;
create trigger player_reports_audit before update of status,internal_note on public.player_reports for each row execute function dartarena_moderation_private.audit_report();
-- Evidence only, not report text; install schedule separately at release.
create function dartarena_moderation_private.purge_expired_evidence() returns bigint language plpgsql security invoker set search_path='' as $body$
declare n bigint;begin
 update public.player_reports set avatar_evidence=null where avatar_evidence is not null and created_at<=now()-interval '30 days';
 get diagnostics n=row_count;return n;
end $body$;
revoke all on function dartarena_moderation_private.purge_expired_evidence() from public,anon,authenticated;
commit;
