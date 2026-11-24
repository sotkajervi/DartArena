-- Rollback of training validation only; never delete training results.
begin;
set local lock_timeout='2s';
drop trigger if exists dartarena_training_validate_record on public.personal_training_results;
drop function if exists dartarena_training_internal.guard_record();
drop function if exists dartarena_training_internal.validate_record(text,text,integer,jsonb);
drop schema if exists dartarena_training_internal;
-- Keep corrected duration whitelist: restoring old conflicting constraint
-- would reject valid 30/45/60-minute records saved since deployment.
commit;
