create or replace function public.get_global_match_history(p_limit integer default 200)
returns table(
  id uuid,
  player1_id uuid,
  player1_name text,
  player2_id uuid,
  player2_name text,
  game integer,
  game_variant text,
  game_config jsonb,
  legs integer,
  player1_legs integer,
  player2_legs integer,
  player1_score integer,
  player2_score integer,
  match_mode text,
  best_of_sets integer,
  player1_sets integer,
  player2_sets integer,
  winner_id uuid,
  created_at timestamptz,
  finished_at timestamptz,
  tournament_id uuid,
  tournament_name text,
  tournament_stage text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    m.id,
    m.player1_id,
    p1.username::text,
    m.player2_id,
    p2.username::text,
    m.game,
    coalesce(m.game_variant,'x01')::text,
    m.game_config,
    m.legs,
    m.player1_legs,
    m.player2_legs,
    m.player1_score,
    m.player2_score,
    m.match_mode,
    m.best_of_sets,
    m.player1_sets,
    m.player2_sets,
    m.winner_id,
    m.created_at,
    m.finished_at,
    tm.tournament_id,
    t.name::text,
    tm.stage::text
  from public.matches m
  join public.profiles p1 on p1.id = m.player1_id
  join public.profiles p2 on p2.id = m.player2_id
  left join public.tournament_matches tm on tm.live_match_id = m.id
  left join public.tournaments t on t.id = tm.tournament_id
  where m.status = 'finished'
  order by coalesce(m.finished_at,m.updated_at,m.created_at) desc
  limit greatest(1,least(coalesce(p_limit,200),500));
end;
$$;

revoke all on function public.get_global_match_history(integer) from public;
revoke all on function public.get_global_match_history(integer) from anon;
grant execute on function public.get_global_match_history(integer) to authenticated;
