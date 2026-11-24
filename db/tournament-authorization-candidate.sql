begin;
-- Preserve the legitimate group and cup setup paths, but do not accept
-- client-supplied completed results, linked live rooms or correction metadata.
alter policy "manager inserts tournament matches" on public.tournament_matches with check (
  live_match_id is null and result_corrected_at is null and result_corrected_by is null
  and player1_legs is null and player2_legs is null and not ai_rival_wo
  and round_no>=1 and match_no>=1
  and (player1_id is null or player2_id is null or player1_id<>player2_id)
  and exists (select 1 from public.tournaments t where t.id=tournament_matches.tournament_id
    and (t.owner_id=auth.uid() or public.is_admin())
    and ((stage='group' and t.status='groups_setup' and t.tournament_type='groups_cup')
      or (stage='cup' and ((t.status in ('groups','cup_setup') and t.tournament_type='groups_cup') or (t.status='cup_setup' and t.tournament_type='cup')))))
  and (
   (stage='group' and status='pending' and not is_wo and not is_final and winner_id is null
    and group_id is not null and player1_id is not null and player2_id is not null
    and exists(select 1 from public.tournament_groups g where g.id=tournament_matches.group_id and g.tournament_id=tournament_matches.tournament_id and g.best_of=tournament_matches.best_of)
    and exists(select 1 from public.tournament_group_players gp where gp.group_id=tournament_matches.group_id and gp.tournament_id=tournament_matches.tournament_id and gp.user_id=tournament_matches.player1_id)
    and exists(select 1 from public.tournament_group_players gp where gp.group_id=tournament_matches.group_id and gp.tournament_id=tournament_matches.tournament_id and gp.user_id=tournament_matches.player2_id))
   or (stage='cup' and group_id is null and (
      (status='pending' and not is_wo and winner_id is null and ((round_no=1 and player1_id is not null and player2_id is not null) or (round_no>1 and player1_id is null and player2_id is null)))
      or (status='wo' and is_wo and round_no=1 and ((player1_id is null)<>(player2_id is null)) and winner_id is not null and winner_id=coalesce(player1_id,player2_id))
   ))
  )
);
create schema dartarena_tournament_auth_internal;
revoke all on schema dartarena_tournament_auth_internal from public,anon,authenticated;
create function dartarena_tournament_auth_internal.guard_final_fields() returns trigger
language plpgsql security invoker set search_path='' as $guard$
declare actual_final boolean; phase text;
begin
 -- Privileged scoring RPCs and server-side triggers remain unchanged.
 if current_user<>'authenticated' then return new;end if;
 if new.best_of is not distinct from old.best_of and new.is_final is not distinct from old.is_final then return new;end if;
 select t.status into phase from public.tournaments t where t.id=old.tournament_id;
 select (old.stage='cup' and old.match_no=1 and old.round_no=(select max(m.round_no) from public.tournament_matches m where m.tournament_id=old.tournament_id and m.stage='cup')
 and 1=(select count(*) from public.tournament_matches m where m.tournament_id=old.tournament_id and m.stage='cup' and m.round_no=old.round_no)) into actual_final;
 if new.is_final is distinct from old.is_final and new.is_final is distinct from actual_final then raise exception 'DA_INVALID_FINAL_FLAG';end if;
 if new.best_of is distinct from old.best_of and (actual_final is distinct from true or old.is_final is distinct from true or phase is distinct from 'cup' or old.status is distinct from 'pending' or old.live_match_id is not null or old.player1_id is null or old.player2_id is null) then raise exception 'DA_FINAL_FORMAT_LOCKED';end if;
 return new;
end;
$guard$;
revoke all on function dartarena_tournament_auth_internal.guard_final_fields() from public,anon,authenticated;
create trigger dartarena_guard_final_fields before update of best_of,is_final on public.tournament_matches for each row execute function dartarena_tournament_auth_internal.guard_final_fields();
commit;
