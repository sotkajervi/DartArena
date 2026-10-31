# Isolated DartArena tournament simulation

Run `node tests/offline-tournament-load.cjs` with Node.js 18+.

This test is **offline**. It simulates pairs of players, concurrent games, delayed acknowledgements and attempted duplicate submissions; asserts only one score per turn is accepted. It makes **no network connections**, creates **no real users**, and changes **no Supabase data**.

It is not a realistic production load test: no database locks, PostgREST, Realtime delivery, browser rendering, SFU media or authentication. Reported p95 values measure only this synthetic model, not DartArena performance.

Next: create a separate Supabase staging project and synthetic accounts; deploy a separate staging UI; execute browser tests with 12–16 isolated clients; separately test SFU. Never run bulk synthetic scoring against production.
