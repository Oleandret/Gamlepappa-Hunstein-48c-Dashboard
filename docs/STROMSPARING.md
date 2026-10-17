# Strømsparing — local implementation, 17 October 2026

Original local base: `befd5b77f544a06d4a636b77cdc3e593b2675140`. The ten checkpoints were recovered from their verified Git bundle after iCloud evicted workspace files, and merged with production/main `4e4191dd177e6eb5d8b8e76f723155fd5107fea5`. Publication was subsequently authorized by the user. The active publishing checkout is `/tmp/gamlepappa-energy-publish-20261017`. Google authentication, the current 3D/door implementation, dimming and the standard ElevenLabs widget are preserved from latest main. No physical commands or automation activation are authorized or implemented here.

## Ten local versions

These are ten cumulative, reviewable local implementation checkpoints, not ten deployments or claims of measured household savings. Each checkpoint is recorded in local Git with its focused verification in `VERSIONS.md`.

1. Explicit source quality, finite numeric values, capability timestamps and device inventory.
2. Single-flight read caching, failure backoff and Retry-After; shared device polling also backs off.
3. Explicit main/submeter selection with no main-plus-sub sum, room allocation and overlap warning.
4. Cumulative kWh history, duplicate/reset handling, Oslo dates and bounded in-memory samples.
5. Interval-aligned NOK cost contract including negative prices and partial coverage.
6. Explainable rules for missing meters, stale sources and possible overlap; no fabricated anomalies.
7. Constrained light-only simulation, user comfort/safety text, non-critical confirmation and W→kWh estimate.
8. Protected read-only adapter, documented Homey URLs, minimal response fields and unverified-schema status.
9. Responsive Norwegian interface, local preview activation, pause, stop and bounded session log.
10. Existing navigation integration, regression/security tests and visual verification.

## Data boundaries and remaining requirements

- `measure_power` is treated as source-reported W and `meter_power` as source-reported kWh with an unverified period. Historical differences additionally require the user to confirm cumulative import semantics. The label “Målt” means a numeric, fresh capability reading, not independently verified physical calibration. Virtual/estimated device provenance must be checked before relying on it. Receipt time never replaces a sensor timestamp.
- A device measurement is stale after two minutes; missing timestamps, future timestamps and unavailable devices also fail closed. Some stable Homey values may update only on change; they are conservatively excluded until the source's freshness semantics are verified.
- Anlegg (Hunstein/Halsaneset), device membership, main and non-overlapping submeter assignments are explicit user selections for this browser tab only. Unknown membership and other-site devices are excluded from totals, recommendations and simulations. No 18-digit billing identifier is requested or treated as proof. No guesses are made from device names. Submeters can still overlap if selected incorrectly: the UI explains this limitation. Enhetsdekning is not whole-house energy coverage.
- Live and daily Homey reports are read with caching, but their raw schema is not mapped or exposed. The existing legacy energy-report API contract is preserved behind a cached reader with failure backoff; the observed `/report/today` 404 remains honestly unavailable. The old Energy screen no longer displays an unsafe cross-meter total or sums watts by room without a meter hierarchy. It retains individual readings and room meter counts.
- Historical values are **only** consecutive, fresh cumulative meter readings observed while the tab is open. Reset intervals are excluded, not treated as negative consumption. This is not daily history or durable storage. Long observation gaps are included as meter deltas, not estimated hourly curves. Counter rollovers, export meters and physical hierarchy still need source verification.
- No actual tariff/price feed is available to this local work. Cost UI deliberately stays missing; pure calculation accepts exact matched intervals and `NOK/kWh`. Spot price, taxes, grid fees and subsidies are not assumed.
- No external AI was called and no new key/access was requested. Railway confirms an existing OpenAI variable name, but its value was neither exposed nor tested. The Homey MCP connector failed in its Homey sub-node. This feature remains honestly rule-based; no claim of connected AI is made.
- Simulation is a conditional estimate at the observed instantaneous light power. The user supplies the non-critical determination and comfort constraints. It never claims realized savings and cannot control heating, water, sockets or unknown equipment.
- Activation affects only an in-memory preview label; there is no executor, scheduler, persisted rule, physical API endpoint or Homey flow creation. Pause/stop affects that preview only, not other automation systems. Before any future real activation, safety boundaries require structured enforceable checks, device ownership, fresh confirmation, authorization, durable audit and a real execution stop mechanism. Free-text limits are not interpreted as executable safety rules.
- API GET is behind unchanged existing access control. Viewer writes are refused; all attempted feature writes return 405 for authorized users. No raw report, token, debug body or credentials are logged by the feature.

## Verified primary API reference

Athom's [ManagerEnergy documentation](https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerEnergy.html) documents GET `/api/manager/energy/live`, GET `/api/manager/energy/report/day?date=YYYY-MM-DD`, and `homey.energy.readonly`. Consulted 17 October 2026. Endpoint availability, actual scopes and response schema on the user's Homey were **not** tested against live credentials; tests use injected mocks only.

## Local reproduction

Use Node 22.12–26 and install the lockfile dependencies normally. Dependencies were installed into this isolated checkout from the existing lockfiles with lifecycle scripts disabled; no symlinks to the original checkout remain. Early attempts using old dependencies and the restricted network failed; the final clean install, build and test results are in `verification/final-*.txt`.

- `node --test server/tests/*.test.js` (isolated regression suite)
- `node --test --test-isolation=none server/tests/savings.test.js` (focused tests on Node 26)
- `npm run build`

No production secrets should be present for local preview. Run only with explicit DEMO_MODE=true and DATABASE_URL/HOMEY_PAT/AI/MCP environment values absent. Visual test fixtures intercept all API calls and prohibit outbound requests. Screenshots contain synthetic data only.

Publication is authorized; the exact remote commit and Railway result are recorded in the task delivery. No physical activation is part of publication.

Browser verification: `PLAYWRIGHT_MODULE=<installed playwright-core module> CHROME_PATH=<installed Chromium executable> node scripts/verify-savings.mjs`. This starts a loopback static server and a fresh headless browser; it does not start the application backend.
