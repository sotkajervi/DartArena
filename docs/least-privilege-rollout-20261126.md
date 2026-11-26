# Least privilege rollout – 2026-11-26

Phase 3, staged only. No production database changes from this branch or workflow.

- Browser clients use submit_x01_checked with the expected match revision. Four underlying scoring RPCs remain callable by their owner and service_role, not authenticated or anon.
- Current room-secure-create.js supplies both p_is_warmup and p_is_live. Revoke the two older proposal overloads only after repository-wide static tests pass.
- Remove redundant anon grants on practice_matches (existing RLS policies already restrict anonymous access).
- CI uses a disposable PostgreSQL instance, the actual checked wrapper and stub scoring functions; verifies ACLs, routing and stale/wrong-turn rejection, not full gameplay semantics.
- Before production: verify live function signatures/grants and no active matches, ensure current client is published, take DB backup/rollback reference, run migration in a maintenance window, rerun advisor and test X01/Chicago visits, checkout and challenge acceptance with ordinary accounts. Cached old clients need reload. If blocked, apply the RPC rollback SQL (does not regrant anonymous practice access).
- Profile read functions and additional privilege cleanup remain a separate review; do not revoke all authenticated RPCs.
