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
