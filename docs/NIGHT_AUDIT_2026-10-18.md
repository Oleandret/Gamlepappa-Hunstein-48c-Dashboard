# Dashboard regression audit — 18 October 2026

Read-only production inspection and isolated mock tests; no device commands, flow runs, Tesla refreshes, new credentials, or configuration writes were performed.

## Changes
- Preserve numeric epoch-ms and timezone-qualified ISO Homey source timestamps, including older timestamps; observed_at remains the collection time. Reject future, seconds-scale and timezone-free input.
- Store transitions and snapshots in one atomic INSERT; include meter_power in periodic snapshots.
- Share one-minute device/live-energy caches and a fifteen-minute day-report cache. Retain backoff/single-flight, and report the cache's actual acquisition timestamp.
- Remove calls to the retired report/today URL. Legacy energy summary uses only the verified main meter's fresh power; no invented daily totals, solar generation, trends or sub-meter sums.
- Preserve previous data on transient read failures with quality warnings; missing weather is no longer zero degrees.
- Fix asynchronous flow-name lookup (mock verification only; no flow run).
- Add a mobile section picker across all views, full-width content and focus/reduced-motion styles. Remove inert global search, fake notification counter and inert camera button.
- Distinguish device-health score from home security, and replace absolute “secured”/“live” house labels with observation wording.
- Hide misleading empty history charts after API errors; validate incomplete Huspuls responses; isolate render failures to their section so navigation survives.

## Evidence
- 139 automated tests passed, including cache/backoff, 429, authorization, negative prices, Oslo date boundaries, units, missing/stale data, Tesla isolation, pins and command validation.
- Production client build passed; npm audit --omit=dev for server: zero known vulnerabilities. No lint/typecheck scripts are configured.
- All 24 sections opened in production before deployment; direct Homey inventory matched dashboard counts and the selected main meter's value and source timestamp.
- Direct GET energy/live and energy/report/day both returned 200. Official endpoint reference: https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerEnergy.html
- Full local navigation/error-state pass on all 24 sections at 1280px desktop and 390px mobile document width. Mobile used an actual 390px iframe viewport because the browser viewport override did not take effect; this is not a physical-phone test.
- Mobile 3D canvas rendered. Screenshots and private source reconciliation are retained outside the repository.
- Existing OpenClaw agent independently reviewed source and final diff. Its timezone-parser finding was fixed and tested. Codex was the sole code writer.

## Limits and remaining work
- Navigation/rendering and automated mocks do not prove every physical control, conversation, camera stream or integration works. These were not activated.
- Homey returned 429 during reconciliation; stale labels and backoff were observed. Cache reduction is verified in code/tests; long-term rate-limit elimination is not claimed.
- Homey daily report and device day counter differed; report periods/aggregation remain unverified and are not combined into a new total.
- Nested-zone auto-placement remains conservative; ambiguous/unplaced devices require owner review. Manual pins, saved drafts, photos and settings were not rewritten.
- Deco nodes remain partially unavailable; no network/login repair was attempted. No new access was requested.
- No claim of exhaustive coverage or zero defects. Post-deployment state belongs in the delivery report.
