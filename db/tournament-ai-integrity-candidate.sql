-- Optional AI training fixtures only. No changes to official results or live scoring.
begin;
alter policy "AI tournament fixtures leader inserts" on public.tournament_ai_group_matches
with check (
 status='pending' and human_legs is null and ai_legs is null and winner_is_ai is null and finished_at is null
 and exists (
 select 1 from public.tournaments t
 join public.tournament_ai_rivals a on a.tournament_id=t.id
 join public.tournament_group_players gp on gp.tournament_id=t.id
 join public.tournament_groups g on g.id=gp.group_id and g.tournament_id=t.id
 where t.id=tournament_ai_group_matches.tournament_id and t.owner_id=auth.uid()
 and t.status='groups_setup' and t.tournament_type='groups_cup'
 and gp.user_id=tournament_ai_group_matches.human_id
 and gp.group_id=tournament_ai_group_matches.group_id
 and a.group_id=g.id and g.best_of=tournament_ai_group_matches.best_of
 )
);
create or replace function public.finish_tournament_ai_group_match(p_ai_match_id uuid,p_human_legs integer,p_ai_legs integer)
returns void language plpgsql security definer set search_path='' as $finish$
declare v public.tournament_ai_group_matches%rowtype; t public.tournaments%rowtype; tid uuid; needed integer; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Login required';end if;
 if p_ai_match_id is null or p_human_legs is null or p_ai_legs is null then raise exception 'Invalid best-of score';end if;
 select tournament_id into tid from public.tournament_ai_group_matches where id=p_ai_match_id and human_id=actor;
 if not found then raise exception 'AI match not found or not assigned to you';end if;
 -- Lock phase before fixture to serialize against group-to-cup transition.
 select * into t from public.tournaments where id=tid for share;
 if not found or t.status is distinct from 'groups' or t.tournament_type is distinct from 'groups_cup'
 or t.game_variant is distinct from 'x01' or t.game is null or t.game not in (170,501,1001)
 then raise exception 'Group stage is not active or AI format is unsupported';end if;
 select * into v from public.tournament_ai_group_matches where id=p_ai_match_id and tournament_id=tid for update;
 if not found or v.human_id is distinct from actor then raise exception 'AI match not found or not assigned to you';end if;
 if not exists(select 1 from public.tournament_ai_rivals a join public.tournament_group_players gp on gp.tournament_id=a.tournament_id and gp.group_id=a.group_id
 join public.tournament_groups g on g.id=gp.group_id and g.tournament_id=gp.tournament_id
 where a.tournament_id=tid and gp.user_id=actor and gp.group_id=v.group_id and g.best_of=v.best_of)
 then raise exception 'AI fixture no longer matches group configuration';end if;
 needed:=v.best_of/2+1;
 if not ((p_human_legs=needed and p_ai_legs between 0 and needed-1) or (p_ai_legs=needed and p_human_legs between 0 and needed-1)) then raise exception 'Invalid best-of score';end if;
 if v.status='finished' then
  if v.human_legs=p_human_legs and v.ai_legs=p_ai_legs then return;end if;
  raise exception 'AI match already finished with a different result';
 end if;
 if v.status is distinct from 'pending' or v.human_legs is not null or v.ai_legs is not null or v.winner_is_ai is not null or v.finished_at is not null then raise exception 'Invalid AI fixture state';end if;
 update public.tournament_ai_group_matches set human_legs=p_human_legs,ai_legs=p_ai_legs,status='finished',winner_is_ai=(p_ai_legs>p_human_legs),finished_at=now() where id=v.id;
end;
$finish$;
revoke all on function public.finish_tournament_ai_group_match(uuid,integer,integer) from public,anon;
grant execute on function public.finish_tournament_ai_group_match(uuid,integer,integer) to authenticated,service_role;
commit;
