create or replace function public.remove_tournament_group_player(
  p_tournament_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_tournament public.tournaments%rowtype;
  v_live_ids uuid[];
  v_removed_matches integer := 0;
  v_removed_played integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select *
    into v_tournament
    from public.tournaments
   where id = p_tournament_id
   for update;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_tournament.status <> 'groups' then
    raise exception 'Players can only be removed while group play is active';
  end if;

  if auth.uid() is distinct from v_tournament.owner_id
     and not public.is_admin() then
    raise exception 'Only admin, owner or tournament leader can remove a player';
  end if;

  if not exists (
    select 1
      from public.tournament_members
     where tournament_id = p_tournament_id
       and user_id = p_user_id
       and role = 'participant'
  ) then
    raise exception 'Player is not a tournament participant';
  end if;

  select
    coalesce(array_agg(distinct live_match_id) filter (where live_match_id is not null), array[]::uuid[]),
    count(*)::integer,
    count(*) filter (where status in ('live','finished','wo'))::integer
  into v_live_ids, v_removed_matches, v_removed_played
  from public.tournament_matches
  where tournament_id = p_tournament_id
    and stage = 'group'
    and (player1_id = p_user_id or player2_id = p_user_id);

  if cardinality(v_live_ids) > 0 then
    update public.profiles p
       set status = 'unavailable',
           last_seen = now()
     where p.status = 'in_game'
       and exists (
         select 1
           from public.matches m
          where m.id = any(v_live_ids)
            and (m.player1_id = p.id or m.player2_id = p.id)
       );

    update public.matches
       set status = case when status in ('waiting','playing') then 'cancelled' else status end,
           finished_at = case when status in ('waiting','playing') then coalesce(finished_at,now()) else finished_at end,
           deleted_at = coalesce(deleted_at,now()),
           deleted_by = coalesce(deleted_by,auth.uid()),
           updated_at = now()
     where id = any(v_live_ids);
  end if;

  delete from public.tournament_matches
   where tournament_id = p_tournament_id
     and stage = 'group'
     and (player1_id = p_user_id or player2_id = p_user_id);

  delete from public.tournament_group_players
   where tournament_id = p_tournament_id
     and user_id = p_user_id;

  delete from public.tournament_members
   where tournament_id = p_tournament_id
     and user_id = p_user_id
     and role = 'participant';

  update public.profiles
     set status = 'unavailable',
         last_seen = now()
   where id = p_user_id
     and status = 'in_game';

  return jsonb_build_object(
    'removed_user_id', p_user_id,
    'removed_matches', v_removed_matches,
    'removed_played_matches', v_removed_played
  );
end;
$function$;

revoke all on function public.remove_tournament_group_player(uuid,uuid) from public;
grant execute on function public.remove_tournament_group_player(uuid,uuid) to authenticated;
