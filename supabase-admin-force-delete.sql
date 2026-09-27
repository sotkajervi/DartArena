-- DartArena: guarded global-admin force delete for tournaments.
-- Normal delete remains available only before any match has produced/started data.
-- Force delete requires the exact tournament name and removes linked live-match data.

create or replace function public.admin_delete_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select status into v_status
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_status = 'finished' then
    raise exception 'Tournament requires force delete';
  end if;

  if exists (
    select 1
    from public.tournament_matches
    where tournament_id = p_tournament_id
      and (
        live_match_id is not null
        or status in ('live','finished','wo')
      )
  ) then
    raise exception 'Tournament requires force delete';
  end if;

  delete from public.tournaments where id = p_tournament_id;
end;
$$;

revoke all on function public.admin_delete_tournament(uuid) from public;
revoke execute on function public.admin_delete_tournament(uuid) from anon;
grant execute on function public.admin_delete_tournament(uuid) to authenticated;

create or replace function public.admin_force_delete_tournament(
  p_tournament_id uuid,
  p_confirm_name text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_live_match_ids uuid[];
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select name into v_name
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if p_confirm_name is distinct from v_name then
    raise exception 'Tournament name confirmation does not match';
  end if;

  select coalesce(
    array_agg(distinct live_match_id) filter (where live_match_id is not null),
    array[]::uuid[]
  )
  into v_live_match_ids
  from public.tournament_matches
  where tournament_id = p_tournament_id;

  delete from public.tournaments
  where id = p_tournament_id;

  if cardinality(v_live_match_ids) > 0 then
    delete from public.match_signals s
    where s.match_id = any(v_live_match_ids)
      and not exists (
        select 1 from public.tournament_matches tm where tm.live_match_id = s.match_id
      );

    delete from public.match_throws th
    where th.match_id = any(v_live_match_ids)
      and not exists (
        select 1 from public.tournament_matches tm where tm.live_match_id = th.match_id
      );

    delete from public.matches m
    where m.id = any(v_live_match_ids)
      and not exists (
        select 1 from public.tournament_matches tm where tm.live_match_id = m.id
      );
  end if;
end;
$$;

revoke all on function public.admin_force_delete_tournament(uuid, text) from public;
revoke execute on function public.admin_force_delete_tournament(uuid, text) from anon;
grant execute on function public.admin_force_delete_tournament(uuid, text) to authenticated;
