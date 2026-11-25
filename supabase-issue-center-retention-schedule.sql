-- Separate, explicitly authorized deployment step. Run only as the database
-- administrator, after pg_cron is enabled and the retention function is installed.
-- Do not enable the extension implicitly. Existing jobs are not modified.
begin;
select cron.schedule(
  'dartarena-issue-log-retention',
  '17 * * * *',
  'select dartarena_issue_private.purge_expired_diagnostics();'
);
commit;
-- Verify the named job is active and its first execution succeeds:
-- select jobid, jobname, schedule, active, username from cron.job
-- where jobname='dartarena-issue-log-retention';
-- select r.status,r.return_message,r.start_time,r.end_time
-- from cron.job_run_details r join cron.job j using(jobid)
-- where j.jobname='dartarena-issue-log-retention' order by r.start_time desc limit 5;
