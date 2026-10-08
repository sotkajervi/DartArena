-- DartArena: admin, Owner and tournament leader may remove a signup.
-- This does not modify group matches, brackets, or previously played statistics.
-- Deploy as a Supabase migration.
create or replace function public.remove_tournament_registered_player(
  p_tournament_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tournament public.tournaments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  if p_tournament_id is null or p_user_id is null then
    raise exception 'Tournament and player are required';
  end if;

  select * into v_tournament
    from public.tournaments
   where id = p_tournament_id
   for update;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.status <> 'registration' then
    raise exception 'Registered players can only be removed during registration';
  end if;

  if auth.uid() is distinct from v_tournament.owner_id
     and not public.is_admin() then
    raise exception 'Only admin, owner or tournament leader can remove a player';
  end if;

  if p_user_id = v_tournament.owner_id then
    raise exception 'Transfer tournament leadership before removing the leader';
  end if;

  -- Never remove a signup once pairings or matches exist.
  if exists (
    select 1 from public.tournament_matches
    where tournament_id = p_tournament_id
  ) or exists (
    select 1 from public.tournament_group_players
    where tournament_id = p_tournament_id
  ) then
    raise exception 'Tournament matches or groups already exist';
  end if;

  delete from public.tournament_members
   where tournament_id = p_tournament_id
     and user_id = p_user_id
     and role = 'participant';

  if not found then
    raise exception 'Player is not a tournament participant';
  end if;

  return jsonb_build_object(
    'removed_user_id', p_user_id,
    'removed_matches', 0,
    'removed_played_matches', 0
  );
end;
$function$;

revoke all on function public.remove_tournament_registered_player(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.remove_tournament_registered_player(uuid, uuid)
  to authenticated;
