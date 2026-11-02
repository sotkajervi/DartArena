# Pre-kamp i kamprommet – overgang (utviklingsgren)

Mål: Behold nøyaktig eksisterende kampmodus. Vis dagens turneringsventerom visuelt som pre-kamp-scene inne i samme side. Begge markerer Klar, starter eller myntkast avgjøres, og scenen glir over til scoring.

## Implementert på grenen
- `pre-match-scene.js/css`: isolert scene, eksisterende `#videoGrid` flyttes og animeres (uten å klone videoelementer).
- Pre-kamp-kontroller speiler dagens Klar/starter-design, men er bevisst deaktivert.
- `match.js`: `window.DartArenaBootLiveMatch(liveMatchId)` gjør det mulig å starte kampdata/scoring etter at den nye live-match-ID-en er opprettet, uten sidenavigering. Eksisterende vanlig `match.html?id=...` starter som før.
- Sikret SFU-reconnect-guard fra forrige utviklingsgren er inkludert.

## Viktig uavklart grense
`tournament-match-room.js` oppretter kampen gjennom Supabase RPC `start_tournament_match`, etter at begge er klare; deretter kaller den `goToMatch` som rydder opp og navigerer.
Før start er SFU-rommet `{kind:'tournament_match', id:tournamentMatchId}`; kamprommet bruker `{kind:'match', id:liveMatchId}`. SFU-Worker autentiserer begge romtypene. Å flytte HTML-videoelementene alene viderefører IKKE disse SFU-sesjonene mellom rom.

## Neste konkrete implementeringssteg
1. Portér turneringsventerommets Klar/starter/myntkast-statuser og RPC inn i et separat modul-scopet pre-match-kontroller i `match.html` (unngå globale konflikter med match.js).
2. Etter RPC-suksess: bruk `DartArenaBootLiveMatch(liveId)` for å aktivere kampmotoren; bevar alle eksisterende kontroll-ID-er i kamp-layout.
3. Løs medierom-overgang: autorisert switching fra `tournament_match` til `match`, med eksplisitt lukking av gammel SFU-økt og åpning av ny (eventuelt design sikker sesjonsoverføring hvis reell kontinuitet kreves). Ikke lov «ingen ny oppkobling» før dette er bevist.
4. Kontroller hendelsesrekkefølge/reconnect, myntkast, begge Klar, gjenåpning og avslutning. Rull ikke ut uten funksjonskontroll.

Produksjonsruter og gamle venterom er uendret.
