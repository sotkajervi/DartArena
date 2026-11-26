-- Online participation suspension. Historical records and local practice are not deleted.
begin;
create table public.player_suspensions(
 id uuid primary key default gen_random_uuid(),
 player_id uuid not null,
 imposed_by uuid not null,
 imposed_at timestamptz not null default now(),
 ends_at timestamptz,
 reason text not null check(char_length(btrim(reason)) between 1 and 1000),
 revoked_at timestamptz,
 revoked_by uuid,
 revocation_reason text check(revocation_reason is null or char_length(btrim(revocation_reason)) between 1 and 1000),
 check(ends_at is null or ends_at>imposed_at)
);
create index player_suspensions_player_idx on public.player_suspensions(player_id,imposed_at desc);
alter table public.player_suspensions enable row level security;
revoke all on public.player_suspensions from public,anon,authenticated;
grant select on public.player_suspensions to authenticated;
create policy suspension_staff_read on public.player_suspensions for select to authenticated using((select public.is_admin()));
create function dartarena_moderation_private.is_suspended(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $body$
 select exists(select 1 from public.player_suspensions s where s.player_id=p_id and s.revoked_at is null and (s.ends_at is null or s.ends_at>now()))
$body$;
revoke all on function dartarena_moderation_private.is_suspended(uuid) from public,anon,authenticated;
create function dartarena_moderation_private.suspension_key(p_id uuid) returns bigint
language sql immutable strict set search_path='' as $body$ select pg_catalog.hashtextextended(p_id::text,276411) $body$;
revoke all on function dartarena_moderation_private.suspension_key(uuid) from public,anon,authenticated;
create function dartarena_moderation_private.own_suspension() returns jsonb
language sql stable security definer set search_path='' as $body$
 select coalesce((select jsonb_build_object('active',true,'ends_at',ends_at,'reason',reason) from public.player_suspensions where player_id=auth.uid() and revoked_at is null and (ends_at is null or ends_at>now()) order by imposed_at desc limit 1),'{"active":false}'::jsonb)
$body$;
revoke all on function dartarena_moderation_private.own_suspension() from public,anon,authenticated;
grant execute on function dartarena_moderation_private.own_suspension() to authenticated;
create function public.get_my_suspension() returns jsonb language sql stable security invoker set search_path='' as $body$
 select dartarena_moderation_private.own_suspension()
$body$;
revoke all on function public.get_my_suspension() from public,anon;
grant execute on function public.get_my_suspension() to authenticated;
create function dartarena_moderation_private.manage_suspension(p_player_id uuid,p_action text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $body$
declare actor uuid:=auth.uid();sid uuid;expiry timestamptz;
begin
 if actor is null or not coalesce(public.is_admin(),false) then raise exception 'staff_required' using errcode='42501';end if;
 if p_player_id is null or p_player_id=actor or not exists(select 1 from public.profiles where id=p_player_id) or exists(select 1 from public.user_roles where user_id=p_player_id and role in ('admin','owner')) then raise exception 'protected_player' using errcode='42501';end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 or p_action is null or p_action not in ('24h','7d','30d','permanent','revoke') then raise exception 'invalid_suspension' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(dartarena_moderation_private.suspension_key(p_player_id));
 if p_action='revoke' then
  update public.player_suspensions set revoked_at=now(),revoked_by=actor,revocation_reason=btrim(p_reason)
   where player_id=p_player_id and revoked_at is null and (ends_at is null or ends_at>now()) returning id into sid;
  if sid is null then raise exception 'no_active_suspension' using errcode='22023';end if;
  return sid;
 end if;
 if dartarena_moderation_private.is_suspended(p_player_id) then raise exception 'already_suspended' using errcode='22023';end if;
 if exists(select 1 from public.matches where deleted_at is null and status in ('waiting','playing') and p_player_id in (player1_id,player2_id))
 or exists(select 1 from public.challenges where status='room' and p_player_id in (challenger_id,challenged_id))
 or exists(select 1 from public.tournaments t where t.status not in ('finished','cancelled') and (t.owner_id=p_player_id or exists(select 1 from public.tournament_members m where m.tournament_id=t.id and m.user_id=p_player_id) or exists(select 1 from public.tournament_group_players g where g.tournament_id=t.id and g.user_id=p_player_id) or exists(select 1 from public.tournament_matches tm where tm.tournament_id=t.id and p_player_id in (tm.player1_id,tm.player2_id))))
 then raise exception 'active_play' using errcode='22023';end if;
 expiry:=case p_action when '24h' then now()+interval '24 hours' when '7d' then now()+interval '7 days' when '30d' then now()+interval '30 days' else null end;
 insert into public.player_suspensions(player_id,imposed_by,ends_at,reason) values(p_player_id,actor,expiry,btrim(p_reason)) returning id into sid;
 update public.profiles set status='unavailable',last_seen=least(last_seen,now()-interval '10 minutes') where id=p_player_id;
 return sid;
end $body$;
revoke all on function dartarena_moderation_private.manage_suspension(uuid,text,text) from public,anon,authenticated;
grant execute on function dartarena_moderation_private.manage_suspension(uuid,text,text) to authenticated;
create function public.manage_player_suspension(p_player_id uuid,p_action text,p_reason text) returns uuid
language sql security invoker set search_path='' as $body$ select dartarena_moderation_private.manage_suspension(p_player_id,p_action,p_reason) $body$;
revoke all on function public.manage_player_suspension(uuid,text,text) from public,anon;
grant execute on function public.manage_player_suspension(uuid,text,text) to authenticated;
-- Guard all write paths below, including SECURITY DEFINER match creation.
-- Shared try-locks do not serialize normal scoring; only a concurrent moderation action is exclusive.
create function dartarena_moderation_private.require_active(p_id uuid) returns void
language plpgsql security definer set search_path='' as $body$
begin
 if p_id is null then return;end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(dartarena_moderation_private.suspension_key(p_id)) or dartarena_moderation_private.is_suspended(p_id) then raise exception 'Online participation unavailable' using errcode='42501';end if;
end $body$;
revoke all on function dartarena_moderation_private.require_active(uuid) from public,anon,authenticated;
create function dartarena_moderation_private.guard_online_suspension() returns trigger
language plpgsql security definer set search_path='' as $body$
begin
 if tg_table_name='challenges' then
  if tg_op='INSERT' then
   perform dartarena_moderation_private.require_active(new.challenger_id);perform dartarena_moderation_private.require_active(new.challenged_id);
  elsif new.status='room' and old.status is distinct from new.status then
   perform dartarena_moderation_private.require_active(new.challenger_id);perform dartarena_moderation_private.require_active(new.challenged_id);
  end if;
 elsif tg_table_name='matches' then
  perform dartarena_moderation_private.require_active(auth.uid());
  if tg_op='INSERT' then
   if new.status in ('waiting','playing') then perform dartarena_moderation_private.require_active(new.player1_id);perform dartarena_moderation_private.require_active(new.player2_id);end if;
  elsif new.status in ('waiting','playing') and old.status is distinct from new.status then
   perform dartarena_moderation_private.require_active(new.player1_id);perform dartarena_moderation_private.require_active(new.player2_id);
  end if;
 elsif tg_table_name='tournament_members' or tg_table_name='tournament_group_players' then
  perform dartarena_moderation_private.require_active(auth.uid());
  if tg_op='INSERT' then perform dartarena_moderation_private.require_active(new.user_id);end if;
 elsif tg_table_name='tournaments' then
  perform dartarena_moderation_private.require_active(auth.uid());
  if tg_op='INSERT' then perform dartarena_moderation_private.require_active(new.owner_id);end if;
 elsif tg_table_name='tournament_matches' then
  perform dartarena_moderation_private.require_active(auth.uid());
  if tg_op<>'DELETE' then
   if new.status='live' then perform dartarena_moderation_private.require_active(new.player1_id);perform dartarena_moderation_private.require_active(new.player2_id);end if;
  end if;
 elsif tg_table_name='lobby_messages' then
  perform dartarena_moderation_private.require_active(new.sender_id);
 else
  perform dartarena_moderation_private.require_active(auth.uid());
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $body$;
revoke all on function dartarena_moderation_private.guard_online_suspension() from public,anon,authenticated;
create trigger suspension_challenges before insert or update of status on public.challenges for each row execute function dartarena_moderation_private.guard_online_suspension();
create trigger suspension_matches before insert or update on public.matches for each row execute function dartarena_moderation_private.guard_online_suspension();
create trigger suspension_chat before insert on public.lobby_messages for each row execute function dartarena_moderation_private.guard_online_suspension();
create trigger suspension_tournaments before insert or update or delete on public.tournaments for each row execute function dartarena_moderation_private.guard_online_suspension();
create trigger suspension_tournament_members before insert or update or delete on public.tournament_members for each row execute function dartarena_moderation_private.guard_online_suspension();
create trigger suspension_tournament_group_players before insert or update or delete on public.tournament_group_players for each row execute function dartarena_moderation_private.guard_online_suspension();
create trigger suspension_tournament_matches before insert or update or delete on public.tournament_matches for each row execute function dartarena_moderation_private.guard_online_suspension();
-- Game-specific writes, proposals, and tournament management.
do $body$ declare tab text;begin
 foreach tab in array array['challenge_match_proposals','match_throws','cricket_match_state','cricket_visits','half_it_match_state','half_it_visits','sixty_one_match_state','sixty_one_visits','jdc_match_turns','tournament_groups','tournament_ai_rivals','tournament_ai_group_matches','pentathlon_room_tests'] loop
 execute format('create trigger suspension_online_write before insert or update or delete on public.%I for each row execute function dartarena_moderation_private.guard_online_suspension()',tab);
 end loop;
end $body$;
create function dartarena_moderation_private.suspended_presence() returns trigger
language plpgsql security definer set search_path='' as $body$
begin
 if dartarena_moderation_private.is_suspended(new.id) then
  new.status:='unavailable';new.last_seen:=least(new.last_seen,now()-interval '10 minutes');
 end if;
 return new;
end $body$;
revoke all on function dartarena_moderation_private.suspended_presence() from public,anon,authenticated;
create trigger suspension_presence before update of status,last_seen on public.profiles for each row execute function dartarena_moderation_private.suspended_presence();
commit;
