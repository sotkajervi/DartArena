-- DartArena: allow Best of 3 through Best of 21 in tournament play.
-- Run once in Supabase SQL Editor.

begin;

alter table public.tournament_groups
  drop constraint if exists tournament_groups_best_of_check;

alter table public.tournament_groups
  add constraint tournament_groups_best_of_check
  check (best_of between 3 and 21 and mod(best_of,2)=1);

alter table public.tournament_matches
  drop constraint if exists tournament_matches_best_of_check;

alter table public.tournament_matches
  add constraint tournament_matches_best_of_check
  check (best_of between 3 and 21 and mod(best_of,2)=1);

commit;
