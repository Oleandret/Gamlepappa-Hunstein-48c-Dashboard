# Field mapping and visual review — 18 October 2026

Local follow-up to 5b1bfc5. No physical commands, Tesla refresh, flow execution, credentials, or user settings changes were performed.

## Mapping changes

- Preserve full capability instance IDs and include capabilitiesObj-only keys. Root-name collapsing previously hid distinct phase, period and cumulative counters.
- Preserve declared units and source timestamps through the public projection and savings API. Strip pairing data and driver settings as before.
- Convert explicit kW to W and Wh to kWh for the relevant calculations. Reject incompatible units; a capability named measure_power with kWh metadata is not power.
- Add a read-only per-device table of capability IDs, source units, values and source times in Europe/Oslo.
- Exclude unavailable, missing-time and older-than-15-minute observations from the energy insight list. A source timestamp may mean last value change, so this exclusion does not establish device failure.
- Retain normalized dim-to-percent formatting even when metadata declares percent.

## Snapshot reconciliation

An existing authorized Homey snapshot was replayed through the actual public projection and client helpers: 204 devices, 30 zones and 1,793 capability instances. Every device ID and room ancestry resolved; no projection mismatch. The old enumeration lost 262 capability instance IDs; the corrected enumeration loses zero.

715 capability instances lacked source time; 1,078 had valid timestamps, of which 1,032 were over 15 minutes old at snapshot time. None were in the future. Missing and older times are retained, not replaced with fetch time. Two Tesla devices retain the separate manual snapshot policy; no refresh or verification of their saved production values was done.

The exhaustive device and capability matrices and source payloads are kept outside the repository in the local delivery directory. This is snapshot/code reconciliation, not an authenticated post-deployment comparison of every UI field. Numeric values and metadata were checked; raw string capability values were deliberately excluded from the captured snapshot.

## Daily-energy semantics

The Homey day report and the Pulse daily capability are distinct source series. In the captured reports, today's importedPeriod equals the difference between the cumulative imported counters in consecutive reports. The first day-report interval starts at Oslo local midnight, so the discrepancy is not established to be a UTC-date error. The Pulse daily counter comes from Tibber accumulatedConsumption, while the cumulative imported counter comes from lastMeterConsumption in the official driver source.

The precise baseline/timing explanation for their difference remains unresolved without matching historical counters. No offset, summation or invented correction is applied. The UI labels the Pulse value “Tibber dagsteller” and explicitly says it is not reconciled with the Homey report.

Official reference: https://github.com/tibber/com.tibber.athom/blob/main/drivers/pulse/device.ts

## Visual changes and local verification

Shared matte surfaces, larger section headings, consistent spacing, overview hero, responsive cards, all-section picker, source tables and redesigned history charts with last/min/max values. Mobile uses a full-width section picker. Activity access is moved below the content on narrow screens. Existing house imagery, manual pins, 3D, dimming controls and ElevenLabs widget are preserved.

146 isolated tests pass. Production client build passes. All 24 sections were opened on desktop and in a real 390 CSS-pixel iframe, with no section error boundary or document overflow observed. This navigation check is not a functional test of every control. Populated history and negative-price fixtures, unavailable sources, and missing data were inspected. Physical controls were not exercised; the local fixture server rejects API writes.

Screenshots and matrices are local deliverables, not uploaded household data. Production authenticated regression is pending because its session expired; no new login was attempted. This follow-up is delivered as a local commit, without a new push or deployment.
