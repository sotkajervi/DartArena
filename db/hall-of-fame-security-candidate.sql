begin;
CREATE OR REPLACE FUNCTION public.get_hall_of_fame(p_category text, p_metric text)
 RETURNS TABLE(place bigint, user_id uuid, username text, record_value numeric, achieved_at timestamp with time zone, match_id uuid, is_mine boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if p_category='501' and p_metric in ('180','140','100','checkout','fast_leg','avg') then
  return query
  with eligible as (
   select m.id,m.finished_at,m.created_at,t.player_id,t.score,t.is_checkout,t.darts_used,t.leg_no,t.set_no
   from public.matches m join public.match_throws t on t.match_id=m.id
   where m.status='finished' and m.deleted_at is null and coalesce(m.is_warmup,false)=false
    and coalesce(m.game_variant,'x01')='x01' and m.game=501
    and lower(coalesce(m.game_config->>'chicago','false'))<>'true'
    and t.player_id in (m.player1_id,m.player2_id)
    and not exists (
      select 1 from public.tournament_matches tx left join public.tournaments tr on tr.id=tx.tournament_id
      where tx.live_match_id=m.id and (
        tx.status is distinct from 'finished' or tr.status is null or tr.status not in ('groups','cup','finished')
        or tr.stats_enabled is distinct from true
        or tx.player1_id is distinct from m.player1_id or tx.player2_id is distinct from m.player2_id
        or (case when tx.stage='cup' then coalesce(tr.cup_game,tr.game) else tr.game end) is distinct from 501
        or lower(coalesce(case when tx.stage='cup' then coalesce(tr.cup_game_variant,tr.game_variant) else tr.game_variant end,'x01'))<>'x01')
    )
  ),
  leg_stats as (
   select e.player_id,e.id,e.set_no,e.leg_no,
    sum(case when e.is_checkout then greatest(least(coalesce(e.darts_used,3),3),1) else 3 end) darts,
    bool_or(e.is_checkout) finished_leg,
    max(coalesce(e.finished_at,e.created_at)) achieved_at
   from eligible e group by e.player_id,e.id,e.set_no,e.leg_no
  ),
  match_stats as (
   select e.player_id,e.id,
    round(sum(e.score)::numeric*3/nullif(sum(case when e.is_checkout then greatest(least(coalesce(e.darts_used,3),3),1) else 3 end),0),2) val,
    max(coalesce(e.finished_at,e.created_at)) achieved_at
   from eligible e group by e.player_id,e.id
  ),
  candidates as (
   select e.player_id uid, count(*)::numeric val, max(coalesce(e.finished_at,e.created_at)) dt,null::uuid mid
   from eligible e where e.score=180 and p_metric='180' group by e.player_id
   union all
   select e.player_id,count(*)::numeric,max(coalesce(e.finished_at,e.created_at)),null::uuid
   from eligible e where ((p_metric='140' and e.score between 140 and 179) or (p_metric='100' and e.score between 100 and 139)) group by e.player_id
   union all
   select e.player_id,e.score::numeric,coalesce(e.finished_at,e.created_at),e.id
   from eligible e where e.is_checkout and p_metric='checkout'
   union all
   select l.player_id,l.darts::numeric,l.achieved_at,l.id
   from leg_stats l where l.finished_leg and p_metric='fast_leg' and l.darts>0
   union all
   select z.player_id,z.val,z.achieved_at,z.id
   from match_stats z where p_metric='avg' and z.val is not null
  ),
  best as (
   select distinct on(c.uid) c.uid,c.val,c.dt,c.mid from candidates c
   order by c.uid,
    case when p_metric='fast_leg' then c.val else -c.val end asc,
    c.dt asc nulls last,c.mid
  ),
  ordered as (
   select row_number() over(order by case when p_metric='fast_leg' then b.val else -b.val end,b.dt asc nulls last,b.uid) rank,
    b.* from best b
  )
  select o.rank,o.uid,pr.username::text,o.val,o.dt,o.mid,(o.uid=(select auth.uid()))
  from ordered o join public.profiles pr on pr.id=o.uid where o.rank<=10 order by o.rank;
 elsif p_category in ('half_standard','half_dartcounter') and p_metric='score' then
  return query
  with eligible as (
   select m.id,m.finished_at,m.created_at,v.player_id,v.leg_no,v.round_no,v.score_after,
    row_number() over(partition by m.id,v.player_id,v.leg_no order by v.round_no desc,v.id desc) last_round
   from public.matches m join public.half_it_visits v on v.match_id=m.id
   where m.status='finished' and m.deleted_at is null and coalesce(m.is_warmup,false)=false
    and m.game_variant='half_it'
    and (case when m.game_config->>'half_it_mode'='standard' then 'half_standard' else 'half_dartcounter' end)=p_category
  ),
  best as (
   select distinct on(e.player_id) e.player_id uid,e.score_after::numeric val,
    coalesce(e.finished_at,e.created_at) dt,e.id mid
   from eligible e where e.last_round=1
   order by e.player_id,e.score_after desc,coalesce(e.finished_at,e.created_at),e.id
  ),
  ordered as (
   select row_number() over(order by b.val desc,b.dt,b.uid) rank,b.* from best b
  )
  select o.rank,o.uid,pr.username::text,o.val,o.dt,o.mid,(o.uid=(select auth.uid()))
  from ordered o join public.profiles pr on pr.id=o.uid where o.rank<=10 order by o.rank;
 else
  raise exception 'Unknown Hall of Fame category or metric';
 end if;
end
$function$;
CREATE OR REPLACE FUNCTION public.get_player_directory(p_search text DEFAULT ''::text, p_limit integer DEFAULT 200)
 RETURNS TABLE(user_id uuid, username text, registered_at timestamp with time zone, matches bigint, wins bigint, win_pct numeric, x01_avg numeric, c180 bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
select d.user_id,d.username,d.registered_at,d.matches,d.wins,d.win_pct,d.x01_avg,d.c180
from public.get_player_directory_stats(p_search,greatest(1,least(coalesce(p_limit,200),500))) d
$function$;
revoke all on function public.get_hall_of_fame(text,text),public.get_player_directory(text,integer) from public,anon;
grant execute on function public.get_hall_of_fame(text,text),public.get_player_directory(text,integer) to authenticated,service_role;
commit;
