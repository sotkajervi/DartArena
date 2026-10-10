# Autoscoring Lab (isolert PC-test)

## Status

Dette er **ikke en trent AI-modell** og heller ikke ferdig autoscoring. Første test er et selvstendig eksperiment med kamerabilde, geometrisk skivekalibrering og enkel bildeendringsanalyse i nettleseren. Et stabilt nytt visuelt objekt gir et **grovt forslag** basert på endringsområdets tyngdepunkt. Treffpunktet må alltid kontrolleres ved å klikke der **pilspissen treffer skiven**.

Ingen data fra dette eksperimentet brukes som kampresultater, turneringsresultater, profiler eller rangeringer. Ingen databaseendringer eller scoring-RPC-er er tatt i bruk.

## Filer

- `autoscoring-lab.html`: separat testsiden, uten kampromavhengigheter.
- `autoscoring/lab.css`: isolert layout.
- `autoscoring/lab.js`: tilgangskontroll, kamera, endringsanalyse og testlogg.
- `autoscoring/geometry.js`: kalibrering, transformasjon og beregning av dartsegment.
- `autoscoring/lobby-link.js`: kun Owner/Admin ser snarveien i lobbyens meny.
- `autoscoring/geometry.test.cjs`: tester geometri og feilsituasjoner.

## Test på PC

1. Logg inn som Owner/Admin på en HTTPS-side. Åpne **Meny → Autoscoring Lab**.
2. Velg webkamera og trykk **Start kamera**. Tillat kameratilgang i nettleseren.
3. Hele skiven skal være synlig, med jevn belysning og stabilt kamera.
4. Trykk **Kalibrer skive**, klikk i denne rekkefølgen: Bull, ytterkant på D20, D6, D3, D11. Bruk midtpunktet av de respektive dobbelfeltene på ytterkanten.
5. Fjern pilene og velg **Ta referansebilde**.
6. Når et kast gir en mulig endring, viser laben et **grovt forslag**. Klikk selve pilspissen på videoen, og trykk **Bekreft valgt treff** for å registrere fasit.
7. Etter at pilene er fjernet fra skiven, velg **Ny runde / tom skive**. Eksporter eventuelt **JSON** med resultatene.

Det finnes en manuell fallback: klikk treffpunkt og bekreft selv om et automatisk kandidatforslag ikke vises. Slike manuelle registreringer tas **ikke** med i beregnet kandidat-treffprosent.

## Sikkerhet, personvern og begrensninger

- Kameratilgang gis **kun etter en eksplisitt handling** og en serververifisert `auth.getUser()` + `is_admin()` + `is_owner()`-kontroll. Begge RPC-svar må kunne leses, og minst én rolle må være sann.
- Vanlige spillere får ikke tilgang til selve lab-grensesnittet eller kamerafunksjonene. Ved utlogging, manglende tilgang, fane-skjuling eller lukking stoppes alle kameratracks. Rollen verifiseres også periodisk.
- **Frontendfilene er offentlige.** URL-en og kildekoden kan leses av hvem som helst: klientstyrte rollegater er ikke hemmelighold eller beskyttelse for sensitive serverdata. Ikke legg inn hemmeligheter i disse filene. Det finnes ingen privilegert backend i denne prototypen.
- Video/bilder overføres **ikke** til Supabase eller andre analysetjenester. Supabase brukes bare til eksisterende innlogging og rollesjekk. Ingen bilder, lyd eller video lagres. Testresultater finnes bare i fanens minne til du selv laster ned JSON lokalt.
- Prøvemodellen kan feile ved piler som overlapper, skygger, blinkende lys, kamerabevegelse og treff nær segmentgrenser. Tyngdepunktet i en endring er **ikke** samme som pilspissens treffpunkt.
- Før ekte autoscoring bør vi utvikle/teste en egnet dartspiss-detektor og måle feil på representative kast. Den bør fortsatt ha mulighet til manuell korrigering.

Test geometri uten kamera:

```sh
node autoscoring/geometry.test.cjs
```

**Ingen eksisterende match-/turneringskode er endret**, utenom en skjult snarvei lagt til i lobbyens meny.
