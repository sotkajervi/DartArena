# `src/`

This directory is the home for new and gradually migrated DartArena code.

- `components/` — small reusable UI pieces and render helpers
- `pages/` — page-level orchestration
- `lib/` — reusable domain, Supabase and WebRTC helpers
- `hooks/` — reusable browser/event lifecycle helpers when needed
- `types/` — shared TypeScript types

The existing root-level JavaScript remains production code while migration happens incrementally. Do not duplicate a working runtime module here unless it is being actively migrated and there is a clear integration path.
