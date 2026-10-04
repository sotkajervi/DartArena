-- DartArena defense-in-depth: revoke browser table operations that have no RLS write path.
-- SECURITY DEFINER application/admin RPCs continue to run with their validated server-side permissions.

revoke insert, update, delete on table public.user_roles from authenticated;
revoke insert, delete on table public.profiles from authenticated;
revoke delete on table public.challenges from authenticated;
revoke update, delete on table public.lobby_messages from authenticated;
revoke delete on table public.tournaments from authenticated;
revoke update on table public.tournament_matches from authenticated;

-- Anonymous browser role should have no direct DartArena application-table access.
revoke all privileges on table public.user_roles from anon;
revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.challenges from anon;
revoke all privileges on table public.lobby_messages from anon;
revoke all privileges on table public.tournaments from anon;
revoke all privileges on table public.tournament_matches from anon;
