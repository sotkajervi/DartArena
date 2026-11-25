-- Read-only lobby form: weighted 3-dart average of the latest 20 completed 501 matches in leg format, Best of 5 or longer.
begin;
create or replace function public.get_lobby_form_avg(p_player_ids uuid[])
returns table(player_id uuid, form_avg numeric, matches_count bigint)
language sql stable security invoker set search_path = ''
as $$
 with requested as (
  select distinct uid from unnest(coalesce(p_player_ids,'{}'::uuid[])) uid
  where uid is not null and (select auth.uid()) is not null limit 60
 ), candidate as (
  select r.uid,m.id,m.finished_at
  from requested r join public.matches m on r.uid in (m.player1_id,m.player2_id)
  where m.status='finished' and m.deleted_at is null and not coalesce(m.is_warmup,false)
    and m.game=501 and coalesce(m.game_variant,'x01')='x01'
    and lower(coalesce(m.game_config->>'chicago','false'))<>'true'
    and not exists (
      select 1 from public.tournament_matches tx left join public.tournaments t on t.id=tx.tournament_id
      where tx.live_match_id=m.id and (
        tx.status is distinct from 'finished' or t.status is null or t.status not in ('groups','cup','finished')
        or t.stats_enabled is distinct from true or tx.player1_id is distinct from m.player1_id or tx.player2_id is distinct from m.player2_id
        or (case when tx.stage='cup' then coalesce(t.cup_game,t.game) else t.game end) is distinct from 501
        or lower(coalesce(case when tx.stage='cup' then coalesce(t.cup_game_variant,t.game_variant) else t.game_variant end,'x01'))<>'x01')
    )
    and coalesce(m.match_mode,'legs')='legs' and m.legs>=5
    and not exists (select 1 from public.tournament_matches tx where tx.live_match_id=m.id and coalesce(tx.best_of,m.legs)<5)
    and exists (select 1 from public.match_throws v where v.match_id=m.id and v.is_checkout and v.player_id in(m.player1_id,m.player2_id))
    and exists(select 1 from public.match_throws v where v.match_id=m.id and v.player_id=r.uid)
 ), ranked as (
  select *,row_number() over(partition by uid order by finished_at desc nulls last,id desc) rn from candidate
 ), totals as (
  select r.uid,count(distinct r.id) n,sum(v.score)::numeric points,
    sum(case when v.is_checkout then coalesce(nullif(v.darts_used,0),3) else 3 end)::numeric darts
  from ranked r join public.match_throws v on v.match_id=r.id and v.player_id=r.uid where r.rn<=20 group by r.uid
 )
 select r.uid,round(3*t.points/nullif(t.darts,0),2),coalesce(t.n,0) from requested r left join totals t on t.uid=r.uid;
$$;
revoke all on function public.get_lobby_form_avg(uuid[]) from public,anon;
grant execute on function public.get_lobby_form_avg(uuid[]) to authenticated;
commit;
