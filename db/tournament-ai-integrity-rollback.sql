-- Restore previous AI result RPC and fixture policy only. No data changes.
begin;
set local lock_timeout='2s';
CREATE OR REPLACE FUNCTION public.finish_tournament_ai_group_match(p_ai_match_id uuid, p_human_legs integer, p_ai_legs integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v public.tournament_ai_group_matches%rowtype;v_status text;v_needed integer;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 select * into v from public.tournament_ai_group_matches where id=p_ai_match_id for update;
 if not found then raise exception 'AI match not found';end if;
 if v.human_id<>auth.uid() then raise exception 'Only the registered player can submit this AI match';end if;
 select status into v_status from public.tournaments where id=v.tournament_id;
 if v_status<>'groups' then raise exception 'Group stage is not active';end if;
 if v.status='finished' then
   if v.human_legs=p_human_legs and v.ai_legs=p_ai_legs then return;end if;
   raise exception 'AI match already finished with a different result';
 end if;
 v_needed := (v.best_of/2)+1;
 if not ((p_human_legs=v_needed and p_ai_legs between 0 and v_needed-1)
      or (p_ai_legs=v_needed and p_human_legs between 0 and v_needed-1))
 then raise exception 'Invalid best-of score';end if;
 update public.tournament_ai_group_matches
 set human_legs=p_human_legs,ai_legs=p_ai_legs,status='finished',winner_is_ai=(p_ai_legs>p_human_legs),finished_at=now()
 where id=v.id;
end $function$;
alter policy "AI tournament fixtures leader inserts" on public.tournament_ai_group_matches with check ((EXISTS ( SELECT 1
   FROM ((tournaments t
     JOIN tournament_ai_rivals a ON ((a.tournament_id = t.id)))
     JOIN tournament_group_players gp ON ((gp.tournament_id = t.id)))
  WHERE ((t.id = tournament_ai_group_matches.tournament_id) AND (t.owner_id = auth.uid()) AND (t.status = 'groups_setup'::text) AND (t.tournament_type = 'groups_cup'::text) AND (gp.user_id = tournament_ai_group_matches.human_id) AND (gp.group_id = tournament_ai_group_matches.group_id)))));
revoke all on function public.finish_tournament_ai_group_match(uuid,integer,integer) from public,anon;
grant execute on function public.finish_tournament_ai_group_match(uuid,integer,integer) to authenticated,service_role;
commit;
