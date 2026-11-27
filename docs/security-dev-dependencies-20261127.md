# Development dependency review – 2026-11-27

This release contains only the development manifest, verified npm lockfile and isolated CI audit. No runtime JavaScript, video, SEER or Supabase Edge Function changes.

ESLint 10.15.0 and typescript-eslint 8.74.0 resolved eight moderate npm audit findings in the previous development graph. The updated locked graph and typecheck, lint and password reset checks passed in https://github.com/sotkajervi/DartArena/actions/runs/45933652789 . Lockfile SHA-256: 1011c4a583d3f0379243ead4154e00ea68133d82c91015a9769aa17deaeb134d . Contains 98 package entries. The new workflow uses npm ci and fails on low-or-higher audit findings; scheduled audit runs weekly. This workflow is separate from the required aggregate security gate, and does not automatically block unrelated changes.

Still open on the separate security-regression test branch: Socket.IO update and SRI for SEER (hardware compatibility pending), Supabase SDK update in Roboflow (actual Deno deployment not verified), TensorFlow peer mismatch, remaining CDN integrity coverage and complete dependency inventory. The root lockfile only covers development packages.
