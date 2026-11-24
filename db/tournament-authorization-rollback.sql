begin;
drop trigger if exists dartarena_guard_final_fields on public.tournament_matches;
drop function if exists dartarena_tournament_auth_internal.guard_final_fields();
drop schema if exists dartarena_tournament_auth_internal;
alter policy "manager inserts tournament matches" on public.tournament_matches with check ((EXISTS ( SELECT 1
   FROM tournaments t
  WHERE ((t.id = tournament_matches.tournament_id) AND ((t.owner_id = auth.uid()) OR is_admin())))));
commit;
