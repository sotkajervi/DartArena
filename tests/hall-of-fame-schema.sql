create role anon;
create role authenticated;
create role service_role;
create table public.profiles(id uuid primary key, username text, created_at timestamptz default now());
create table public.tournaments(id uuid primary key,status text,stats_enabled boolean,game integer,game_variant text,cup_game integer,cup_game_variant text,finished_at timestamptz,updated_at timestamptz,starts_at timestamptz,created_at timestamptz default now());
create table public.matches(id uuid primary key,player1_id uuid,player2_id uuid,status text,game int,game_variant text,game_config jsonb default '{}',is_warmup boolean default false,deleted_at timestamptz,winner_id uuid,player1_legs int,player2_legs int);
create table public.tournament_matches(id uuid primary key,tournament_id uuid,live_match_id uuid,player1_id uuid,player2_id uuid,status text,stage text,winner_id uuid,player1_legs int,player2_legs int);
create table public.match_throws(id bigint generated always as identity primary key,match_id uuid,player_id uuid,set_no int,leg_no int,visit_no int,score int,darts_used int,is_checkout boolean,created_at timestamptz default now());
create table public.cricket_visits(match_id uuid,player_id uuid,darts jsonb);
grant select on all tables in schema public to authenticated;

alter table public.matches add column finished_at timestamptz default now(),add column created_at timestamptz default now();
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.half_it_visits(id bigint generated always as identity primary key,match_id uuid,player_id uuid,leg_no int,round_no int,score_after int);
grant select on public.half_it_visits to authenticated;
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
  eligible_501 as (
    select e.* from eligible e
    where e.game=501
      and coalesce(e.game_variant,'x01')='x01'
      and lower(coalesce(e.game_config->>'chicago','false'))<>'true'
      and not exists (
      select 1 from public.tournament_matches tx
      left join public.tournaments t on t.id=tx.tournament_id
      where tx.live_match_id=e.id
        and (tx.status is distinct from 'finished'
             or t.status is null or t.status not in ('groups','cup','finished')
             or t.stats_enabled is distinct from true
             or tx.player1_id is distinct from e.player1_id
             or tx.player2_id is distinct from e.player2_id
             or (case when tx.stage='cup' then coalesce(t.cup_game,t.game) else t.game end) is distinct from 501
             or lower(coalesce(case when tx.stage='cup' then coalesce(t.cup_game_variant,t.game_variant) else t.game_variant end,'x01'))<>'x01')
    )
  ),
  player_matches as (
    select e.id match_id,e.player1_id user_id,coalesce(tm.winner_id,e.winner_id) effective_winner
    from eligible_501 e left join public.tournament_matches tm on tm.live_match_id=e.id
    union all
    select e.id,e.player2_id,coalesce(tm.winner_id,e.winner_id)
    from eligible_501 e left join public.tournament_matches tm on tm.live_match_id=e.id
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
    join eligible_501 e on e.id=v.match_id
    where v.player_id in (e.player1_id,e.player2_id)
      and coalesce(e.game_variant,'x01')='x01'
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
