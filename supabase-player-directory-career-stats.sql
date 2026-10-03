-- DartArena player directory + career statistics.
-- Authenticated users can see usernames and public dart statistics only.

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
    select m.* from public.matches m
    where m.status='finished' and m.deleted_at is null and coalesce(m.is_warmup,false)=false
  ),
  player_matches as (
    select e.id match_id,e.player1_id user_id,coalesce(tm.winner_id,e.winner_id) effective_winner
    from eligible e left join public.tournament_matches tm on tm.live_match_id=e.id
    union all
    select e.id,e.player2_id,coalesce(tm.winner_id,e.winner_id)
    from eligible e left join public.tournament_matches tm on tm.live_match_id=e.id
  ),
  mt as (
    select pm.user_id,count(*)::bigint matches,
           count(*) filter (where pm.effective_winner=pm.user_id)::bigint wins
    from player_matches pm group by pm.user_id
  ),
  vt as (
    select v.player_id user_id,sum(v.score)::numeric total_score,
           sum(case when v.is_checkout then coalesce(nullif(v.darts_used,0),3) else 3 end)::numeric total_darts,
           count(*) filter (where v.score=180)::bigint c180
    from public.match_throws v join eligible e on e.id=v.match_id
    where coalesce(e.game_variant,'x01')='x01'
    group by v.player_id
  )
  select p.id,p.username::text,p.created_at,coalesce(mt.matches,0),coalesce(mt.wins,0),
         case when coalesce(mt.matches,0)>0 then round(mt.wins::numeric*100/mt.matches,1) else 0 end,
         case when coalesce(vt.total_darts,0)>0 then round(vt.total_score/vt.total_darts*3,2) else 0 end,
         coalesce(vt.c180,0)
  from public.profiles p
  left join mt on mt.user_id=p.id
  left join vt on vt.user_id=p.id
  where coalesce(p.username,'') ilike '%'||coalesce(p_search,'')||'%'
  order by lower(coalesce(p.username,'')),p.created_at
  limit greatest(1,least(coalesce(p_limit,200),500));
$$;
revoke all on function public.get_player_directory(text,integer) from public;
grant execute on function public.get_player_directory(text,integer) to authenticated;

create or replace function public.get_player_career_stats(p_user_id uuid)
returns table(
  user_id uuid, username text, registered_at timestamptz,
  total_matches bigint, wins bigint, losses bigint, draws bigint, win_pct numeric,
  x01_matches bigint, x01_wins bigint, x01_legs_for bigint, x01_legs_against bigint,
  three_dart_avg numeric, first9_avg numeric, best_match_avg numeric,
  highest_checkout integer, fastest_leg integer,
  c60 bigint, c100 bigint, c140 bigint, c170 bigint, c180 bigint,
  total_score bigint, total_darts bigint
)
language sql stable security definer
set search_path to 'public','pg_temp'
as $$
  with eligible as (
    select m.*,tm.id tournament_match_id,coalesce(tm.winner_id,m.winner_id) effective_winner,
           case when tm.id is not null then coalesce(tm.player1_legs,m.player1_legs,0) else coalesce(m.player1_legs,0) end effective_p1_legs,
           case when tm.id is not null then coalesce(tm.player2_legs,m.player2_legs,0) else coalesce(m.player2_legs,0) end effective_p2_legs
    from public.matches m
    left join public.tournament_matches tm on tm.live_match_id=m.id
    where m.status='finished' and m.deleted_at is null and coalesce(m.is_warmup,false)=false
      and (m.player1_id=p_user_id or m.player2_id=p_user_id)
  ),
  pm as (
    select e.*,
           case when e.player1_id=p_user_id then e.effective_p1_legs else e.effective_p2_legs end legs_for,
           case when e.player1_id=p_user_id then e.effective_p2_legs else e.effective_p1_legs end legs_against
    from eligible e
  ),
  overall as (
    select count(*)::bigint total_matches,
           count(*) filter (where effective_winner=p_user_id)::bigint wins,
           count(*) filter (where effective_winner is null)::bigint draws
    from pm
  ),
  x01m as (
    select count(*)::bigint x01_matches,
           count(*) filter (where effective_winner=p_user_id)::bigint x01_wins,
           coalesce(sum(legs_for),0)::bigint legs_for,
           coalesce(sum(legs_against),0)::bigint legs_against
    from pm where coalesce(game_variant,'x01')='x01'
  ),
  visits0 as (
    select v.*,
           case when v.is_checkout then coalesce(nullif(v.darts_used,0),3) else 3 end darts,
           row_number() over (
             partition by v.match_id,v.player_id,coalesce(v.set_no,1),coalesce(v.leg_no,1)
             order by coalesce(v.visit_no,2147483647),v.id
           ) leg_visit_no
    from public.match_throws v join pm on pm.id=v.match_id
    where v.player_id=p_user_id and coalesce(pm.game_variant,'x01')='x01'
  ),
  vt as (
    select coalesce(sum(score),0)::bigint total_score,coalesce(sum(darts),0)::bigint total_darts,
           coalesce(max(score) filter (where is_checkout),0)::integer highest_checkout,
           count(*) filter (where score between 60 and 99)::bigint c60,
           count(*) filter (where score between 100 and 139)::bigint c100,
           count(*) filter (where score between 140 and 169)::bigint c140,
           count(*) filter (where score between 170 and 179)::bigint c170,
           count(*) filter (where score=180)::bigint c180
    from visits0
  ),
  f9 as (
    select coalesce(sum(score),0)::numeric score,coalesce(sum(darts),0)::numeric darts
    from visits0 where leg_visit_no<=3
  ),
  match_avgs as (
    select match_id,case when sum(darts)>0 then sum(score)::numeric/sum(darts)*3 else 0 end avg
    from visits0 group by match_id
  ),
  leg_stats as (
    select match_id,coalesce(set_no,1) set_no,coalesce(leg_no,1) leg_no,
           sum(darts)::integer darts,bool_or(is_checkout) won
    from visits0 group by match_id,coalesce(set_no,1),coalesce(leg_no,1)
  ),
  bests as (
    select coalesce((select round(max(avg),2) from match_avgs),0) best_match_avg,
           (select min(darts) from leg_stats where won) fastest_leg
  )
  select p.id,p.username::text,p.created_at,o.total_matches,o.wins,
         (o.total_matches-o.wins-o.draws)::bigint,o.draws,
         case when o.total_matches>0 then round(o.wins::numeric*100/o.total_matches,1) else 0 end,
         x.x01_matches,x.x01_wins,x.legs_for,x.legs_against,
         case when vt.total_darts>0 then round(vt.total_score::numeric/vt.total_darts*3,2) else 0 end,
         case when f9.darts>0 then round(f9.score/f9.darts*3,2) else 0 end,
         b.best_match_avg,vt.highest_checkout,b.fastest_leg,
         vt.c60,vt.c100,vt.c140,vt.c170,vt.c180,vt.total_score,vt.total_darts
  from public.profiles p cross join overall o cross join x01m x cross join vt cross join f9 cross join bests b
  where p.id=p_user_id;
$$;
revoke all on function public.get_player_career_stats(uuid) from public;
grant execute on function public.get_player_career_stats(uuid) to authenticated;

create or replace function public.get_player_profile_matches(p_user_id uuid,p_limit integer default 500)
returns table(
  id uuid, player1_id uuid, player1_name text, player2_id uuid, player2_name text,
  game integer, game_variant text, game_config jsonb, legs integer,
  player1_legs integer, player2_legs integer, player1_score integer, player2_score integer,
  match_mode text, best_of_sets integer, player1_sets integer, player2_sets integer,
  winner_id uuid, created_at timestamptz, finished_at timestamptz,
  tournament_id uuid, tournament_name text, tournament_stage text,
  player_avg numeric, player_first9 numeric, player_high_checkout integer, player_fastest_leg integer,
  player_c60 bigint, player_c100 bigint, player_c140 bigint, player_c170 bigint, player_c180 bigint
)
language sql stable security definer
set search_path to 'public','pg_temp'
as $$
  with base as (
    select m.*,p1.username::text p1_name,p2.username::text p2_name,
           tm.tournament_id,t.name::text tournament_name,tm.stage::text tournament_stage,
           coalesce(tm.winner_id,m.winner_id) effective_winner,
           case when tm.id is not null then coalesce(tm.player1_legs,m.player1_legs,0) else coalesce(m.player1_legs,0) end effective_p1_legs,
           case when tm.id is not null then coalesce(tm.player2_legs,m.player2_legs,0) else coalesce(m.player2_legs,0) end effective_p2_legs
    from public.matches m
    join public.profiles p1 on p1.id=m.player1_id
    join public.profiles p2 on p2.id=m.player2_id
    left join public.tournament_matches tm on tm.live_match_id=m.id
    left join public.tournaments t on t.id=tm.tournament_id
    where m.status='finished' and m.deleted_at is null and coalesce(m.is_warmup,false)=false
      and (m.player1_id=p_user_id or m.player2_id=p_user_id)
  ),
  visits0 as (
    select v.*,
           case when v.is_checkout then coalesce(nullif(v.darts_used,0),3) else 3 end darts,
           row_number() over (
             partition by v.match_id,v.player_id,coalesce(v.set_no,1),coalesce(v.leg_no,1)
             order by coalesce(v.visit_no,2147483647),v.id
           ) leg_visit_no
    from public.match_throws v join base b on b.id=v.match_id
    where v.player_id=p_user_id and coalesce(b.game_variant,'x01')='x01'
  ),
  agg as (
    select match_id,sum(score)::numeric score,sum(darts)::numeric darts,
           coalesce(max(score) filter (where is_checkout),0)::integer high,
           count(*) filter (where score between 60 and 99)::bigint c60,
           count(*) filter (where score between 100 and 139)::bigint c100,
           count(*) filter (where score between 140 and 169)::bigint c140,
           count(*) filter (where score between 170 and 179)::bigint c170,
           count(*) filter (where score=180)::bigint c180
    from visits0 group by match_id
  ),
  f9 as (
    select match_id,sum(score)::numeric score,sum(darts)::numeric darts
    from visits0 where leg_visit_no<=3 group by match_id
  ),
  leg as (
    select match_id,coalesce(set_no,1) set_no,coalesce(leg_no,1) leg_no,
           sum(darts)::integer darts,bool_or(is_checkout) won
    from visits0 group by match_id,coalesce(set_no,1),coalesce(leg_no,1)
  ),
  fastest as (
    select match_id,min(darts)::integer darts from leg where won group by match_id
  )
  select b.id,b.player1_id,b.p1_name,b.player2_id,b.p2_name,b.game,
         coalesce(b.game_variant,'x01')::text,b.game_config,b.legs,
         b.effective_p1_legs,b.effective_p2_legs,b.player1_score,b.player2_score,
         b.match_mode,b.best_of_sets,b.player1_sets,b.player2_sets,b.effective_winner,
         b.created_at,b.finished_at,b.tournament_id,b.tournament_name,b.tournament_stage,
         case when coalesce(a.darts,0)>0 then round(a.score/a.darts*3,2) else null end,
         case when coalesce(f9.darts,0)>0 then round(f9.score/f9.darts*3,2) else null end,
         a.high,fastest.darts,coalesce(a.c60,0),coalesce(a.c100,0),coalesce(a.c140,0),coalesce(a.c170,0),coalesce(a.c180,0)
  from base b
  left join agg a on a.match_id=b.id
  left join f9 on f9.match_id=b.id
  left join fastest on fastest.match_id=b.id
  order by coalesce(b.finished_at,b.updated_at,b.created_at) desc
  limit greatest(1,least(coalesce(p_limit,500),1000));
$$;
revoke all on function public.get_player_profile_matches(uuid,integer) from public;
grant execute on function public.get_player_profile_matches(uuid,integer) to authenticated;