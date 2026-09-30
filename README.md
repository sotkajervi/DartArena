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
- Best of legs og sets der spilltypen støtter det
- Felles DartArena-sluttskjerm med spilltilpasset statistikk
- Live statistikk, kamphistorikk og spectator-visning
- Turneringssystem med puljespill, cup og arkiv
- Alene-spill for 61 og Half-It
- Adminfunksjoner og changelog

## Half-It
DartArena har to Half-It-varianter:

- **Half-It (DartCounter)** – 12 runder med blant annet fargeoppgaver og tre valg i Eksakt-score.
- **Half-It (Standard)** – 13, 14, Dobbel, 15, 16, Trippel, 17, 18, 41, 19, 20 og Bull.

## Teknisk
Frontend er vanlig HTML, CSS og JavaScript. Supabase brukes til autentisering, database, RPC-funksjoner og realtime. Videotilkobling bruker WebRTC, med recovery-logikk for å gjenopprette forbindelsen ved avbrudd.

`game-router.js` er felles register for spillnavn, variant og kamprom. Nye spill bør registreres der i stedet for å hardkode URL-er flere steder.

## Felles sluttskjerm
Alle online spillrom skal laste `shared-results.css` og `shared-results.js`. Resultatsystemet følger kampens `game_variant` og bruker samme DartArena-design på tvers av X01, Cricket, Half-It og 61.

Nye spill får automatisk en generell sluttskjerm dersom det ikke finnes en egen statistikk-provider. Spillspesifikk statistikk kan registreres uten å lage en ny sluttskjerm:

```js
DartArenaResults.registerProvider('ny_variant', async (match, db) => ({
  stats: {
    [match.player1_id]: [
      { label: 'STATISTIKK 1', value: 0 },
      { label: 'STATISTIKK 2', value: 0 }
    ],
    [match.player2_id]: [
      { label: 'STATISTIKK 1', value: 0 },
      { label: 'STATISTIKK 2', value: 0 }
    ]
  },
  summary: []
}));
```

Resultatskjermen håndterer selv vinner, sluttresultat, spillerkort, knapper og DartArena-bakgrunn. Dermed skal fremtidige spill utvide statistikken, ikke bygge egne sluttskjermer.

## Struktur
- `index.html` – lobby
- `room.html` – venterom og kampforslag
- `match.html` – X01-kamprom
- `cricket.html` – Cricket-kamprom
- `half-it.html` – Half-It-kamprom
- `61-match.html` – 61-kamprom
- `shared-results.js` / `shared-results.css` – felles sluttskjerm for alle online spill
- `61.html` og `half-it-solo.html` – treningsspill
- `changelog.html` – brukerrettet endringslogg

## Lokal utvikling
Kamera og mikrofon krever vanligvis HTTPS eller `localhost`.

Med Python installert:
```bash
python -m http.server 8000
```

Åpne deretter `http://localhost:8000`.

## Historikk
Prosjektet startet 24. september 2026 og utvikles fortløpende. Se `changelog.html` for brukerrettede endringer.
