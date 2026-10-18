# Network observatory verification

Base: `335f8657aa0fe1128d9178a92507a0235fc797e3` (18 October 2026).

## Implemented

- Responsive observatory above the existing, unchanged candidate inventory.
- Observation-state cards, device search/filter/detail, source timestamps, historical count chart and event timeline.
- Schematic topology only from supplied, validated links. No inferred mesh, rooms, people or occupancy.
- Explicit missing, invalid, unknown and stale states. A manual device never counts as recently observed. Snapshot and collector freshness also gate device freshness.
- Read-only `/api/network/v1/snapshot`, under existing API authentication and forcibly disabled in demo mode, reading an explicitly configured `NETWORK_SNAPSHOT_FILE`. No file setting, credential, new persistent access or ingestion service was activated.
- Schema v1 allowlist strips extra fields, raw traffic, credentials and presence. Technical aliases are assumed to be supplied by an approved upstream collector; free text cannot independently prove that it contains no personal information.
- One request on mounting and manual refresh only. Local display clock updates without polling the network.

## Contract

Endpoint returns `{connected:true,snapshot}` only for a valid bounded local JSON file. Otherwise `{connected:false,reason:'not-configured'|'unavailable'|'demo-isolation',snapshot:null}`. No empty collection is fabricated as a successful live feed.

Schema fields: schema_version, snapshot_id, source (`hjemmenett-monitor`), observed_at, received_at, collector, devices, links, events, history. Presence is always empty. Links require source_id, target_id, source and observed_at; both endpoints must exist. Historical source timestamps are displayed, not converted into live claims. Existing network inventory features remain separate.

## Verified

- Full automated suite: 161 passed, zero failed.
- Production Vite build: passed.
- Additional tests cover allowlist/privacy, future/stale times, manual data, unknown link endpoints, duplicate IDs, invalid schema/file, zero vs null counts and missing configuration.

## Not verified / blocked

- No production collector data, live network connectivity, sync path or deployment was verified or activated.
- Browser screenshot/mobile/desktop interaction check is blocked: Chromium fails to create sandbox sockets (`EPERM`); the permitted escalated attempt failed at a read-only bwrap path. No visual inspection success is claimed.
- The cloud source copy omits binary assets. Production build succeeded; unrelated images/models were not visually checked.
- The supported cloud Chrome route also could not reach workspace localhost (`ERR_CONNECTION_REFUSED`).
- No GitHub push or Railway deployment performed by this change set. Parent review required before publication.

## Receiver-to-dashboard bridge

The companion receiver now supports `create_cloud_app(..., snapshot_file=ABSOLUTE_PATH)` and launcher `HJEMMENETT_SNAPSHOT_FILE`. It writes a validated derived snapshot through temporary file, fsync and atomic replace before acknowledging ingestion. The dashboard `NETWORK_SNAPSHOT_FILE` must explicitly point at that same file in a shared filesystem. Separate Railway services do not automatically share a disk; deployment topology must be verified before enabling this bridge. No such environment configuration was activated. Export failure returns 503 and is safe to retry idempotently.

Review fixes include timezone-required timestamps with Python microseconds, honest `first_in_snapshot_window` event labeling, future history rejection, old topology exclusion, unknown-source status and a reporting collector with a genuine zero-device count.

Cross-language integration verified with a synthetic fixture produced by an actual Python POST ingestion and atomic export, then read through Node `readNetworkSnapshot` and the frontend model: connected true, one unknown device (not online), one `first_in_snapshot_window` event, one historical point, empty presence, and six-digit UTC fractional seconds accepted. This verifies the offline bridge contract, not live deployment.

Exports older than seven days are rejected at read time, including when the receiver stops. No device data from an expired snapshot is returned. Local file removal is the receiver retention responsibility, not performed by this read-only route.
