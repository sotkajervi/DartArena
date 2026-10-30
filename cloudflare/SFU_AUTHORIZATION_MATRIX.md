# Authorization matrix — staged design

Do not deploy. Draft for review; exact tournament waiting-room schema and spectator behavior
must be verified before implementation.

| Context | Publisher | Subscriber |
|---|---|---|
| Challenge waiting room | Challenger/challenged while challenge is in `room` state | Same two participants |
| Ordinary match | Match participants while active | Same two participants |
| Tournament waiting room | Exact assigned participants in active waiting room | Assigned participants; approved audience only if feature explicitly supports it |
| Spectator | Never by default | Only for explicitly spectator-visible match and authorized spectator role |
| Other signed-in user | Deny | Deny |
| Anonymous | Deny | Deny |

## Server-side session access design
1. Validate Supabase access token using Supabase Auth server-side, not client-decoded JWT.
2. Verify **each** requested action against a room-specific authorization result.
3. On `/session`, associate the SFU session with `userId`, `roomKind`, `roomId`.
   Do not rely on the caller-supplied session ID alone; use a Worker-owned session
   store (Durable Object / strongly consistent storage) or cryptographic proof
   with appropriate expiration and session context.
4. `publish` and `renegotiate` must operate only on the caller's owned session.
5. `subscribe` must enforce that the publication belongs to the *same* room and
   an allowed publisher, independently of who supplied the published sessionId.
6. Enforce expiration, cleanup, quotas and reconnect behavior.
7. A database policy allowing SELECT on `tournament_matches` for everyone
   **is not** video authorization.
8. Include negative tests with other signed-in accounts and guessed published IDs.

## Database check performed (read-only)
- `challenges` SELECT RLS is limited to challenger or challenged.
- `matches` SELECT includes participants but also certain tournament matches.
- `tournament_matches` SELECT policy allows all users.
- `tournaments` SELECT policy allows all users.

See `can-access-sfu-room.staging.sql` for a *partial* proposed helper.
The helper currently intentionally rejects tournament use and must not be
deployed or consumed by the production Worker.
