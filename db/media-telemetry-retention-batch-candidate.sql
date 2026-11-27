-- One bounded maintenance batch. No scheduling or production execution here.
-- Do not run until retention policy and backup have been approved.
with expired as materialized (
  select id
  from public.match_media_telemetry
  where captured_at < now() - interval '14 days'
  limit 5000
  for update skip locked
)
delete from public.match_media_telemetry t
using expired e
where t.id=e.id
  and t.captured_at < now() - interval '14 days';
