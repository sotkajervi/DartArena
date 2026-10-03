# DartArena security

## Core rule

The browser is never trusted to decide authoritative match state.

For online games, authenticated browser clients may read the data allowed by RLS, but gameplay state changes must go through validated Supabase RPCs. Direct browser INSERT/UPDATE/DELETE access to `matches`, `match_throws`, and game visit/state tables is intentionally blocked.

## Public frontend code

DartArena frontend code must be treated as public, even if the GitHub repository is later made private. Any JavaScript delivered to a browser can be inspected with developer tools.

Do not rely on minification, obfuscation, a private repository, hidden URLs, or client-side checks as a security boundary.

Never commit or embed:

- Supabase `service_role` keys
- database passwords
- Cloudflare API tokens/secrets
- TURN/SFU private credentials
- private keys or `.env` files

The Supabase publishable browser key is allowed in the frontend. Its safety depends on RLS, RPC authorization and least-privilege database grants.

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

Anonymous users have no direct privileges on public DartArena application tables and no EXECUTE access to exposed `SECURITY DEFINER` RPCs.

`SECURITY DEFINER` RPCs that remain executable by `authenticated` are intentional application API endpoints and must validate `auth.uid()` plus the relevant player/admin/tournament permissions internally.

Do not grant `service_role` credentials to browser code. The browser key in this project is a Supabase publishable key and depends on RLS/RPC authorization for safety.

## Abuse protection

Public-beta write paths have server-side abuse limits. Normal use should be far below these limits.

Rate guards cover challenges, match proposals, lobby chat, tournament creation, client error logs, media telemetry, JDC results and database WebRTC signalling. The database also rejects duplicate pending challenges to the same recipient and caps user-controlled text/payload sizes where appropriate.

Rate limiting is defense in depth; it does not replace authorization or RLS.

## User-controlled text / XSS

Treat usernames, tournament names, chat text, and any future profile fields as untrusted.

- Prefer `textContent` when inserting user text into the DOM.
- If HTML templates are necessary, escape every user-controlled value with the shared escaping pattern before interpolation.
- Never interpolate chat text directly into `innerHTML`.
- Keep server-side length constraints in addition to HTML `maxlength` attributes.

## Dependencies

Core authenticated/live entry points pin `@supabase/supabase-js` to an exact version rather than floating on `@2`. When upgrading, change the pinned version deliberately and test login, Realtime, room negotiation, and all game RPCs.

## Security review checklist for a new game or RPC

Before enabling a new online game or privileged RPC:

1. Add server-side scoring/state RPCs.
2. Validate player membership, game variant, turn and legal input in SQL.
3. Keep direct authoritative table writes disabled for browser roles.
4. Add RLS SELECT policies only for the players/spectators that should see the data.
5. Explicitly revoke `PUBLIC`/`anon` EXECUTE on new `SECURITY DEFINER` functions and grant only the role that needs them.
6. Escape all displayed user-controlled text.
7. Add an abuse limit if the endpoint can create unbounded rows or expensive work.
8. Re-run Supabase security advisors.
9. Test with two ordinary accounts, not only an admin account.
10. Take a backup branch before deployment.

## Account and repository security

- Protect the GitHub owner account with 2FA/passkeys.
- Protect the Supabase owner account with 2FA.
- Keep repository write access limited to trusted collaborators.
- Never paste production secrets into issues, commits, chat logs or screenshots.
- `.env` files and private-key formats are ignored by Git.

## Known platform settings

Supabase leaked-password protection should be enabled in the project's Auth security settings.

Before opening registration beyond a small beta group, enable Supabase Auth bot protection/CAPTCHA as an additional control against automated account creation.
