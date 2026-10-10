# Autoscoring Lab – isolert AI-test på PC

## Hva er implementert?

Autoscoring Lab har nå **ekte lokal ONNX-inferens** gjennom [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html), i tillegg til enkel bildeendringsanalyse. Ingen eksisterende kamprom, kampscore eller Supabase-databaser er endret.

**Viktig:** Det følger foreløpig **ingen ferdigtrent dart-tip-modell** med prosjektet. AI-analyse er aktiv først etter at en Owner/Admin laster inn en **lovlig lisensiert, kompatibel** `.onnx`-fil fra PC-en. Uten filen fungerer fortsatt den tidligere regelbaserte testen. Vanlige YOLO-modeller (COCO/personer) kan ikke brukes til pilspissdeteksjon uten trening.

Første AI-støtte omfatter:
- En lokalt valgt ONNX-modell leses som bytebuffer, lastes via ONNX Runtime Web i nettleseren og brukes på bildet fra **samme videoelement** som kalibreringen.
- YOLOv8/YOLO11 med **én klasse og standard ONNX-export uten NMS** (modellutgang `[1,C,N]` eller `[1,N,C]`). For pose-modeller gjelder én dart-tip-nøkkelpunktindeks valgt i GUI; det er modellens oppgave å definere hvilken indeks som er pilspissen.
- Modellens koordinater knyttes til geometrien fra fempunktskalibreringen og omregnes til dartscore.
- Inferens kan startes manuelt med «Analyser kamerabilde», og den kjøres ved deteksjon av mulig nytt kast.
- Modellforslaget vises i **magenta**. Spilleren klikker selve treffpunktet (**grønn** markering) og bekrefter fasit. «AI-treffprosent» tar bare med bekreftede kast der en virkelig modell leverte et forslag. Regelbaserte estimater regnes ikke som AI.
- Lokalt nedlastbar JSON-logg med modellnavn, modellkonfidens, forslag og korrigert fasit – **uten bilde/video**.

## Slik tester du

1. Logg inn som Owner/Admin over HTTPS. Gå til **Meny → Autoscoring Lab**.
2. Velg en ferdigtrent `.onnx`-modell på PC-en, kontroller at lisensen tillater bruk, og trykk **Last inn AI-modell**. Nettleseren kan laste ONNX Runtime Web fra det fastlåste CDN-et. Modellen lastes ikke opp til noen server.
3. Velg modellmodus **Pose** (anbefalt) og riktig indeks for dart-tip-nøkkelpunkt, eller **Detect** (for upresist bokssentrum). Juster konfidens etter behov.
4. Start webkamera. Kalibrer Bull, D20, D6, D3 og D11. Hold hele skiven synlig med stabilt lys.
5. Fjern pilene, og velg **Ta referansebilde**. Modellen analyserer ved oppdaget kast, eller trykk **Analyser kamerabilde**.
6. Kontroller magenta forslag; klikk den virkelige pilspissen for fasit, deretter **Bekreft valgt treff**. Gjenta med nye kast.
7. Etter at pilene er fjernet, trykk **Ny runde / tom skive**. **Eksporter JSON** hvis du vil sammenligne forsøk.

Hvis ingen AI-modell er lastet, er alle forslag fra endringsanalyse bare **grove estimater**, ikke maskinlæring.

## Modellformat og begrensninger

- Én inputtensor (`float32`, RGB, NCHW `[1,3,H,W]` eller NHWC `[1,H,W,3]`), 64–1280 px.
- Standard YOLOv8 / YOLO11 **én klasse** og ubehandlet output: `[1,5,N]` for deteksjon eller `[1,5+3*K,N]` for pose. Alternativt kan `[1,N,C]` brukes. `5` betyr `x, y, w, h, confidence`, fulgt av tre verdier (`x,y,confidence`) per nøkkelpunkt.
- Bildepreprosessering gjør letterbox med RGB / 255, uten ekstra normalisering. Koordinater beregnes tilbake til videobildets opprinnelige oppløsning.
- Ikke bruk export med `nms=True`, integrert preprocessing eller annen outputstruktur uten å tilpasse koden.
- **En generisk eller feiltrent modell vil gi feilscoring.** Tettstående piler, delvis skjulte spisser, mørke områder, bevegelse og perspektiv kan fortsatt gi feil.
- Ingen automatisk sending av resultater til DartArena-kamper før modellen har blitt grundig evaluert.

## Åpen kildekode og rettigheter

- Offisiell **Autodarts** publiserer blant annet dokumentasjon, men har ikke en offisiell åpent lisensiert enkeltkamera-modell tilgjengelig som vi automatisk kan bygge inn.
- [DeepDarts](https://github.com/wmcnally/deep-darts) og [Scored](https://github.com/Der-Penz/Scored) er tekniske referanser for enkelkamerabasert dart-tip/keypoint-gjenkjenning. Koden/modellvektene der må ikke kopieres inn i DartArena uten at vi bekrefter bruksrettigheter.
- [lksmlr/autodarts](https://github.com/lksmlr/autodarts) er et **annet, uoffisielt** tredjekameraprosjekt med Apache-2.0-kode og en PyTorch-modell. Den `.pt`-modellen virker **ikke** direkte i browserens ONNX Runtime og må eksporteres med riktig spesifikasjon først. Det er ikke den offisielle Autodarts-motoren.
- ONNX Runtime Web lastes kun ved aktivt modellinnlastingsvalg fra et versjonspinnet CDN. Modellbytes beholdes kun i minnet på brukerens maskin.
- Ingen bilde, lyd, modellvekter eller resultater sendes til DartArena/Supabase via labben. Supabase brukes bare til innlogging og til å sjekke `is_admin()`/`is_owner()`.
- Frontendkode er offentlig, selv om menyen er rollegatet. **Ikke legg hemmeligheter i frontend**.
- Modellen kjøres foreløpig med WebAssembly (CPU) for kompatibilitet. Større modeller kan være trege, særlig under videostreaming.

## Struktur

- `autoscoring-lab.html`: testsiden
- `autoscoring/ai-onnx.js`: ONNX Runtime og YOLO preprocessing/postprocessing
- `autoscoring/geometry.js`: kalibrering, koordinater og dartscore
- `autoscoring/lab.js`: kamera, rollebeskyttelse, referansebilder, modellkobling, logg
- `autoscoring/lab.css`: egen stil
- `autoscoring/lobby-link.js`: Owner/Admin-only menyinnslag
- `autoscoring/geometry.test.cjs`: geometrisk scoring
- `autoscoring/ai-onnx.test.cjs`: modellformat og output-parser

Tester uten kamera:
```sh
node autoscoring/geometry.test.cjs
node autoscoring/ai-onnx.test.cjs
```

## Beslutning 10. oktober 2026: modellstrategi og datagrunnlag

Vi går videre med **egen, lokalt kjørbar enkeltkameramodell** i stedet for å kopiere uklar tredjeparts kode eller lage et system som krever API-nøkkel til en ekstern bildeanalyse-server.

- **Faglig baseline:** DeepDarts D1 med omtrent 94,7 % riktig score på deres testmateriale. Den originale DeepDarts-repoet oppgir ikke en klar redistribusjonslisens, og vekter/kildekode kopieres **ikke** inn i DartArena. Eventuelt bruksgrunnlag må avklares separat.
- **Treningsdata/referanse:** Roboflow datasettet «darts / Punta» er oppgitt som **CC BY 4.0**. Det må føres attribusjon og verifiseres at det faktisk annoterer det vi ønsker. CC BY gjelder datasettet, ikke nødvendigvis en hosted treningsmodell eller modellvektene. Ingen kopiering inn i DartArena er gjort.
- **Foretrukket egen arkitektur:** Et lett keypoint-nettverk for seneste pilspiss, inspirert av **RTMPose** fra MMPose (Apache 2.0-kode). Vi må velge/bygge modellvekter med bekreftede kommersielle bruksrettigheter. En generisk menneske-posemodell er **ikke** en ferdig dartmodell.
- **Modellinput:** Parvis referanse-/etter-kast-bilde fra fast webkamera. Modellen bør lære å lokalisere den nyeste pilen, ikke bare alle synlige piler. Dette krever trening og en tilsvarende modelladapter i browseren. Det eksisterende YOLO/ONNX-grensesnittet beholdes som separat eksperiment.
- **Kvalitetskrav før scoring i onlinekamp:** Nøyaktighet må testes med faktiske kast, særlig på tette samlinger og ring-/segmentgrenser. Alle feilforslag må kunne korrigeres. Bruk ikke objekt-deteksjons-mAP som direkte dartscore-treffprosent.

### Innebygd lokal datainnsamling

Autoscoring Lab kan nå frivillig samle maks **150 manuelt bekreftede kast** i én økt:

1. Skru på «Aktiver lokal bildeinnsamling» eksplisitt; funksjonen er avslått som standard.
2. Kalibrer kameraet, ta referansebilde, kast og klikk faktiske pilspissen før «Bekreft valgt treff».
3. Hvert kast lagres **kun i fanens minne** som et JPEG-bilde *før* og *etter* kastet med pikselkoordinater, skivekalibrering, fasit og eventuelt AI-forslag.
4. Trykk «Last ned treningsdata (.zip)» for å lagre lokalt. ZIP inneholder `images/####-before.jpg`, `images/####-after.jpg`, `labels.json` og `README.txt`. Den bygges i nettleseren uten tredjeparts ZIP-bibliotek.
5. «Slett bilder» fjerner bildene fra fanens minne. Ved utlogging/rolleendring tømmes også bildetilstanden. Lukk fanen for å kassere alle ikke-eksporterte bilder.

Merk: For et frame-par er **bare den siste manuelt bekreftede pilspissen** annotert. Andre piler som kan stå i skiven er ikke merket. Modellen må trenes med hensyn til dette (for eksempel endringsbasert modell på før/etter-bilder); after-bildene er **ikke** et komplett datasett med alle pilspisser.

Ingen lagring i lokalStorage, backend, kamper, turneringer eller eksterne tjenester. Bildene kan likevel vise omgivelser; del aldri ZIP uten å kontrollere innholdet.

Dette er dataforberedelse, **ikke** en ny ferdigtrent modell. Neste tekniske utviklingstrinn er å trene og eksportere en konkret dart-tip-modell med avklarte rettigheter, deretter kjøre den på disse testkastene og måle reell treffprosent.

Test ZIP-byggeren:

```sh
node autoscoring/zip-store.test.cjs
```

## OBS-kamera – presisjonskalibrering med 9 punkter (10. oktober 2026)

Den opprinnelige kalibreringen med fem klikk kunne gi betydelig avvik mellom den turkise skivegeometrien og de faktiske metalltrådene. En tidligere justering til homografi var ikke tilstrekkelig.

**Ny fremgangsmåte:**

1. Åpne Autoscoring Lab, oppdater med `Ctrl+F5`, velg kamera og trykk **Start kamera**.
2. Klikk **Kalibrer skive (9 punkter)**.
3. Klikk Bull (punkt 1).
4. Klikk **midten av dobbelringen**, med klokken: D20 klokken 12 (2), nordøst klokken 1:30 (3), D6 klokken 3 (4), sørøst klokken 4:30 (5), D3 klokken 6 (6), sørvest klokken 7:30 (7), D11 klokken 9 (8), nordvest klokken 10:30 (9). Ikke bruk OBS-zoomkopien ved siden av.
5. Se at de turkise linjene følger ringene og skilletrådene. Hvis ikke: Klikk **Finjuster punkter**, dra de nummererte gule merkene til midten av dobbelringen og klikk **Ferdig med justering**. Justeringen oppdaterer geometrien fortløpende. Ugyldige posisjoner forkastes.
6. Bare når modellen følger metalltrådene, klikk **Ta referansebilde** og prøv treffregistreringen.

Det brukes nå ni punkter (Bull + åtte rundt hele dobbelringen) i en overbestemt minste-kvadraters homografi. Kalibreringen avviser feil rekkefølge, svært skjeve punkter og stor gjennomsnittlig projeksjonsfeil. Dette er fortsatt **manuell kalibrering**, ikke automatisk bildesøk. Estimert projeksjonsfeil er avvik mot klikkede punkter og beviser ikke i seg selv at modellen følger metalltrådene; det skal kontrolleres visuelt.

En gul stiplet ramme viser AI-besnittet, som ekskluderer OBS-zoomkopien til høyre. Ta ikke opp testdata eller bruk scoreforslag før turkise ringer og sektorgrenser følger den fysiske skiven.

Dette endrer bare den isolerte testsiden og kalibreringsmatematikken, ikke DartArenas onlinekamper, turneringssystem eller databaser.

## Retting etter første ekte datasett (8 kast, 10.10.2026)

Det første eksporterte datasettet inneholdt 8 merkede kast i 720×405 JPEG-bilder. Både kontroll av bildepunkter og gjennomgang av før/etter-bildene viste at et par kunne få et annet «etter»-bilde enn det som var på skjermen da brukeren markerte treffet. Dessuten viste enkelte par fjerning/flytting av dartpiler, som ikke bør merkes som nye kast.

Laben har nå **frosset treffbilde**:

1. Etter «Ta referansebilde» fryser Lab automatisk den første stabile endringen den finner. Bildet som vises med treffforslaget blir fryst.
2. Om automatisk endring uteblir: Kast pilen, vent til den står stille og trykk **Frys treffbilde**.
3. Marker **pilspissen i det frosne bildet**, ikke en video som kan endre seg mens markøren flyttes.
4. Bekreft. Hvis lokal datainnsamling var aktivert, bruker eksporten **akkurat det fryste JPEG-bildet** til «after», mens «before» fortsatt er referansebildet. Metadata inneholder `frozenFrame: true`, `frameCapturedAt`, `frameCaptureMethod`.
5. Hvis det fryste bildet er uklart, viser pilfjerning eller ikke viser en ny pil: velg **Forkast / tilbake til live**. Legg i så fall inn ny referanse av den faktiske skiven.
6. Ved fjerning av alle dartpilene mellom runder, trykk **Ny runde / tom skive** når skiven er tom før du kaster neste pil. Da vil ikke piler som blir fjernet, være referanse for et nytt kast.

Dette retter **tidsforskjellen** mellom annotasjon og bilde. Det beviser ikke at en dartspissmarkering er nøyaktig, at en endring er et innkommende kast, eller at materialet alene er stort nok for modelltrening. Gjennomgå alltid hvert bildepar i ZIP-arkivet før trening.

Filene er fortsatt lokale, med opt-in for treningsdata, ingen nye Supabase-kall, og uten å endre kamprommene.
