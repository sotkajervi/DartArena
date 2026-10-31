# DartArena videobryter – nødrutine 31.10.2026

## Rollback-punkt
`rollback/20261031-before-sfu-owner-switch` (SHA `5f15a68cd12621ccf91dc9549f2296b3c0047c17`) er en uendret kopi av fungerende `main` før utrullingen.

## Global Owner-bryter
Hovedlobbyen viser en **Owner-only** kontroll med `Gammel video` og `Ny SFU`.
Valget lagres i Supabase-tabellen `public.media_transport_config` (`id=1`), med RLS:
- Authenticated kan lese; bare bruker med `public.is_owner()` kan endre `mode`.
- Standardverdi er `legacy`, og ethvert leseproblem i klienten faller tilbake til gammel video.
- Det finnes ingen `localStorage`- eller URL-parameter som kan aktivere dette.
- Valget gjelder **når en ny side/venterom/kamprom åpnes**. En aktiv videostrøm skifter ikke teknologi sømløst midt i kampen.

## Transporter
- `legacy`: dagens publiserte Peer-først, eksisterende Cloudflare fallback, og eksisterende turneringsmedier via `dartarena-realtime`.
- `sfu`: en separat autentisert SFU-klient mot `dartarena-realtime-security-test`. Hvert request må ha bruker-token, romtype og id; gateway + Supabase RPC avgrenser brukere.
- Tilskuervideo publiseres **ikke** i den nye modusen, siden autorisasjon for tilskuere ikke er implementert.
- Staging-/testgateway er midlertidig transport for forsøksdrift, **ikke endelig produksjonsinfrastruktur**. Kapasitet/stabilitet for større turneringer er ikke dokumentert.

## Hvordan bruke på kveldens turnering
1. Før spillerne går inn i nye kamprom: Owner velger `Ny SFU` i hovedlobbyen.
2. Alle spillere bruker https://sotkajervi.github.io/DartArena/ (ingen testadresse).
3. Bekreft at lyd og bilde fungerer mellom to spillere, før alle andre kamper starter.
4. Test minst to samtidige kamper, lyd/video per rom, mikrofon mute/unmute, 501 og cup-progresjon.
5. Hvis SFU feiler: Owner velger `Gammel video`. **Begge spillere** i berørte kamprom forlater/åpner kamprom på nytt via turneringslobbyen (ikke nødvendigvis annuller kampen).
6. Kontroller at motstander får lyd/video og at poengstillingen er korrekt. Ikke skriv over resultat eller avbryt kamp automatisk.
7. Ikke bytt videomodus midt i en aktiv kamp hvis dere kan unngå det. Bytt mellom kamper for lavest risiko.

## Viktige begrensninger
- Nødbryteren er ikke 15-minutters garanti og er **ikke** et hot-swap inne i åpne WebRTC/Cloudflare-sesjoner.
- Hvis aktiv kamp har ødelagt status, kan arrangøren måtte håndtere omstart. Resultater ligger i Supabase og er ikke del av kode-rollback.
- Ved alvorlig kodefeil kan rollback-grenen brukes til å gjenopprette `main`; dette krever egen GitHub-publisering og er mer inngripende enn bryteren.
- Ikke deploy produksjons-SFU Worker eller overskriv gammel Worker som del av forsøket.
