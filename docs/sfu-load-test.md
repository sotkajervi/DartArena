# SFU load-test baseline (isolated branch)

This directory contains an **offline lifecycle simulation**, not a real Cloudflare SFU stress test. It generates no WebRTC audio/video traffic, does not authenticate users, and cannot establish capacity, bandwidth, Cloudflare costs or production reliability.

## Run

From repository root, with Node.js 20+:

```bash
node scripts/sfu-load-sim.cjs
node --test tests/sfu-load-sim.test.cjs
node scripts/sfu-load-sim.cjs --rooms=6 --players=2 --rounds=1000 --failure=5 --seed=42
```

The JSON output reports room/client counts, simulated connection attempts, failures and recoveries, and confirmation that all virtual sessions are closed. This is only a regression baseline for future work.

## Requirements before any real SFU load test

1. Build a separate browser/WebRTC runner with synthetic canvas video and generated silent audio. No cameras or microphones are necessary.
2. Use authorized **test users** and actual test rooms; the secure worker checks authorization. Never bypass room membership or put session tokens into GitHub.
3. Use a dedicated test environment, start with two clients and scale slowly up to six rooms/twelve clients.
4. Measure established peer connections, outbound/inbound bitrate, packet loss, RTT, time to connect, 403/429/5xx failures, reconnections and cleanup on room exit.
5. Compare Cloudflare usage metrics before/after, and make sure production users and costs are protected.
6. Report raw metrics, test window and pass/fail criteria. The offline simulation is not evidence of actual SFU behavior.

No live endpoints are contacted by these scripts. No deployment or mode switch is performed.
