-- Roll back only the newly added Pentathlon validation layer.
-- Run in a quiet period. No data or existing RPC definitions are changed.
begin;
set local lock_timeout = '2s';
drop trigger if exists dartarena_pentathlon_validate_state on public.pentathlon_room_tests;
drop function if exists dartarena_internal.pentathlon_guard();
drop function if exists dartarena_internal.pentathlon_validate(jsonb);
drop function if exists dartarena_internal.pentathlon_replay(integer,integer,jsonb);
drop schema if exists dartarena_internal;
commit;
