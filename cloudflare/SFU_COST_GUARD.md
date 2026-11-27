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
