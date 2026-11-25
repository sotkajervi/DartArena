-- Apply after supabase-issue-center.sql. No schedule or deletion on install.
begin;
create or replace function dartarena_issue_private.purge_expired_diagnostics()
returns bigint
language plpgsql security invoker set search_path='' as $$
declare removed bigint;
begin
  update public.issue_reports
     set diagnostics=null
   where diagnostics is not null
     and created_at <= pg_catalog.now()-interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function dartarena_issue_private.purge_expired_diagnostics() from public, anon, authenticated;
create index if not exists issue_reports_diagnostic_expiry_idx
  on public.issue_reports(created_at) where diagnostics is not null;
commit;
