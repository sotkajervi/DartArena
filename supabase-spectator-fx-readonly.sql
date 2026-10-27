-- Read-only, authenticated spectator FX data for publicly live matches.
-- Does not grant SELECT on matches or match_throws to the spectator role.
create or replace function public.get_spectate_fx_state(p_match_id uuid)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id',m.id,
    'status',m.status,
    'player1_id',m.player1_id,
    'player2_id',m.player2_id,
    'turn_player_id',m.turn_player_id,
    'current_leg',m.current_leg,
    'current_set',m.current_set,
    'player1_score',m.player1_score,
    'player2_score',m.player2_score,
    'game',m.game,
    'game_variant',m.game_variant,
    'game_config',m.game_config,
    'updated_at',m.updated_at
  )
  from public.matches m
  where m.id=p_match_id and m.is_live is true and m.deleted_at is null
    and auth.uid() is not null
  limit 1;
$$;
revoke all on function public.get_spectate_fx_state(uuid) from public;
grant execute on function public.get_spectate_fx_state(uuid) to authenticated;

create or replace function public.get_spectate_fx_visits(p_match_id uuid)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_agg(
      jsonb_build_object('id',v.id,'match_id',v.match_id,
      'player_id',v.player_id,'score',v.score,'is_checkout',v.is_checkout,
      'leg_no',v.leg_no,'set_no',v.set_no,'created_at',v.created_at)
      order by v.created_at,v.id
    )
    from (
      select t.id,t.match_id,t.player_id,t.score,t.is_checkout,t.leg_no,t.set_no,t.created_at
      from public.match_throws t
      where t.match_id=p_match_id
      order by t.created_at desc,t.id desc
      limit 150
    ) v
  ),'[]'::jsonb)
  where auth.uid() is not null
    and exists (select 1 from public.matches m
      where m.id=p_match_id and m.is_live is true and m.deleted_at is null);
$$;
revoke all on function public.get_spectate_fx_visits(uuid) from public;
grant execute on function public.get_spectate_fx_visits(uuid) to authenticated;
