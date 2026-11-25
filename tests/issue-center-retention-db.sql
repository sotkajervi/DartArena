\set ON_ERROR_STOP on
\ir ../supabase-issue-center-retention.sql
-- Reuse only the five disposable reports created by issue-center-db.sql.
begin;
with ordered as (select id,row_number() over(order by id) as n from public.issue_reports)
update public.issue_reports r
set diagnostics=case when o.n=5 then null else '{"version":"test","events":[]}'::jsonb end,
    created_at=now()-case o.n when 1 then interval '31 days' when 2 then interval '30 days'
      when 3 then interval '30 days' - interval '1 second' when 4 then interval '1 day'
      else interval '60 days' end
from ordered o where r.id=o.id;
create temp table before_retention as select id,user_id,created_at,category,description,page,context,status,internal_note,diagnostics from public.issue_reports;
do $$begin
  if (select count(*) from before_retention)<>5 then raise exception 'missing fixtures';end if;
  if dartarena_issue_private.purge_expired_diagnostics()<>2 then raise exception 'incorrect expiry count';end if;
  if exists(select 1 from public.issue_reports where created_at<=now()-interval '30 days' and diagnostics is not null) then raise exception 'expired data remains';end if;
  if (select count(*) from public.issue_reports where diagnostics is not null)<>2 then raise exception 'recent diagnostics removed';end if;
  if (select count(*) from public.issue_reports)<>5 then raise exception 'report deleted';end if;
  if exists(select id,user_id,created_at,category,description,page,context,status,internal_note from before_retention
    except select id,user_id,created_at,category,description,page,context,status,internal_note from public.issue_reports) then raise exception 'report metadata altered';end if;
  if dartarena_issue_private.purge_expired_diagnostics()<>0 then raise exception 'repeat cleanup not idempotent';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$begin
  begin perform dartarena_issue_private.purge_expired_diagnostics();raise exception 'staff executed private cleanup';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role anon;
do $$begin
  begin perform dartarena_issue_private.purge_expired_diagnostics();raise exception 'anonymous cleanup executed';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
