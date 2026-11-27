# Security regression CI
Runs on main pushes, PRs to main, manual dispatch and the initial test branch.
- Static/client: tracked-text secret pattern scan (not history or all secret types), auth, current RPC usage, secure media construction and client cleanup.
- Database: independent disposable PostgreSQL 16 fixtures per suite. No production URLs, tokens or data.
- Browser: existing mocked Playwright security cases; no intentional live media or production requests.
- Historical test assertions for cache tags updated to check versioned references and consistent secure client version rather than an obsolete literal. No production application code changed.
- A red check is evidence to investigate, not an instruction to bypass. Pushes to main are checked after the push; the workflow does not by itself block GitHub Pages deployment or direct pushes. Required checks/rulesets and the separately manually deployed Cloudflare Worker need additional review.
- Fixtures do not recreate the complete Supabase production schema, verify live CAPTCHA/configuration, enforce Realtime channel privacy, or verify actual Cloudflare billing/cleanup.
