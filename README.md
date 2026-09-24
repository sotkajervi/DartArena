# WebcamDarts

Første lokale prototype av WebcamDarts.

## Inneholder
- Responsivt mørkt/turkist grensesnitt
- Lokal webcam-visning via nettleserens `getUserMedia`
- 501 for to spillere
- Best of 5 legs
- Hurtigknapper for vanlige scorer
- Bust og angre siste registrering
- Mobilvennlig layout

## Test lokalt
Kameratilgang fungerer normalt best fra `localhost` eller HTTPS.

Med Python installert:
```bash
python -m http.server 8000
```
Åpne deretter `http://localhost:8000`.

## Neste steg
Dette er bare grunnmuren. Online motstander, WebRTC-video, lobby/rom, brukerprofiler, kampstatistikk og backend kommer senere.
