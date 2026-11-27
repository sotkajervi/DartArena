# Dependency review 2026-11-27

Partial repository inventory at 0e32c2ac: root package.json has exact direct dev versions but no tracked lockfile. Sampled primary HTML pages load Supabase JS 2.117.2 without SRI; Roboflow Edge Function imports 2.49.1. SEER owner test used Socket.IO client 4.8.1. Owner calibration uses TFJS 4.22.0 and TFLite alpha. No production runtime changes authorized by this audit.

Socket.IO parser advisories GHSA-677m-j7p3-52f9 and GHSA-2m8v-j782-fhvr affect older parser releases; fixed in 4.2.7 for v4. Candidate update to socket.io-client 4.8.4 is confined to test branch; real SEER connection remains untested. Official package/CDN bytes comparison and visit tests do not establish hardware compatibility. Sources: https://github.com/advisories/GHSA-2m8v-j782-fhvr and https://github.com/advisories/GHSA-677m-j7p3-52f9 .

The audit workflow resolves temporary npm dependency graphs with scripts disabled. This does not establish the exact contents of already-built browser bundles, deployed Workers, or Deno runtime. Review audit findings and generate reviewed lockfiles before enforcing dependency audits. No credentials or live API calls are needed; npm and CDN only. Next: full source inventory, validated SRI/local vendoring plan, lockfiles, review current deployed Edge Function and pin its dependencies, then staged tests. Do not merge the SEER candidate before review.

## First audit result (run 45932468443)
- Browser Supabase 2.117.2 and candidate Socket.IO 4.8.4: zero npm audit findings in freshly resolved graphs.
- Edge Supabase 2.49.1: two low severity findings related to GHSA-8r88-6cj9-9fh5. Development toolchain: eight moderate findings related to minimatch GHSA-g3hv-75wg-m249. High-severity threshold did not fail these jobs; these findings remain open.
- TensorFlow: ERESOLVE because TFLite alpha.10 requires core 4.9.0 while the page uses 4.22.0. Audit the two supported npm graphs independently. Mixed CDN runtime remains a known compatibility issue, not a passed compatibility test. No forced resolution or runtime version change.
- SEER: package/CDN comparison and four visit tests passed. Added the verified SHA-384 integrity attribute; verify exact bytes and markup again. Actual hardware connection remains unverified.

## Candidate audit (45933038130)
Both proposed SDK and development updates returned zero findings at the low threshold. The actual manifests and Edge Function import are now staged on the test branch. The compatibility job checks TypeScript/lint and exercises the real candidate SDK against mocked Auth, RPC and inference responses. This does not test the deployed Deno gateway or SEER hardware; no production deployment. Lockfile, complete dependency inventory and mixed TF compatibility remain open.
