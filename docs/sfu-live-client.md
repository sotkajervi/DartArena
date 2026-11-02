# Authorized live SFU test client

The independent page `tests/sfu-live-client.html` publishes a **real** 320x180, 10 fps browser-generated canvas track through the existing secure SFU worker. It requires a current signed-in Supabase session and authorized active match membership. No fake auth, bypass, live deployment, or transport toggle.

## Run
Serve the branch's repository root on localhost, for example `python -m http.server 8000`, and open `http://localhost:8000/tests/sfu-live-client.html`. Use the built-in email/password login with an approved test account. Do not use a production owner's account. The secure worker can reject localhost via CORS even when credentials are valid; if so, add only the controlled test origin to the worker allowlist after review, without widening authorization. Never paste access tokens into the page.

For each authorized participant, enter a test match UUID and start. Exchange **publication JSON only** with the opposite participant and use Subscribe. After 5–120 seconds the client closes its local RTCPeerConnections and generated media tracks. Export results manually from the on-screen JSON. Browser closes cannot guarantee server-side SFU sessions are immediately removed; inspect Cloudflare-side usage separately. The secure worker must enforce access to each session and publication.

Test initially with **two** authorized participants in a dedicated room; only after reviewing Cloudflare traffic and connection behavior should the test scale toward six separate rooms. Never use one account to impersonate multiple players. The page is intentionally not linked from DartArena's UI. A branch-local HTML page is not automatically published to GitHub Pages.

Metrics include cumulative bytes, packet loss, ICE/connection state and selected candidate RTT. Bitrate can be calculated from consecutive samples. No thresholds have been validated and no successful live result is claimed. For comparable tests, record start/end timestamps and Cloudflare dashboard deltas.

Known limitation: publication exchange is manual. There is no realtime matchmaking, no synthetic audio, and no automated 12-client orchestration yet.

## Hosting status

This is committed **only** to `test/sfu-load-harness-20261102`. No GitHub Pages preview environment was deployed and no automated live SFU test was run. The localhost URL works only after checking out the branch and starting a local server. Do not advertise a GitHub branch file URL as a runnable preview.
