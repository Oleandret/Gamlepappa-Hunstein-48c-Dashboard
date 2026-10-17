# Tesla: manual dashboard snapshot

The repository has no direct Tesla Fleet API client, Tesla credential, wake-up endpoint or Tesla-specific poller. Tesla appears via Homey inventory GET /manager/devices/device in homeyClient, shared by the device worker and views. Homey's Tesla integration owns upstream collection; this repository does not expose its polling interval. No evidence here identifies an n8n Tesla polling flow.

Tesla values are now pinned to a persisted manual snapshot in the existing CONFIG_PATH store (_teslaSnapshots). App loads, general refresh, interval polling and tab changes only project that snapshot. Other Homey devices continue updating normally. Before the first manual snapshot, car values are absent rather than labelled live.

Oppdater Tesla imports the latest already-received Homey inventory values. It makes zero additional upstream calls, never wakes a car, and does not claim a fresh Tesla measurement. Server serialization and a five-minute persistent per-car cooldown bound simultaneous requests. Source timestamps in capabilities are preserved; UI shows snapshot timestamp/age and warns actual measurements may be older. Existing access control and CSRF apply to the POST.

This change does NOT disable Homey's own Tesla app polling or external flows; it cannot guarantee a lower Tesla invoice. To stop the true upstream billable polling, inspect that Homey app's settings separately with authorization. No real Tesla calls or commands were made for QA.
