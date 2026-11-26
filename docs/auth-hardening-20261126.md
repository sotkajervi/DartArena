# Auth hardening – staged

- 38 existing accounts, all email confirmed, no anonymous accounts at audit time. This does not establish current Auth configuration.
- Keep the existing 8-character minimum and existing account login compatibility until server settings are verified.
- Create a managed Cloudflare Turnstile widget for sotkajervi.github.io and any actual production custom host. Put only its site key in auth-captcha-config.js. Keep the secret in Supabase Auth Attack Protection settings, never in GitHub.
- Publish the client with the site key first, test sign-in, sign-up, and recovery requests, then enable CAPTCHA server-side. Verify invalid/missing tokens are rejected and valid tokens work. Do not enable server CAPTCHA before client readiness.
- Leaked password protection requires Supabase Pro or higher. Verify plan and enable in Dashboard if available. Review email confirmation, anonymous sign-ins, server minimum password length and Auth rate limits in Dashboard. Do not change email confirmation or sign-in policy without testing.
- Rollback: disable server CAPTCHA first, then remove the site key. No player data migration. Existing recovery link handling remains isolated.
