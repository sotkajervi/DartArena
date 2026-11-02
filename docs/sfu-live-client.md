# Authorized live SFU test client

The independent page `tests/sfu-live-client.html` publishes a **real** 320x180, 10 fps browser-generated canvas track through the existing secure SFU worker. It requires a current signed-in Supabase session and authorized active match membership. No fake auth, bypass, live deployment, or transport toggle.

## Run
Serve the branch's repository root on localhost, for example `python -m http.server 8000`, and open `http://localhost:8000/tests/sfu-live-client.html`. Signing into production on a *different origin* does not transfer a session to localhost, so authentication must be established for this origin through an approved test setup. Never paste tokens into the page. A local session may not be available without further configuration.

For each authorized participant, enter a test match UUID and start. Exchange **publication JSON only** with the opposite participant and use Subscribe. After 5–120 seconds the client closes its local RTCPeerConnections and generated media tracks. Export results manually from the on-screen JSON. Browser closes cannot guarantee server-side SFU sessions are immediately removed; inspect Cloudflare-side usage separately. The secure worker must enforce access to each session and publication.

Test initially with **two** authorized participants in a dedicated room; only after reviewing Cloudflare traffic and connection behavior should the test scale toward six separate rooms. Never use one account to impersonate multiple players. The page is intentionally not linked from DartArena's UI. A branch-local HTML page is not automatically published to GitHub Pages.

Metrics include cumulative bytes, packet loss, ICE/connection state and selected candidate RTT. Bitrate can be calculated from consecutive samples. No thresholds have been validated and no successful live result is claimed. For comparable tests, record start/end timestamps and Cloudflare dashboard deltas.

Known limitation: publication exchange is manual. There is no realtime matchmaking, no synthetic audio, and no automated 12-client orchestration yet.
