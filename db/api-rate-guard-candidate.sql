-- TEST CANDIDATE ONLY; do not apply to production without comparing live definition and privileges.
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
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dartarena:insert-rate:' || tg_table_name || ':' || v_uid::text, 0));
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
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dartarena:insert-rate:' || tg_table_name || ':' || v_uid::text, 0));
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
