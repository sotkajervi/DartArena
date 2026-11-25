# Issue Center – isolated v1

This branch is intentionally not deployed. The report form is attached only to the lobby, tournament, and existing online match/waiting pages. It reads an existing same-tab media trace when present and attaches a sanitized recent event summary, not the original raw export. Other pages collect only current video state and safe recent error metadata. No transport changes, recording, background upload, or auto-download.

Authenticated users submit with optional explicit diagnostic opt-in. Owner/Admin access uses the existing is_admin() function and RLS. Staff can filter, view, download diagnostics and change status/internal notes. No automatic reporter notification in v1. Rate limit: five reports per ten minutes per account. Reports must not contain secrets or personal details.

Release gates:
1. Run isolated JavaScript and PostgreSQL role tests; inspect live role definitions and privileges.
2. Apply supabase-issue-center.sql only after approval and in a test database first. Schedule the documented 30-day diagnostic cleanup in pg_cron; verify actual execution and define report retention before public rollout.
3. Browser smoke test with two normal accounts and one Owner/Admin: report from match, opt out, opt in, confirm current tab log and no raw identifiers, verify no ordinary account can read another report, admin list/download/status, language toggle, keyboard isolation, mobile placement, no match/video change.
4. If deployed, remove script inclusions to roll back the UI; keep private reports until reviewed. Never delete live data as a rollback shortcut.
