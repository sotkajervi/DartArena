# DartArena security

## Core rule

The browser is never trusted to decide authoritative match state.

For online games, authenticated browser clients may read the data allowed by RLS, but gameplay state changes must go through validated Supabase RPCs. Direct browser INSERT/UPDATE/DELETE access to `matches`, `match_throws`, and game visit/state tables is intentionally blocked.

## Match creation and consent

A normal online match starts from a challenge in `room` state.

1. One participant creates a persisted `challenge_match_proposals` proposal through `propose_challenge_match`.
2. The other participant must accept that exact persisted proposal through `accept_challenge_match_proposal`.
3. Only the server-side function may create the match.
4. The low-level `create_match_from_challenge` function is not executable by browser roles.

Never add a client-side shortcut that inserts a row directly into `matches`.

## Scoring

- X01 normal visits: `submit_x01_visit`
- X01 checkout: `submit_match_checkout`
- X01 correction: `correct_x01_throw` / `correct_throw_to_checkout`
- Cricket: `submit_cricket_visit` / `correct_last_cricket_visit`
- Half-It: `submit_half_it_visit` / `submit_half_it_standard_visit`
- 61: `submit_sixty_one_attempt` and the dedicated 61 RPCs

Every gameplay RPC must verify at minimum:

- `auth.uid()` exists
- the caller is a player in the referenced match
- the match/game variant is correct
- the match is active when a mutation requires it
- it is the caller's turn when applicable
- supplied scores/darts/results are within the game's legal range

Future games should follow the same pattern before they are added to the router.

## Cancellation and player presence

Normal online match cancellation uses `cancel_match`.

Player `in_game` / `unavailable` transitions are also synchronized by a database trigger so closing a tab does not become part of the security model.

Tournament matches keep their dedicated tournament RPC flow because cancellation also has to reset the bracket row.

## RLS and privileges

RLS is enabled on public application tables. In addition to RLS, write privileges are revoked from browser roles for authoritative game-state tables. This is deliberate defense in depth.

Anonymous users have no EXECUTE access to public DartArena RPCs.

Do not grant `service_role` credentials to browser code. The browser key in this project is a Supabase publishable key and depends on RLS/RPC authorization for safety.

## User-controlled text / XSS

Treat usernames, tournament names, chat text, and any future profile fields as untrusted.

- Prefer `textContent` when inserting user text into the DOM.
- If HTML templates are necessary, escape every user-controlled value with the shared escaping pattern before interpolation.
- Never interpolate chat text directly into `innerHTML`.
- Keep server-side length constraints in addition to HTML `maxlength` attributes.

## Dependencies

Authenticated/live entry points pin `@supabase/supabase-js` to an exact version rather than floating on `@2`. When upgrading, change the pinned version deliberately and test login, Realtime, room negotiation, and all game RPCs.

## Security review checklist for a new game

Before enabling a new online game:

1. Add server-side scoring/state RPCs.
2. Validate player membership, game variant, turn and legal input in SQL.
3. Keep direct table writes disabled for browser roles.
4. Add RLS SELECT policies only for the players/spectators that should see the data.
5. Escape all displayed user-controlled text.
6. Re-run Supabase security advisors.
7. Test with two ordinary accounts, not only an admin account.
8. Take a backup branch before deployment.

## Known platform setting

Supabase's leaked-password protection should be enabled in the project's Auth security settings. This is a project-level Auth setting rather than application SQL.
