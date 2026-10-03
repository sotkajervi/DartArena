-- DartArena public beta security hardening - 2026-10-04
-- Applied to production Supabase project.
-- Safe intent: least privilege, anonymous access removal, abuse limits and safe JDC leaderboard reads.

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke create on schema public from anon, authenticated;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Remove default PUBLIC/anon execution from SECURITY DEFINER functions while preserving
-- existing authenticated API endpoints. Trigger-only functions remain internal and the
-- low-level match creator is explicitly excluded from browser access.
do $$
declare
  r record;
  v_auth_exec boolean;
begin
  for r in
    select p.oid, p.oid::regprocedure as signature, p.proname, p.prorettype
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    v_auth_exec := has_function_privilege('authenticated', r.oid, 'EXECUTE');
    execute format('revoke execute on function %s from public, anon', r.signature);

    if v_auth_exec
       and r.prorettype <> 'trigger'::regtype
       and r.proname <> 'create_match_from_challenge' then
      execute format('grant execute on function %s to authenticated', r.signature);
    end if;
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='create_match_from_challenge'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
  end loop;
end $$;

alter table public.challenges drop constraint if exists challenges_distinct_players_check;
alter table public.challenges add constraint challenges_distinct_players_check check (challenger_id <> challenged_id);
alter table public.challenges drop constraint if exists challenges_legs_public_check;
alter table public.challenges add constraint challenges_legs_public_check check (legs between 1 and 21 and mod(legs,2)=1);
alter table public.challenges drop constraint if exists challenges_starter_check;
alter table public.challenges add constraint challenges_starter_check check (starter in ('me','opponent','random'));

alter table public.client_error_logs drop constraint if exists client_error_logs_page_length_check;
alter table public.client_error_logs add constraint client_error_logs_page_length_check check (char_length(page) between 1 and 300);
alter table public.client_error_logs drop constraint if exists client_error_logs_message_length_check;
alter table public.client_error_logs add constraint client_error_logs_message_length_check check (char_length(message) between 1 and 4000);
alter table public.client_error_logs drop constraint if exists client_error_logs_source_length_check;
alter table public.client_error_logs add constraint client_error_logs_source_length_check check (source is null or char_length(source) <= 500);
alter table public.client_error_logs drop constraint if exists client_error_logs_user_agent_length_check;
alter table public.client_error_logs add constraint client_error_logs_user_agent_length_check check (user_agent is null or char_length(user_agent) <= 1000);

alter table public.match_signals drop constraint if exists match_signals_payload_size_check;
alter table public.match_signals add constraint match_signals_payload_size_check check (pg_column_size(payload) <= 65536);

create unique index if not exists challenges_one_pending_pair_idx
  on public.challenges(challenger_id, challenged_id)
  where status='pending';

create index if not exists challenges_rate_idx on public.challenges(challenger_id, created_at desc);
create index if not exists challenge_proposals_rate_idx on public.challenge_match_proposals(proposer_id, created_at desc);
create index if not exists lobby_messages_rate_idx on public.lobby_messages(sender_id, created_at desc);
create index if not exists tournaments_rate_idx on public.tournaments(owner_id, created_at desc);
create index if not exists client_error_logs_rate_idx on public.client_error_logs(user_id, created_at desc);
create index if not exists media_telemetry_rate_idx on public.match_media_telemetry(player_id, captured_at desc);
create index if not exists jdc_results_rate_idx on public.jdc_challenge_results(user_id, created_at desc);
create index if not exists match_signals_rate_idx on public.match_signals(sender_id, created_at desc);

create or replace function public.guard_dartarena_insert_rate()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_is_admin boolean := false;
begin
  if v_uid is null then
    if coalesce(auth.role(),'')='service_role' or session_user in ('postgres','supabase_admin') then
      return new;
    end if;
    raise exception 'Authentication required';
  end if;

  select public.is_admin() into v_is_admin;
  if coalesce(v_is_admin,false) then return new; end if;

  if tg_table_name='challenges' then
    if new.challenger_id is distinct from v_uid then raise exception 'Invalid challenge owner'; end if;
    new.created_at := now();
    select count(*) into v_count from public.challenges where challenger_id=v_uid and created_at > now()-interval '1 minute';
    if v_count >= 20 then raise exception 'Too many challenges. Try again shortly.'; end if;
    select count(*) into v_count from public.challenges where challenger_id=v_uid and created_at > now()-interval '1 hour';
    if v_count >= 100 then raise exception 'Challenge rate limit reached. Try again later.'; end if;

  elsif tg_table_name='challenge_match_proposals' then
    if new.proposer_id is distinct from v_uid then raise exception 'Invalid proposal owner'; end if;
    new.created_at := now();
    select count(*) into v_count from public.challenge_match_proposals where proposer_id=v_uid and created_at > now()-interval '1 minute';
    if v_count >= 30 then raise exception 'Too many match proposals. Try again shortly.'; end if;

  elsif tg_table_name='lobby_messages' then
    if new.sender_id is distinct from v_uid then raise exception 'Invalid message sender'; end if;
    new.created_at := now();
    select count(*) into v_count from public.lobby_messages where sender_id=v_uid and created_at > now()-interval '30 seconds';
    if v_count >= 20 then raise exception 'Chat rate limit reached. Wait a moment.'; end if;
    select count(*) into v_count from public.lobby_messages where sender_id=v_uid and created_at > now()-interval '10 minutes';
    if v_count >= 200 then raise exception 'Chat rate limit reached. Try again later.'; end if;

  elsif tg_table_name='tournaments' then
    if new.owner_id is distinct from v_uid then raise exception 'Invalid tournament owner'; end if;
    new.created_at := now();
    new.updated_at := now();
    select count(*) into v_count from public.tournaments where owner_id=v_uid and created_at > now()-interval '1 hour';
    if v_count >= 10 then raise exception 'Tournament rate limit reached. Try again later.'; end if;
    select count(*) into v_count from public.tournaments where owner_id=v_uid and created_at > now()-interval '1 day';
    if v_count >= 30 then raise exception 'Daily tournament limit reached.'; end if;

  elsif tg_table_name='client_error_logs' then
    if new.user_id is distinct from v_uid then raise exception 'Invalid error-log owner'; end if;
    new.created_at := now();
    select count(*) into v_count from public.client_error_logs where user_id=v_uid and created_at > now()-interval '1 minute';
    if v_count >= 60 then raise exception 'Error log rate limit reached.'; end if;

  elsif tg_table_name='match_media_telemetry' then
    if new.player_id is distinct from v_uid then raise exception 'Invalid telemetry owner'; end if;
    new.captured_at := now();
    select count(*) into v_count from public.match_media_telemetry where player_id=v_uid and captured_at > now()-interval '1 minute';
    if v_count >= 300 then raise exception 'Telemetry rate limit reached.'; end if;

  elsif tg_table_name='jdc_challenge_results' then
    if new.user_id is distinct from v_uid then raise exception 'Invalid JDC result owner'; end if;
    new.created_at := now();
    select count(*) into v_count from public.jdc_challenge_results where user_id=v_uid and created_at > now()-interval '1 minute';
    if v_count >= 12 then raise exception 'JDC result rate limit reached.'; end if;

  elsif tg_table_name='match_signals' then
    if new.sender_id is distinct from v_uid then raise exception 'Invalid signal sender'; end if;
    new.created_at := now();
    select count(*) into v_count from public.match_signals where sender_id=v_uid and created_at > now()-interval '1 minute';
    if v_count >= 300 then raise exception 'Signalling rate limit reached.'; end if;
  end if;

  return new;
end;
$$;
revoke execute on function public.guard_dartarena_insert_rate() from public, anon, authenticated;

drop trigger if exists challenges_insert_rate_guard on public.challenges;
create trigger challenges_insert_rate_guard before insert on public.challenges for each row execute function public.guard_dartarena_insert_rate();
drop trigger if exists challenge_proposals_insert_rate_guard on public.challenge_match_proposals;
create trigger challenge_proposals_insert_rate_guard before insert on public.challenge_match_proposals for each row execute function public.guard_dartarena_insert_rate();
drop trigger if exists lobby_messages_insert_rate_guard on public.lobby_messages;
create trigger lobby_messages_insert_rate_guard before insert on public.lobby_messages for each row execute function public.guard_dartarena_insert_rate();
drop trigger if exists tournaments_insert_rate_guard on public.tournaments;
create trigger tournaments_insert_rate_guard before insert on public.tournaments for each row execute function public.guard_dartarena_insert_rate();
drop trigger if exists client_error_logs_insert_rate_guard on public.client_error_logs;
create trigger client_error_logs_insert_rate_guard before insert on public.client_error_logs for each row execute function public.guard_dartarena_insert_rate();
drop trigger if exists media_telemetry_insert_rate_guard on public.match_media_telemetry;
create trigger media_telemetry_insert_rate_guard before insert on public.match_media_telemetry for each row execute function public.guard_dartarena_insert_rate();
drop trigger if exists jdc_results_insert_rate_guard on public.jdc_challenge_results;
create trigger jdc_results_insert_rate_guard before insert on public.jdc_challenge_results for each row execute function public.guard_dartarena_insert_rate();
drop trigger if exists match_signals_insert_rate_guard on public.match_signals;
create trigger match_signals_insert_rate_guard before insert on public.match_signals for each row execute function public.guard_dartarena_insert_rate();

-- Keep the existing JDC leaderboard API shape while moving privileged reads to a non-exposed schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.jdc_challenge_best_rows()
returns table(
  user_id uuid,
  username text,
  best_score integer,
  phase1_score integer,
  doubles_score integer,
  phase3_score integer,
  doubles_hit smallint,
  shanghai_count smallint,
  badge text,
  achieved_at timestamptz,
  result_id bigint
)
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  select distinct on (r.user_id)
    r.user_id,p.username::text,r.score,r.phase1_score,r.doubles_score,r.phase3_score,
    r.doubles_hit,r.shanghai_count,r.badge,r.created_at,r.id
  from public.jdc_challenge_results r
  join public.profiles p on p.id=r.user_id
  join public.matches m on m.id=r.match_id
  where r.result_source='online' and m.deleted_at is null
  order by r.user_id,r.score desc,r.created_at;
end;
$$;
revoke all on function private.jdc_challenge_best_rows() from public, anon;
grant execute on function private.jdc_challenge_best_rows() to authenticated;

create or replace view public.jdc_challenge_best
with (security_invoker=true)
as
select * from private.jdc_challenge_best_rows();
revoke all privileges on public.jdc_challenge_best from anon;
grant select on public.jdc_challenge_best to authenticated;

drop function if exists public.get_jdc_challenge_best(integer,uuid);
