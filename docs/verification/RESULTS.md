# Local verification, 2026-10-15

- 22/22 isolated Node tests passed (reliability plus in-memory PostgreSQL/PGlite migration tests). No production database, Homey, MCP or AI calls.
- Full Vite production build passed using Node 22.23.3, including the final ExperienceView changes (2564 modules).
- Chromium fixture test passed at 1440x1000 and 390x844: actual AuthGate and ExperienceView components, seven feature sections, saved-scene hydration, historical simulation, synthetic scene/undo results, stale/error and unavailable states. 34 intercepted API calls; external requests blocked; no page errors; no horizontal overflow.
- This is a component integration test, not an end-to-end production or full navigation test. Browser responses are synthetic. It does not validate real devices, provider credentials, microphone, physical undo or production PostgreSQL/TLS.
- Screenshots contain only synthetic data. Mobile live and desktop unavailable screenshots were visually inspected.
- Browser harness is retained as supporting evidence. It requires playwright-core and Chrome, plus a fixture build whose entry renders AuthGate/ExperienceView with synthetic devices. The source fixture was created only under /tmp, never in application source. Its dist path in the harness is temporary and must be rebuilt before rerunning.

## Changes found during visual verification

Saved scene actions now hydrate on the first successful load. A failed ancillary request no longer suppresses successful overview/timeline/scenes responses; failed overview refresh is labeled stale. Scene controls wrap on narrow screens.

## Remaining release blockers

GitHub feature-branch publication and a review PR were explicitly authorized after local verification. Merge/deployment remain gated on the concrete configuration and compatibility decisions below.

Voice compatibility remains unresolved: the old unversioned ElevenLabs script runs inside the authenticated origin and can read sessionStorage. It is removed locally. No independently hosted voice page was verified; an opaque sandbox cannot provide normal microphone access, and adding allow-same-origin to same-origin content removes the intended isolation. Preserve voice using a reviewed separate-origin page and narrowly scoped integration, or a verified provider-hosted share link. Do not declare voice restored or ship this regression without an explicit decision. No voice call or microphone access was requested during testing.
