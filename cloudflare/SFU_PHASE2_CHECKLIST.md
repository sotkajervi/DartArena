# SFU fase 2 – isolert integrasjon (30.10.2026)

**Gren:** `feature/sfu-phase2-integration-20261030` (opprettet fra `security/sfu-auth-staging-20261028`). **Ikke produksjon.**

## Bekreftet før kodeendringen
- Isolert `/video-test`: to forskjellige kontoer fikk både lyd og video i aktivt venterom og i aktiv 501-kamp.
- Etter avsluttet 501-kamp ble ny romtilgang avvist med HTTP 403.
- Dette dokumenterer separat SFU-videotest, **ikke** integrert mediaflyt, automatisk lukking av eksisterende sessions eller godkjent sikkerhet mot alle angrep.

## Inkludert i denne fasen
- Tving SFU på **preview-hostname**, ikke på ordinær DartArena, og ikke gjennom en query-parameter.
- Rut SFU for standard venterom og 501-kamp med samme rom-ID som DartArena bruker; behold ordinære spill- og scoringtabeller.
- Bruk valgt kamerastream / Zoom-cam i SFU-transporten. Bytte av track forsøker republisering.
- Ta med ny post-match media cleanup: ferdig kamp + synkronisert tilstedeværelse + én spiller har forlatt -> video/lyd lukkes etter 15 sekunders margin. En eksplisitt «Lukk kampfane» signaliserer avreise og viser resultatet hos gjenværende spiller.
- SFU-modulen har `stop()` og stopper sine timere, channel og RTCPeerConnections. Videorouteren kan ikke starte SFU etter post-match shutdown.
- Testene er automatiserte, men integrasjon med to reelle klienter må fortsatt verifiseres.

## Gjennomfør faktisk integrert videotest etter godkjent isolert preview-deploy
1. Verifiser at preview er oppdatert fra denne grenen, og at test Worker fortsatt er `dartarena-realtime-security-test`.
2. Logg inn på **preview** med to testkontoer på hver sin enhet.
3. Send én vanlig 501-utfordring via preview; åpne venterommet på begge.
4. Kontroller at lyd/video vises **direkte i venterommet**, uten egen /video-test-fane. Åpne `#roomSfuDebug` om det oppstår problemer, og noter eventuelle feil – ikke del tilgangstoken.
5. Godta 501 og kontroller automatisk navigasjon til `match.html?id=...` på preview. Kontroller nytt SFU-session/rom-ID, 2 kameraer og lyd begge veier.
6. Bytt kamera/Zoom-cam, test poengregistrering, et kort nettbrudd og reconnect; kontroller at lyd og video overlever eller kobles til på nytt.
7. Avslutt 501 og la begge bli på resultatsiden: video kan fortsatt være aktiv så lenge begge er til stede.
8. La én spiller velge «Lukk kampfane». Kontroller at gjenværende spillers lyd/video stopper, resultat/statistikk beholdes, og SFU ikke starter igjen.
9. Kontroller at gammel match-ID gir HTTP 403 for ny romtilgang. Test også en ikke-deltakende konto: ingen tilgang til publisering/abonnement.

## Begrensninger
- Ikke anta at tilskuervideo, turneringsventerom, Zoom-cam eller reconnect er ferdig testet før reelle end-to-end prøver.
- **Ingen av denne grenens commits har noen deploy-markør.** Eksisterende produksjons-Worker, `main` og Supabase-skjema skal ikke røres.
- For å distribuere preview må endringene først bringes inn i beskyttet staging-gren, der test/publisering krever separat GitHub environment-godkjenning. Ikke distribuer fra denne grenen til produksjon.
- Preview bruker samme Supabase prosjekt som DartArena. Bruk testkontoer og en kort, kontrollert kamp for å unngå å påvirke ekte kamper.

## Preview-deploy-kontroll (30.10.2026)
Denne staginggrenen inneholder nå den sammenslåtte fase 2-integrasjonen fra PR #89.
En ny GitHub Actions-kjøring med markøren [deploy-sfu-preview] ber om godkjenning i miljøet `cloudflare-security-test` før noen publisering.
Bare test-Worker og separat frontend-preview er deploymål. `main`, produksjons-Worker og aktive kamper endres ikke av denne koden.
Kontroller at sikkerhetsjobben er grønn og at preview har riktig kilde før du godkjenner. Test med to testkontoer etterpå.

## Waiting-room latency verification (2026-10-30)
Two real preview clients connected audio+video but took approximately 15 s and 30 s to show the other player. Their debug logs showed repeated identical remote publication announcements every ~1.8 s and no retained startup timing. This is not proof of the root cause.

PR #90 merged into isolated security staging only. It adds an eight-second grace period for first video frames (instead of repeatedly tearing down subscriptions), and retains startup timing logs by suppressing duplicate publication announcements. Automated waiting-room regression tests passed. **Real-world latency improvement remains unverified.**

Next isolated preview test: have two users connect using a fresh room, record time until camera/audio on each side and copy debug immediately after the first video frame. Compare MODULE loaded, CHANNEL, PUBLISH start/ok, REMOTE publication changed, SUBSCRIBE start/ok, REMOTE first video frame. Do not share access tokens, passwords, or session IDs. Do not promote to production on timing tests alone.

Request protected isolated preview redeploy only: [deploy-sfu-preview]

## Test newest remote publication first (2026-10-30)
Real-world player logs showed an old subscription delayed approximately 9.4 s when the opponent created a newer video publication. PR #91 changes isolated waiting-room/client code to immediately preempt old in-flight subscriptions, ignore transient empty announcements, and guard against stale WebRTC callbacks and session IDs. The repair is tested (https://github.com/sotkajervi/DartArena/actions/runs/41139358593), and merged staging CI passed (https://github.com/sotkajervi/DartArena/actions/runs/41139443430). These automated checks do **not** establish real video latency.

Request approval-gated isolated test deploy: [deploy-sfu-preview]

## Authenticated X01 room context – 2026-10-30

Integrated 501 preview test reached the match page with a local camera picture but remote video black for over one minute. Diagnosed a missing authorization context in `match-sfu-media.js`: it instantiated the SFU client without `{kind:'match',id:<match UUID>}`, so the security gateway correctly denied all media sessions. Venterommet already supplied `{kind:'challenge',id:challengeId}`.

PR #92 fixes exact match kind/ID, shows a visible camera-start failure if SFU publish fails, refreshes asset cache versions, and adds an actual request-header regression test. Branch workflow succeeded: https://github.com/sotkajervi/DartArena/actions/runs/41140277662. The protected staging workflow now also checks match-room headers before any preview deployment.

Deployment request only for `dartarena-sfu-preview` plus `dartarena-realtime-security-test`; no main branch or production Worker changes: [deploy-sfu-preview]

After approval and successful deploy: open a FRESH 501 challenge with two test users, check both preview waiting room video and both preview match video. Check audio and scoring, then leave one completed match and verify post-match cleanup. A live successful match test is required before considering the feature production-ready.

## Match media recovers after temporary network loss – 2026-10-31

Real two-PC test revealed one-sided recovery after one player's ~10 s network outage: the returning player saw the opponent again, but the opponent's video from the returning player remained missing. Root cause: local media tracks stay live while the SFU publisher RTCPeerConnection can be dead; the periodic watcher reused the stale publisher because the track signature did not change.

Fix in PR #93 (merged ONLY to isolated SFU staging): browser offline/online recovery forces a NEW Cloudflare publisher session; unhealthy publisher connection/ICE state can independently cause repair after grace; a newly announced publication immediately supersedes a pending old match subscription. Cooldown avoids busy loops, cleanup removes reconnect listeners. Production is untouched.

Validation:
- Branch functional regression: https://github.com/sotkajervi/DartArena/actions/runs/41142253145 – pass.
- Merged staging security and regression gate: https://github.com/sotkajervi/DartArena/actions/runs/41142354969 – pass.
- New tests include offline/online, ICE fail, short vs prolonged disconnect, superseded remote publisher, and cleanup.

Request approval-gated deployment of **only** the isolated preview and isolated authorized SFU Worker: [deploy-sfu-preview]

After deployment, repeat same live 501 two-computer network test: disconnect one PC for ~10s, reconnect WITHOUT F5, and verify BOTH remote videos and both-way audio recover. Check scoring still synchronized. Do not deploy to main or production without separate explicit authorization and comprehensive checks.

## Mute must not interrupt video – 2026-10-31

During live 501 SFU test, switching the local microphone off caused remote video to cut out. Root cause: `room-sfu-media.js` and `match-sfu-media.js` included MediaStreamTrack.enabled in their publication signatures. `match-controls.js` mutes the microphone by changing audioTrack.enabled. That incorrectly made both SFU watchers replace the entire publisher session, also interrupting video.

PR #94 fixes waiting-room and match signatures to track only kind/id/readyState, retaining new-device detection and keeping microphone mute/unmute and camera enable/disable on the same SFU session. Updated only isolated preview asset cache keys. Added regressions for both flows and included them in staging predeploy gate.

Verification:
- Isolated branch CI pass: https://github.com/sotkajervi/DartArena/actions/runs/41143253938
- Merged security staging CI pass: https://github.com/sotkajervi/DartArena/actions/runs/41143345748

Request approval-gated deployment of ONLY isolated `dartarena-sfu-preview` and `dartarena-realtime-security-test`: [deploy-sfu-preview]

Live retest with two PCs: in waiting room and a 501 match, mute/unmute microphone repeatedly and verify both cameras remain continuous and microphone stops/returns. Then perform a separate ten-second offline/online test WITHOUT F5; a successful recovery only after reloading does not count as automatic reconnect. Production remains untouched.

## Incoming SFU sound after temporary network outage – 2026-10-31

On real two-PC X01 SFU test, video reconnected without reload after ~10s disconnection but the disconnected player's **incoming sound** required an F5 refresh. This means video reconnect is fixed, audio not yet.

PR #95 is merged **only** into isolated staging. It restores the **inbound SFU subscriber** after the browser returns online (not only the outbound publisher), and repairs failed/closed or prolonged-disconnected subscriber PeerConnections, or a missing expected audio track after grace. Attempts are rate limited. It also prevents the old match-controls audio timer from overriding the SFU audio-autounlocker, and retries `video.play()` when remote media is unmuted but still paused.

Tests: branch workflow https://github.com/sotkajervi/DartArena/actions/runs/41144600154 – 42 passed; stage security https://github.com/sotkajervi/DartArena/actions/runs/41144685188 – passed. Both are code/simulation validations, not a substitute for a two-PC test.

Request the standard approval-gated **isolated test-only** Cloudflare preview deployment: [deploy-sfu-preview]

Once deployed: open a **new** 501 match on both PCs; disconnect internet on one PC for ~10s, then reconnect WITHOUT F5; confirm BOTH remote video and incoming audio return automatically. Repeat microphone mute/unmute briefly to ensure earlier fix is preserved. If browser policy denies autoplay, explicit "Slå på lyd" must be shown, not silent failure. Do not deploy main or production Worker without separate approval.

## Tournament 501 microphone choice and spectator 403 retry storm – 2026-10-31

In a live two-PC tournament test, waiting room sound/video worked but Bjørn account could not hear opponent in the resulting X01 match. Player-side SFU debug showed a live, unmuted inbound audio track, connected subscriber, unpaused remote video, and volume 1. Opponent's physical outgoing microphone was "Mikrofonrekke (Intel Smart Sound Technology)", i.e. the browser default built-in microphone. This does **not** prove hardware mic silence; it indicates the chosen microphone from the waiting room may have been lost.

PR #96 (merged **only** to staging) fixes that mismatch in X01. `match-preferred-media.js` uses the `dartarena-preferred-microphone` saved by the tournament waiting room; it retains Zoom-cam and handles unplugged/invalid camera/microphone device IDs by falling back to available defaults, never by masking permission errors.

Preview also got a **fail-closed** guard against repeated unauthorized `/api/sfu/session` calls from `match-spectator-broadcast.js`: the isolated Worker does not support spectator publishing context, so spectator video is disabled in this preview until a separate secure design is implemented. This is **not a spectator feature fix** and must be tracked before production. Main and production Worker remain unchanged.

Verification: https://github.com/sotkajervi/DartArena/actions/runs/41199819644 (test suite passes) and https://github.com/sotkajervi/DartArena/actions/runs/41199889020 (staging security passes).

Request approval-gated deployment **only** to the isolated frontend preview and isolated security-test Worker. [deploy-sfu-preview]

After successful approval/deploy, open a NEW 501 tournament match with both users. In waiting room choose the desired microphone on each account and check the level meter; after navigation to the live match confirm the outgoing microphone label matches selected input, both users hear each other, scoring and Zoom-cam still work, and spectator 403 floods have stopped. Do not interpret audio as repaired until verified in a real match. Production untouched.

## Four-player canary and safe fallback – 2026-10-31

PR #97 (merged ONLY to isolated staging) detects mixed frontend versions in the tournament waiting room. If one participant uses ordinary DartArena or a stale client while their opponent is on isolated SFU preview, the preview blocks «Jeg er klar» and shows the correct link. Both preview participants retain the normal flow. Adds a visible notice that preview spectator video is unavailable.

Backup of the known working main site has been created at `backup/pre-sfu-production-20261031`, sourced from `5f15a68cd12621ccf91dc9549f2296b3c0047c17`. See `cloudflare/SFU_TOURNAMENT_CANARY_ROLLBACK_20261031.md` for a rollback procedure that **does not require a production deploy** and never promises seamless in-flight room handoff. Both sites share Supabase tournament state; no automatic database rollback.

Branch tests: https://github.com/sotkajervi/DartArena/actions/runs/41202041826 – success.
Staging security: https://github.com/sotkajervi/DartArena/actions/runs/41202184277 – success.

Request approval-gated deployment to only isolated SFU frontend preview, not main or production Worker: [deploy-sfu-preview]

Live criterion: four real players in two parallel rooms, correct bidirectional audio and video on each, no cross-room media, valid results + cup progression, and no 403 loop. **If live criterion fails, all players use old main site, and organizer verifies tournament status before continuing.** Preview does not support spectator video. Production unchanged.
