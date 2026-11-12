-- Pre-change rollback definitions for aggregate stats, 2026-11-12.

CREATE OR REPLACE FUNCTION public.get_form_stats(p_tournament_limit integer DEFAULT 5)
 RETURNS TABLE(player_id uuid, username text, form_avg numeric, first9_avg numeric, count_100 bigint, count_140 bigint, count_170 bigint, count_180 bigint, highest_checkout integer, fastest_leg integer, matches_count bigint, legs_count bigint, tournaments_count bigint, latest_tournament_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with x01_tournament_matches as (
  select tm.tournament_id,tm.live_match_id match_id,tm.player1_id,tm.player2_id,
         coalesce(t.finished_at,t.updated_at,t.starts_at,t.created_at) tournament_finished_at
  from public.tournament_matches tm
  join public.tournaments t on t.id=tm.tournament_id
  join public.matches m on m.id=tm.live_match_id
  where t.status='finished'
    and t.stats_enabled=true
    and tm.status='finished'
    and tm.live_match_id is not null
    and m.status='finished'
    and m.deleted_at is null
    and coalesce(m.is_warmup,false)=false
    and lower(coalesce(m.game_config->>'chicago','false'))<>'true'
    and coalesce(m.game_variant,'x01')='x01'
    and m.game=501
),
player_tournaments as (
  select distinct tournament_id,player_id,tournament_finished_at
  from (
    select x.tournament_id,x.player1_id player_id,x.tournament_finished_at
    from x01_tournament_matches x
    where x.player1_id is not null
      and exists(select 1 from public.match_throws mt where mt.match_id=x.match_id and mt.player_id=x.player1_id)
    union all
    select x.tournament_id,x.player2_id player_id,x.tournament_finished_at
    from x01_tournament_matches x
    where x.player2_id is not null
      and exists(select 1 from public.match_throws mt where mt.match_id=x.match_id and mt.player_id=x.player2_id)
  ) p
),
ranked_tournaments as (
  select pt.*,
         row_number() over(partition by pt.player_id order by pt.tournament_finished_at desc,pt.tournament_id) rn
  from player_tournaments pt
),
selected_matches as (
  select rt.player_id,x.tournament_id,x.match_id,rt.tournament_finished_at
  from ranked_tournaments rt
  join x01_tournament_matches x on x.tournament_id=rt.tournament_id
  where rt.rn<=greatest(1,least(coalesce(p_tournament_limit,5),20))
    and rt.player_id in (x.player1_id,x.player2_id)
),
ordered_visits as (
  select sm.player_id,sm.tournament_id,sm.match_id,sm.tournament_finished_at,
         coalesce(mt.set_no,1) set_no,coalesce(mt.leg_no,1) leg_no,coalesce(mt.score,0) score,
         case when mt.is_checkout then coalesce(nullif(mt.darts_used,0),3) else 3 end darts,
         coalesce(mt.is_checkout,false) is_checkout,
         row_number() over(
           partition by sm.player_id,sm.match_id,coalesce(mt.set_no,1),coalesce(mt.leg_no,1)
           order by mt.created_at,mt.id
         ) leg_visit_no
  from selected_matches sm
  join public.match_throws mt on mt.match_id=sm.match_id and mt.player_id=sm.player_id
),
leg_totals as (
  select ov.player_id,ov.match_id,ov.set_no,ov.leg_no,
         sum(ov.darts)::integer darts,bool_or(ov.is_checkout) won_leg
  from ordered_visits ov
  group by ov.player_id,ov.match_id,ov.set_no,ov.leg_no
),
leg_agg as (
  select lt.player_id,min(lt.darts) filter(where lt.won_leg) fastest_leg
  from leg_totals lt
  group by lt.player_id
),
agg as (
  select ov.player_id,
         sum(ov.score)::numeric total_score,
         sum(ov.darts)::numeric total_darts,
         sum(ov.score) filter(where ov.leg_visit_no<=3)::numeric first9_score,
         sum(ov.darts) filter(where ov.leg_visit_no<=3)::numeric first9_darts,
         count(*) filter(where ov.score between 100 and 139) count_100,
         count(*) filter(where ov.score between 140 and 169) count_140,
         count(*) filter(where ov.score between 170 and 179) count_170,
         count(*) filter(where ov.score=180) count_180,
         coalesce(max(ov.score) filter(where ov.is_checkout),0)::integer highest_checkout,
         count(distinct ov.match_id) matches_count,
         count(distinct (ov.match_id,ov.set_no,ov.leg_no)) legs_count,
         count(distinct ov.tournament_id) tournaments_count,
         max(ov.tournament_finished_at) latest_tournament_at
  from ordered_visits ov
  group by ov.player_id
)
select a.player_id,p.username,
       round((a.total_score/nullif(a.total_darts,0))*3,2) form_avg,
       round((a.first9_score/nullif(a.first9_darts,0))*3,2) first9_avg,
       a.count_100,a.count_140,a.count_170,a.count_180,a.highest_checkout,l.fastest_leg,
       a.matches_count,a.legs_count,a.tournaments_count,a.latest_tournament_at
from agg a
join public.profiles p on p.id=a.player_id
left join leg_agg l on l.player_id=a.player_id
order by form_avg desc nulls last,p.username;
$function$;

CREATE OR REPLACE FUNCTION public.get_player_career_stats(p_user_id uuid)
 RETURNS TABLE(user_id uuid, username text, registered_at timestamp with time zone, total_matches bigint, wins bigint, losses bigint, draws bigint, win_pct numeric, x01_matches bigint, x01_wins bigint, x01_legs_for bigint, x01_legs_against bigint, three_dart_avg numeric, first9_avg numeric, best_match_avg numeric, highest_checkout integer, fastest_leg integer, c60 bigint, c100 bigint, c140 bigint, c170 bigint, c180 bigint, total_score bigint, total_darts bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    from pm
    where coalesce(game_variant,'x01')='x01'
      and lower(coalesce(game_config->>'chicago','false'))<>'true'
  ),
  visits0 as (
    select v.*,
           case when v.is_checkout then coalesce(nullif(v.darts_used,0),3) else 3 end darts,
           row_number() over (
             partition by v.match_id,v.player_id,coalesce(v.set_no,1),coalesce(v.leg_no,1)
             order by coalesce(v.visit_no,2147483647),v.id
           ) leg_visit_no
    from public.match_throws v join pm on pm.id=v.match_id
    where v.player_id=p_user_id
      and coalesce(pm.game_variant,'x01')='x01'
      and lower(coalesce(pm.game_config->>'chicago','false'))<>'true'
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
$function$;

CREATE OR REPLACE FUNCTION public.get_player_directory_stats(p_search text DEFAULT ''::text, p_limit integer DEFAULT 500)
 RETURNS TABLE(user_id uuid, username text, registered_at timestamp with time zone, matches bigint, wins bigint, win_pct numeric, x01_avg numeric, first9_avg numeric, highest_checkout integer, fastest_leg integer, c100 bigint, c140 bigint, c170 bigint, c180 bigint, cricket_mpr numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with eligible as (
    select m.*
    from public.matches m
    where m.status='finished'
      and m.deleted_at is null
      and coalesce(m.is_warmup,false)=false
  ),
  player_matches as (
    select e.id match_id,e.player1_id user_id,coalesce(tm.winner_id,e.winner_id) effective_winner
    from eligible e left join public.tournament_matches tm on tm.live_match_id=e.id
    union all
    select e.id,e.player2_id,coalesce(tm.winner_id,e.winner_id)
    from eligible e left join public.tournament_matches tm on tm.live_match_id=e.id
  ),
  mt as (
    select pm.user_id,
           count(*)::bigint matches,
           count(*) filter (where pm.effective_winner=pm.user_id)::bigint wins
    from player_matches pm
    group by pm.user_id
  ),
  x01_visits as (
    select v.*,
           case when v.is_checkout then coalesce(nullif(v.darts_used,0),3) else 3 end::integer darts,
           row_number() over(
             partition by v.match_id,v.player_id,coalesce(v.set_no,1),coalesce(v.leg_no,1)
             order by coalesce(v.visit_no,2147483647),v.id
           ) leg_visit_no
    from public.match_throws v
    join eligible e on e.id=v.match_id
    where coalesce(e.game_variant,'x01')='x01'
      and lower(coalesce(e.game_config->>'chicago','false'))<>'true'
  ),
  x01_totals as (
    select player_id user_id,
           coalesce(sum(score),0)::numeric total_score,
           coalesce(sum(darts),0)::numeric total_darts,
           coalesce(max(score) filter(where is_checkout),0)::integer highest_checkout,
           count(*) filter(where score between 100 and 139)::bigint c100,
           count(*) filter(where score between 140 and 169)::bigint c140,
           count(*) filter(where score between 170 and 179)::bigint c170,
           count(*) filter(where score=180)::bigint c180
    from x01_visits
    group by player_id
  ),
  first9 as (
    select player_id user_id,
           coalesce(sum(score),0)::numeric score,
           coalesce(sum(darts),0)::numeric darts
    from x01_visits
    where leg_visit_no<=3
    group by player_id
  ),
  legs as (
    select player_id user_id,match_id,coalesce(set_no,1) set_no,coalesce(leg_no,1) leg_no,
           sum(darts)::integer darts,bool_or(is_checkout) won
    from x01_visits
    group by player_id,match_id,coalesce(set_no,1),coalesce(leg_no,1)
  ),
  fastest as (
    select user_id,min(darts)::integer fastest_leg
    from legs
    where won
    group by user_id
  ),
  cricket as (
    select cv.player_id user_id,
           count(*)::numeric visits,
           coalesce(sum((
             select coalesce(sum(greatest(0,least(3,coalesce((dart->>'mult')::integer,0)))),0)
             from jsonb_array_elements(coalesce(cv.darts,'[]'::jsonb)) dart
           )),0)::numeric marks
    from public.cricket_visits cv
    join eligible e on e.id=cv.match_id
    where coalesce(e.game_variant,'x01')='cricket'
      and lower(coalesce(e.game_config->>'chicago','false'))<>'true'
    group by cv.player_id
  )
  select
    p.id,
    p.username::text,
    p.created_at,
    coalesce(mt.matches,0),
    coalesce(mt.wins,0),
    case when coalesce(mt.matches,0)>0 then round(mt.wins::numeric*100/mt.matches,1) else 0 end,
    case when coalesce(xt.total_darts,0)>0 then round(xt.total_score/xt.total_darts*3,2) else 0 end,
    case when coalesce(f9.darts,0)>0 then round(f9.score/f9.darts*3,2) else 0 end,
    coalesce(xt.highest_checkout,0),
    fa.fastest_leg,
    coalesce(xt.c100,0),
    coalesce(xt.c140,0),
    coalesce(xt.c170,0),
    coalesce(xt.c180,0),
    case when coalesce(cr.visits,0)>0 then round(cr.marks/cr.visits,2) else 0 end
  from public.profiles p
  left join mt on mt.user_id=p.id
  left join x01_totals xt on xt.user_id=p.id
  left join first9 f9 on f9.user_id=p.id
  left join fastest fa on fa.user_id=p.id
  left join cricket cr on cr.user_id=p.id
  where coalesce(p.username,'') ilike '%'||coalesce(p_search,'')||'%'
    and lower(trim(coalesce(p.username,''))) not in ('player-049fdb78','test test')
  order by lower(coalesce(p.username,'')),p.created_at
  limit greatest(1,least(coalesce(p_limit,500),500));
$function$;
