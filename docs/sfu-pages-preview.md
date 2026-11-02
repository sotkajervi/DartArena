# Separate Cloudflare Pages preview: SFU test harness

**Not deployed automatically.** This repository has an existing production GitHub Pages site. Do not change its source branch or deployment workflow.

Create a **new** Cloudflare Pages project (e.g. `dartarena-sfu-preview`), connecting `sotkajervi/DartArena`.
- Production branch for *this separate preview project*: `test/sfu-load-harness-20261102`
- Framework preset: None
- Build command: leave empty
- Build output directory: `/` (repository root, if accepted by Pages); alternatively use a build command that copies the required files to `dist`.
- Open `https://<pages-project>.pages.dev/tests/sfu-live-client.html`.
- Do **not** set/modify a custom DartArena production domain or its GitHub Pages settings.

The test client's imports are `../sfu-config.js` and `../sfu-client-secure.js`, so the preview must contain the repository root, not only `tests/`.

Before attempting any live traffic:
1. Verify that the **secure test Worker** allows the exact preview origin in CORS. Do not use wildcard origins; retain server authorization.
2. Use test accounts belonging to the actual active test match. Never share passwords or tokens.
3. Verify the preview site uses HTTPS and does not expose secret environment variables.
4. Begin with two accounts/one match for under two minutes. Review connections and usage before increasing concurrency.
5. Never infer success from a successful page load: verify publish, subscribe, received bytes and Cloudflare metrics.
6. Delete or disable the preview project after testing if unnecessary.

**Limitations:** Cloudflare Pages project creation and Worker CORS configuration are not available in the connected tools of this chat. No preview URL can be claimed until an actual deployment reports one. `/tests/sfu-live-client.html` is not linked from production UI.
