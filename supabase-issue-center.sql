-- Isolated Issue Center schema; apply only after CI and access review.
begin;
create schema if not exists dartarena_issue_private;
revoke all on schema dartarena_issue_private from public, anon, authenticated;
create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  category text not null check(category in ('video','audio','scoring','tournament','performance','other','suggestion')),
  description text not null check(char_length(btrim(description)) between 1 and 2000),
  page text not null check(page ~ '^[a-zA-Z0-9_-]{1,80}\.html$'),
  context jsonb not null default '{}' check(jsonb_typeof(context)='object' and octet_length(context::text)<=4096),
  diagnostics jsonb check(diagnostics is null or (jsonb_typeof(diagnostics)='object' and octet_length(diagnostics::text)<=60000)),
  status text not null default 'new' check(status in ('new','investigating','resolved')),
  internal_note text not null default '' check(char_length(internal_note)<=2000)
);
create index if not exists issue_reports_user_time_idx on public.issue_reports(user_id,created_at desc);
create index if not exists issue_reports_time_idx on public.issue_reports(created_at desc);
alter table public.issue_reports enable row level security;
revoke all on public.issue_reports from public, anon, authenticated;
grant insert(category,description,page,context,diagnostics) on public.issue_reports to authenticated;
grant select on public.issue_reports to authenticated;
grant update(status,internal_note) on public.issue_reports to authenticated;
create policy issue_report_insert on public.issue_reports for insert to authenticated
  with check(user_id=(select auth.uid()) and status='new' and internal_note='');
create policy issue_report_staff_read on public.issue_reports for select to authenticated
  using ((select public.is_admin()));
create policy issue_report_staff_update on public.issue_reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- The trigger must count private rows across RLS. No client can execute it directly.
create or replace function dartarena_issue_private.limit_reports() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'Authenticated report required' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  if (select count(*) from public.issue_reports where user_id=new.user_id and created_at>now()-interval '10 minutes')>=5 then
    raise exception 'Too many reports; try again later' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function dartarena_issue_private.limit_reports() from public, anon, authenticated;
create trigger issue_report_rate_limit before insert on public.issue_reports
for each row execute function dartarena_issue_private.limit_reports();
commit;
-- Before public rollout: enable pg_cron if necessary and schedule the following daily
-- as an administrator, after verifying the extension and existing jobs.
-- select cron.schedule('dartarena-issue-log-retention','17 3 * * *',
-- $$update public.issue_reports set diagnostics=null where diagnostics is not null and created_at<now()-interval '30 days'$$);
