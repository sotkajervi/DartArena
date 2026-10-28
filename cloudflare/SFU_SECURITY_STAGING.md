# SFU security staging – NOT production ready

This branch is intentionally isolated from `main` and must **not** be deployed as-is.

## Current confirmed weakness
Production Worker holds a Cloudflare Realtime bearer secret and exposes session, publish,
subscribe, and renegotiate operations without verifying the Supabase user or the
match/room authorization. CORS is not an authentication or authorization mechanism.

## Changes staged
- `sfu-client.js`: attaches the currently logged-in user's Supabase access token to
  requests. This must be deployed atomically with a compatible Worker because it
  introduces an Authorization request header and changes browser CORS preflight.
- `cloudflare/dartarena-realtime.staging.js`: prototype Worker checks tokens against
  Supabase Auth /auth/v1/user, rejects unexpected Origins, caps body size, and
  fails closed on media operations until room authorization is implemented.
  This file intentionally does **not** enable functioning video yet.

## Required before any deployment
1. Define one server-authoritative room context per SFU request: normal challenge
   waiting room, match, or tournament waiting room. Do not trust IDs alone.
2. Validate requester participation/approved viewer status from Supabase on server.
   A valid login alone is insufficient.
3. Track or cryptographically bind SFU session ownership and publication visibility
   to the authorized room and user, including subscribe and renegotiate.
4. Prevent cross-room and cross-user video subscription even if someone learns a
   session ID or a media broadcast payload.
5. Implement abuse limits, validate tracks/SDP sizes and shapes, and consider
   denial-of-service/resource consumption.
6. Create the two Supabase public project variables in Cloudflare Worker settings
   before trying the staging Worker; never place a service_role or SFU bearer token
   in browser JavaScript.
7. Test in a separate Worker URL with two accounts, a third nonparticipant,
   spectators, standard rooms, X01 match, tournament rooms, Zoom-cam, reconnect,
   and expected rejection for unauthenticated and wrong-room requests.
8. Do not merge until production Worker and browser client can be deployed together
   with an explicit rollback plan. Keep `main` untouched while testing.

## Rollback
The existing production Worker configuration and GitHub `main` have not been
changed by this branch. Discard the staging Worker and revert or close the draft PR
if tests fail.

## 2026-10-28 staged room gateway implementation
- The prototype now passes Supabase JWT + room kind/id and checks the room permission RPC before routing SFU operations.
- A Durable Object named per room persists SFU session ownership and publication metadata, and rejects cross-room and cross-user session references.
- New Cloudflare binding required: `SFU_ROOMS` to SQLite-backed Durable Object `SfuRoom` (see Cloudflare current Durable Objects migration docs). This is NOT configured in production.
- All tournament waiting-room calls are intentionally denied until correct context and membership are verified. No production Worker or database migration has been applied.
- IMPORTANT: Existing staged `can_access_sfu_room` SQL is only a draft and has not been tested with actual live room statuses; verify challenge/match statuses during a live match before applying it. Verify SFU `sessionId` formats against actual responses.
- Do not deploy staging code without a runnable test environment, rate limits, careful validation and integration tests for legitimate and forbidden room/session combinations.

## 2026-10-28 test configuration verification
- Separate config `wrangler.staging.example.jsonc` targets `dartarena-realtime-security-test`, with `SFU_ROOMS` bound to SQLite Durable Object class `SfuRoom` using migration tag `sfu-security-test-v1`.
- Configuration JSON structure and binding/migration names checked. **Cloudflare migration has not been executed**; no Cloudflare Worker has been deployed.
- Fixed a malformed `ELSIF` in the staging SQL, keeping tournament access denied.
- Read-only database inspection confirmed expected challenge and match columns exist, but observed challenge statuses include `accepted`, `cancelled`, `declined`; the draft assumes `room`. Match records observed `cancelled` and `finished`, not draft's `waiting`/`playing`. Live in-progress statuses must be verified against real application transitions.
- Thus authorization RPC remains **unapplied**, and video testing/deployment are **blocked** until room lifecycle authorization, test accounts and negative tests are verified. Never apply this prototype to the production Worker.

## Application lifecycle cross-check (2026-10-28)
- `room.js` explicitly requires challenge `status === 'room'` on entry and cancels from `room`. The historical `accepted` rows do **not** authorize video access; do not broaden the predicate to accepted.
- `match.js` allows score/video operation while match `status === 'playing'` and terminates on `finished` or `cancelled`. Staging SQL now restricts match video permission to `playing` (not unverified `waiting`).
- Database metadata and historical status counts inspected read-only. Current staging SQL is still NOT deployed: live authenticated allow/deny tests and security model review are prerequisites.
- PR #85 also needs end-to-end tests for publication/session ownership, unauthorized accounts, large bodies, browser CORS, retries and session expiry before test Worker deployment.

## Automated test run #2 (2026-10-28)
- GitHub Actions workflow run 40609670062 concluded **success**; the `Run isolated SFU security tests` step passed.
- This is a mocked unit test suite, **not** a Cloudflare Durable Object integration test, Supabase RPC integration test or actual video test.
- Deployment gate remains CLOSED pending verified database RPC on an isolated test setup, real Cloudflare Durable Object migration and authenticated multi-account positive/negative tests.
- Production `dartarena-realtime` must not be changed by this staging workflow.

## Automated test run #5 (2026-10-28)
- GitHub Actions run https://github.com/sotkajervi/DartArena/actions/runs/40609806037 concluded **success**; staging-security job and isolated test step passed after adding tournament fail-closed and malformed publish cases.
- These remain mocked tests, not a verified live Cloudflare / Supabase integration. No deployment or database schema changes authorized by this result.
