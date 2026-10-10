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
