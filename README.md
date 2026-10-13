# DartArena

DartArena er en nettbasert dartplattform for onlinekamper, treningsspill og turneringer.

## Hovedfunksjoner

- Online lobby med profiler, tilgjengelighetsstatus og utfordringer
- Venterom med valg av kamera og mikrofon
- WebRTC-video og lyd i kamprom
- X01: 170, 301, 501 og 1001
- Cricket
- Half-It (DartCounter)
- Half-It (Standard)
- 61 med tidsformat og sudden death
- JDC Challenge med 57 piler, badge/tier og Top 10
- Best of legs og sets der spilltypen støtter det
- Felles DartArena-sluttskjerm for både onlinekamper og alene-spill
- Live statistikk, kamphistorikk og spectator-visning
- Turneringssystem med puljespill, cup og arkiv
- Alene-spill for 61, Half-It og JDC Challenge
- Adminfunksjoner og changelog

## Half-It

DartArena har to Half-It-varianter:

- **Half-It (DartCounter)** – 12 runder med blant annet fargeoppgaver og tre valg i Eksakt-score.
- **Half-It (Standard)** – 13, 14, Dobbel, 15, 16, Trippel, 17, 18, 41, 19, 20 og Bull.

## JDC Challenge

`jdc-challenge.html` følger 57-pilersformatet med Shanghai 10–15, D1–D20 + Bull og Shanghai 15–20. Resultatet valideres og beregnes i Supabase via `submit_jdc_challenge`; nettleseren kan ikke skrive en valgfri sluttscore direkte til resultat-tabellen.

Beste resultat per spiller vises i Top 10 og gir tier fra White til Gold. `jdc-tier.css` brukes til den lille tier-prikken som blant annet vises ved spillernavnet i Form stats.

## Teknisk

Frontend er i dag vanlig HTML, CSS og JavaScript. Supabase brukes til autentisering, database, RPC-funksjoner og realtime. Videotilkobling bruker WebRTC, med recovery-logikk for å gjenopprette forbindelsen ved avbrudd.

Ny og gradvis migrert kode legges under `src/` og skrives i TypeScript. Eksisterende fungerende root-JavaScript flyttes ikke bare for å pynte strukturen; migrering skjer når en del faktisk jobbes med og kan testes kontrollert.

`game-router.js` er felles register for spillnavn, variant og kamprom. Nye online spill bør registreres der i stedet for å hardkode URL-er flere steder.

For utfordringer håndterer `app.js` innkommende invitasjoner og ordinær lobbyoppdatering. `challenge-outgoing.js` holder oversikt over sendte utfordringer og avgjør når en nylig godtatt invitasjon skal åpne venterommet. Den gamle ekstra `room`-statusspørringen ved hver lobbyoppdatering er fjernet; behold én slik beslutningsflyt for å unngå dobbeltåpning. Realtime- og fallback-mekanismene for sent-listen er beholdt.

**Samme fane for vanlige onlinekamper:** «Utfordre» sender bare en invitasjon og lar avsender bli i lobbyen. Når invitasjonen godtas, navigerer både avsender og mottaker til eksisterende `room.html` i den samme fanen. Venterommet navigerer deretter videre til kamprommet i samme fane, og «Avbryt venterom» går tilbake til lobbyen. Ingen popup-tillatelse er nødvendig for denne flyten. Gamle, allerede godtatte invitasjoner åpnes ikke automatisk ved F5 eller innlogging; de kan åpnes manuelt via «Gå til venterom» eller «Åpne». Under vanlige onlinekamper åpner knappen «Åpne lobby i ny fane» en separat lobbyfane, slik at webcam, lyd og scoring blir værende i kampfanen. Ved gjentatte klikk brukes den samme lobbyfanen. Etter avsluttet kamp kan sluttresultatskjermen fortsatt gå til lobbyen i samme fane. Hvis en spiller går til lobbyen under pågående kamp, viser lobbyen «Gå tilbake til kamp» uten automatisk omdirigering.  Vanlig venterom og online-JDC-kamprom har også «Åpne lobby i ny fane», som ikke avbryter rommet eller stopper den aktive mediesesjonen. «Avbryt venterom» og «Avbryt kamp» er fremdeles egne handlinger. Alle disse knappene bruker samme navngitte lobbyfane. Turneringsventerom og turneringskamprom har også «Åpne lobby i ny fane». Turneringsknappen vises bare i faktiske turneringskamper, og påvirker ikke «Til turnering», «Avbryt kamp», kameratilkobling, scoring eller resultatsynkronisering. Oppførselen ved åpning fra turneringsoversikten er foreløpig uendret. Når turneringsleder bekrefter «Start puljespill», mottar påmeldte spillere og turneringsleder som befinner seg i hovedlobbyen en DartArena-popup: «Puljene er klare». Etter åtte sekunder går de til turneringssiden i samme fane, eller de kan velge «Gå til turneringen» / «Bli i lobbyen». Forhåndstrekking, innlogging etter start, tilskuere og spillere i en pågående kamp utløser ikke automatisk navigasjon.

### Kodestruktur

- `src/components/` – små gjenbrukbare UI-komponenter og render-hjelpere
- `src/pages/` – sideflyt og orkestrering
- `src/lib/` – gjenbrukbar domenelogikk, Supabase-, WebRTC- og hjelpefunksjoner
- `src/hooks/` – gjenbrukbar browser-/event-livssyklus når det faktisk trengs
- `src/types/` – delte TypeScript-typer

Kodestandardene og migreringsreglene står i `CONTRIBUTING.md`. Sikkerhetsreglene står i `SECURITY.md`.

## Felles sluttskjerm

Alle spill skal bruke `shared-results.css` og `shared-results.js`. Resultatsystemet bruker samme kompakte DartArena-design og lar dartskivebakgrunnen være synlig bak resultatkortet.

For onlinekamper følger systemet kampens `game_variant`. X01, Cricket, Half-It og 61 har egne statistikk-providere. En ny online spillvariant får automatisk en generell sluttskjerm dersom den ennå ikke har en egen provider.

Spillspesifikk online-statistikk kan registreres uten å lage en ny resultatside:

```js
DartArenaResults.registerProvider('ny_variant', async (match, db) => ({
  stats: {
    [match.player1_id]: [
      { label: 'STATISTIKK 1', value: 0 },
      { label: 'STATISTIKK 2', value: 0 },
    ],
    [match.player2_id]: [
      { label: 'STATISTIKK 1', value: 0 },
      { label: 'STATISTIKK 2', value: 0 },
    ],
  },
  summary: [],
}));
```

Alene-spill bruker samme skjerm via `DartArenaResults.showSolo(...)`. Dermed skal fremtidige spill bare levere tittel, score, relevante stats og knappehandlinger; de skal ikke bygge egne sluttskjermer.

## Struktur

- `index.html` – lobby
- `room.html` – venterom og kampforslag
- `match.html` – X01-kamprom
- `cricket.html` – Cricket-kamprom
- `half-it.html` – Half-It-kamprom
- `61-match.html` – 61-kamprom
- `shared-results.js` / `shared-results.css` – felles sluttskjerm for alle spill
- `61.html`, `half-it-solo.html` og `jdc-challenge.html` – treningsspill
- `src/` – TypeScript-kilde for ny og gradvis migrert kode
- `changelog.html` – brukerrettet endringslogg

## Lokal utvikling

Kamera og mikrofon krever vanligvis HTTPS eller `localhost`.

Med Python installert:

```bash
python -m http.server 8000
```

Åpne deretter `http://localhost:8000`.

For TypeScript, linting og formatering:

```bash
npm install
npm run check
```

`npm run check` kjører TypeScript-kontroll, ESLint og Prettier-sjekk for `src/`, samt Node-baserte regresjonstester for lyd, invitasjoner og lobby-snarveier. Legacy root-filer masseformateres ikke.

`npm run test:audio`, `npm run test:invites` og `npm run test:lobby` kan også kjøres separat. Disse testene er isolerte kode- og struktursjekker; kamera, lyd og kampflyt må i tillegg testes med ekte nettlesere og to brukere.

### Sikker opprydding og tilbakeføring

Gjør opprydding i en egen branch, i små pull requests. Endre ikke scoringsmotor, WebRTC eller database samtidig med ren CSS-/struktur-opprydding. Dokumenter hvilken commit på `main` arbeidet startet fra. Dersom en squash-merget pull request skaper feil, kan den normalt reverseres med GitHubs **Revert** (eller ved å revert-e den aktuelle merge-commiten). En kode-revert endrer ikke allerede lagrede data eller databaseendringer.

**Teststatus per 13. oktober 2026:** Manuell verifisering av invitasjoner, venterom, kamera, lyd og gjenoppkobling er gjennomført. Testen av scoring, Bust, Angre, fullført leg, resultatlagring og statistikk (test 11) er utsatt; det er ikke grunnlag for å rydde i scoringslogikken før den er gjennomført.

## Historikk

Prosjektet startet 24. september 2026 og utvikles fortløpende. Se `changelog.html` for brukerrettede endringer.
