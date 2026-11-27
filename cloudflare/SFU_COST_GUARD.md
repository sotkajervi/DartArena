# SFU admission guard – stage 1 (2026-11-27)

Based on the active Worker source provided by the owner. Candidate only: GitHub Pages deployment does not deploy this Worker.

- Limits new SFU sessions per authenticated user across all rooms: 24 / 5 minutes, 72 / hour.
- Global limits: 360 / minute, 2400 / hour.
- Fixed windows; adjacent-window bursts are possible. Counts admitted attempts, including failed upstream requests.
- Existing SFU_ROOMS binding and SfuRoom class reused with dedicated internal object cost-guard:v1. No new bindings or migration intended.
- Optional Worker variable SFU_NEW_SESSIONS_ENABLED=false blocks new sessions but does not revoke live streams. Unset/true allows them.
- Logs a warning when either global window first reaches 80%. Not a billing alert; Worker logging must be enabled to observe it.
- Authentication/room checks unchanged. Admission fails closed. Existing session operations bypass this new limit.
- Does NOT cap live connections, track counts over time, actual egress, monthly billing, unauthenticated Worker traffic or already-established streams. No automatic track closure in this stage. Limits provisional pending actual tournament usage.

## Manual deployment (only after offline tests and review)
Save the current deployed Worker version/rollback identifier and compare the current code with the supplied source. In Cloudflare edit the active dartarena-realtime-security-test Worker, replacing its module with cloudflare/dartarena-realtime-cost-guard.js; preserve existing bindings, variables, secrets and SfuRoom class. Do not deploy to the retired Worker. Test one regular match and spectator with no live load test. Roll back via Deployments if needed. Production is unchanged by this branch.

## Stage 2 candidate – explicit cleanup and track cap
- Maximum eight cumulative track additions per newly created session, including failed/ambiguous upstream operations. Existing subscriber allocations are not reconstructed. This is not a global simultaneous connection cap.
- Per-session mutation queue serializes concurrent requests within a room object; explicit close marks the record closing before upstream calls, blocks further mutations and releases ownership only after confirmed per-track closure or inactive/empty track inspection.
- New authenticated POST /api/sfu/close accepts only the recorded owner in the matching room object, including after room membership ends. No arbitrary upstream track identifiers accepted; server reads session state itself.
- This endpoint is not yet called by the production browser. Browser teardown integration and global concurrent session admission are separate stages. Cloudflare already reclaims inactive media; this candidate does not periodically force-close live streams or implement billing alerts.
- Reference: https://developers.cloudflare.com/realtime/sfu/get-started/connection-patterns/ ; https://developers.cloudflare.com/realtime/sfu/api/ ; https://developers.cloudflare.com/realtime/sfu/observability/error-codes/
- Stage 1 is in production per owner confirmation; stage 2 is only a test candidate. Preserve stage 1 rollback version before any manual deployment.

## Stage 3 candidate – opt-in outstanding allocation cap
- SFU_CONCURRENT_GUARD_ENABLED=true activates admission, default off for staged rollout. 16 outstanding new session allocations per authenticated user, 384 globally. Includes pending allocation and overlapping room/match sessions, not actual provider peer count or bandwidth. Existing sessions are not retroactively counted.
- Atomic bounded registry using existing cost-guard:v1 Durable Object; unique reservation created before upstream session, released on explicit confirmed closure or failed creation with no returned ID. No wall-clock expiry of active allocations. At pressure, inspect up to four older reservations, with per-reservation 60s cooldown and at least two minutes since last mutation. Only successful inspection confirming no active media can retire a session; a retired client must reconnect. No active stream is force closed by pressure cleanup.
- Missing registry-to-room mapping, unavailable provider or ambiguous response can conservatively retain capacity; operator may disable admission via variable without disabling existing playback. Not a billing cap. Provider reclamation and client close are best effort; verify actual close results in Worker logs before enforcement.
- Deploy first with guard off; enable separately after a normal match and spectator test. No live load testing. Limits are provisional, no new database or binding.
