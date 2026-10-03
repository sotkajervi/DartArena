-- Hide internal test accounts from the public player directory.
-- Accounts remain intact and can still be used for DartArena testing.

create or replace function public.get_player_directory(
  p_search text default '',
  p_limit integer default 200
)
returns table(
  user_id uuid, username text, registered_at timestamptz, matches bigint,
  wins bigint, win_pct numeric, x01_avg numeric, c180 bigint
)
language sql stable security definer
set search_path to 'public','pg_temp'
as $$
  with eligible as (
    select m.*
    from public.matches m
    where m.status='finished'
      and m.deleted_at is null
      and coalesce(m.is_warmup,false)=false
  ),
  player_matches as (
    select e.id as match_id,e.player1_id as user_id,coalesce(tm.winner_id,e.winner_id) as effective_winner
    from eligible e
    left join public.tournament_matches tm on tm.live_match_id=e.id
    union all
    select e.id,e.player2_id,coalesce(tm.winner_id,e.winner_id)
    from eligible e
    left join public.tournament_matches tm on tm.live_match_id=e.id
  ),
  mt as (
    select pm.user_id,count(*)::bigint as matches,
           count(*) filter (where pm.effective_winner=pm.user_id)::bigint as wins
    from player_matches pm
    group by pm.user_id
  ),
  vt as (
    select v.player_id as user_id,
           sum(v.score)::numeric as total_score,
           sum(case when v.is_checkout then coalesce(nullif(v.darts_used,0),3) else 3 end)::numeric as total_darts,
           count(*) filter (where v.score=180)::bigint as c180
    from public.match_throws v
    join eligible e on e.id=v.match_id
    where coalesce(e.game_variant,'x01')='x01'
    group by v.player_id
  )
  select p.id,
         p.username::text,
         p.created_at,
         coalesce(mt.matches,0),
         coalesce(mt.wins,0),
         case when coalesce(mt.matches,0)>0 then round(mt.wins::numeric*100/mt.matches,1) else 0 end,
         case when coalesce(vt.total_darts,0)>0 then round(vt.total_score/vt.total_darts*3,2) else 0 end,
         coalesce(vt.c180,0)
  from public.profiles p
  left join mt on mt.user_id=p.id
  left join vt on vt.user_id=p.id
  where coalesce(p.username,'') ilike '%'||coalesce(p_search,'')||'%'
    and lower(coalesce(p.username,'')) not in ('player-049fdb78','test test')
  order by lower(coalesce(p.username,'')),p.created_at
  limit greatest(1,least(coalesce(p_limit,200),500));
$$;

revoke all on function public.get_player_directory(text,integer) from public;
grant execute on function public.get_player_directory(text,integer) to authenticated;
