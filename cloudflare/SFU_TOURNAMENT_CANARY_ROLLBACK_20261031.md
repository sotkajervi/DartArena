# SFU canary-turnering og returløsning – 31. oktober 2026

**Mål:** Teste flere samtidige kamper uten å endre hovedsiden eller produksjons-Worker.

## Behold reserveversjonen

- Nåværende produksjonskode er lagret på GitHub som `backup/pre-sfu-production-20261031`, opprettet fra commit `5f15a68cd12621ccf91dc9549f2296b3c0047c17`.
- Produksjon: https://sotkajervi.github.io/DartArena/
- Separat SFU-test: https://dartarena-sfu-preview.sotkajervi.workers.dev/
- **Ingen sammenslåing til `main` eller oppdatering av produksjons-Worker for denne prøven.**
- Test og produksjon bruker samme Supabase-backend for turneringsdata. De er **ikke** to isolerte databaser.
- Testpreview bruker Cloudflare-Worker `dartarena-realtime-security-test`. Prod bruker `dartarena-realtime`. Disse mediene er ikke automatisk kompatible.

## Før turneringen

1. Send **testadressen** til samtlige spillere. Ingen får delta fra hovedsiden i samme SFU-kamp.
2. I venterommet bekreft mikrofonmåler, lyd fra motstander og begge bilder før begge trykker «Jeg er klar».
3. Test én runde med **minst fire spillere, to parallelle 501-kamper**. Kontroller at ingen får lyd eller video fra feil kamprom.
4. Observer at kampresultater og videre avansement til cup blir registrert.
5. Preview-versjonen har **ikke tilskuervideo**. Ikke planlegg tilskuer-video i denne prøven.

## Hvis det oppstår feil

1. Stopp nye kamper; dokumenter hvilken kamp/leg som feilet.
2. **Alle** involverte må forlate/stenge SFU-preview. Ikke bytt bare én spiller til hovedsiden; forskjellige nettsteder bruker forskjellige medie-Workers.
3. Åpne https://sotkajervi.github.io/DartArena/ for **alle** spillerne, og start fra turneringslobbyen.
4. Sjekk kampstatus og resultat i lobbyen før en ny kamp startes. Supabase-databasen er felles, så tidligere score kan finnes, men **ingen garanti for sømløs gjenopptakelse av et aktivt kamprom mellom de to versjonene**.
5. Hvis en pågående kamp ikke lar seg gjenoppta trygt på hovedsiden, må arrangøren rydde opp via eksisterende turneringsfunksjoner før omkamp. Ikke slett/snulllstill turneringsdata automatisk.
6. Hvis hovedsiden også feiler, ikke gjør produksjonsdeploy under pågående turnering; stopp og feilsøk med dokumentert tilstand.

## Status for produksjonslansering

Det som er bestått: To spillere har fullført pulje+cup, med lyd og video i både venterom og kamp.

Det som **ikke** er bestått: To parallelle kamper med fire+ reelle spillere, tilskuervideo/autorisasjon, stor belastning, og full regresjon av alle online/spillmoduser. En bestått canary-turnering er nødvendig, men ikke alene tilstrekkelig til generell produksjonslansering.

Ikke slå på SFU for alle på hovedsiden bare fordi én canary-turnering fungerer. Planlegg separat godkjent produksjonsutrulling med verifisert gateway, tilgangskontroll, feature-flag og rollback.
