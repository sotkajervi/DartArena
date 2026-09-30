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
- Felles DartArena-sluttskjerm for både onlinekamper og alene-spill
- Live statistikk, kamphistorikk og spectator-visning
- Turneringssystem med puljespill, cup og arkiv
- Alene-spill for 61 og Half-It
- Adminfunksjoner og changelog

## Half-It

DartArena har to Half-It-varianter:

- **Half-It (DartCounter)** – 12 runder med blant annet fargeoppgaver og tre valg i Eksakt-score.
- **Half-It (Standard)** – 13, 14, Dobbel, 15, 16, Trippel, 17, 18, 41, 19, 20 og Bull.

## Teknisk

Frontend er i dag vanlig HTML, CSS og JavaScript. Supabase brukes til autentisering, database, RPC-funksjoner og realtime. Videotilkobling bruker WebRTC, med recovery-logikk for å gjenopprette forbindelsen ved avbrudd.

Ny og gradvis migrert kode legges under `src/` og skrives i TypeScript. Eksisterende fungerende root-JavaScript flyttes ikke bare for å pynte strukturen; migrering skjer når en del faktisk jobbes med og kan testes kontrollert.

`game-router.js` er felles register for spillnavn, variant og kamprom. Nye spill bør registreres der i stedet for å hardkode URL-er flere steder.

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
- `61.html` og `half-it-solo.html` – treningsspill
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

`npm run check` kjører TypeScript-kontroll, ESLint og Prettier-sjekk for den nye `src/`-koden. Legacy root-filer masseformateres ikke.

## Historikk

Prosjektet startet 24. september 2026 og utvikles fortløpende. Se `changelog.html` for brukerrettede endringer.
