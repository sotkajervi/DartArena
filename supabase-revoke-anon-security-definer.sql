-- DartArena: remove anonymous execute grants from authenticated/internal RPCs.
-- Safe to run repeatedly.

revoke execute on function public.advance_tournament_cup(uuid) from anon;
revoke execute on function public.archive_tournament_after_final() from anon;
revoke execute on function public.auto_advance_tournament_cup_winner() from anon;
revoke execute on function public.cancel_tournament_match(uuid, uuid) from anon;
revoke execute on function public.correct_throw_to_checkout(bigint, integer, integer) from anon;
revoke execute on function public.finish_tournament_match(uuid, uuid) from anon;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.start_tournament_match(uuid, uuid) from anon;
revoke execute on function public.submit_match_checkout(uuid, integer, integer) from anon;
