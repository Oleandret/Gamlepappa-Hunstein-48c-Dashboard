# Dashboard upgrade: rollout gate

This branch is NOT authorized for automatic production deployment. Do not merge into the Railway-watched main branch before the coordinator approves the concrete steps below.

## What changes

- API access fails closed without AUTH_TOKENS_JSON. Roles are viewer (read), operator (device/chat/scene actions), admin (configuration and automation administration). Session tokens are held only in the browser session. This first implementation uses administrator-managed bearer credentials, not SSO/MFA or individual identities.
- MCP has no default address. Requires an explicitly configured HTTPS HOMEY_MCP_URL and HOMEY_MCP_TOKEN. Additional executable tool names require HOMEY_MCP_ALLOWED_TOOLS_JSON. Tool names must be reviewed against the actual bridge. The existing bridge is NOT modified by this branch. If it cannot provide authenticated HTTPS, MCP stays disabled; do not weaken these checks.
- Public database connections verify certificates; private *.railway.internal connections remain private-network connections. A custom CA can be supplied as PG_TLS_CA. Approve and stage-test the actual TLS route before production deployment. No DATABASE_URL/region change is performed by this branch.
- Docker build runs Node 22 as the non-root node user. /data must be writable by that user. Do not change production volume permissions without approval; verify in staging first.
- /healthz is liveness. /readyz requires migrations and valid access configuration. Railway healthcheck points to /readyz. Failure keeps a deployment unready.
- Version 002 adds dashboard_actions, schema_migrations, and device_events.observed_at/time_source. Existing history is retained. New auto_flows default to disabled. No data is deleted, no existing automation is enabled/disabled by the migration.
- Config remains on the existing file store with serialized atomic writes. Multi-replica operation is not supported for this file store or scene coordination. Keep one replica until config/scene coordination is migrated to transactional storage.

## Required concrete approvals before rollout

1. Choose access provisioning and approve creating/distributing viewer/operator/admin credentials securely. Do not paste credentials into chat or commit them. No credentials were generated during implementation.
2. Approve the authenticated HTTPS MCP endpoint/token and the specific permitted action tools, or explicitly deploy with MCP disabled. Do not expose or alter the existing Mac bridge as an incidental setup step.
3. Approve the public-DB TLS/CA configuration if applicable. Do not move the database between regions as part of this code rollout.
4. Approve a backup of Postgres and /data/config.json, verify a restoration in an isolated staging environment, then approve the additive migration and Docker/non-root/healthcheck changes.
5. Confirm staging has no production Homey/OpenAI/MCP credentials and no network path allowing physical actions. Run tests/build and exercise authentication, stale-data UI, migration and rollback there.
6. Approve merging the reviewed PR and the resulting Railway deployment. Railway's watched main branch may auto-deploy on merge.

## Safe release sequence

- Capture deployed image/commit and a restorable DB/config backup. Do not print backup contents or connection strings.
- Restore backup into isolated staging; apply migration; validate event counts, configuration values and role behavior. No production control calls.
- Provision approved credentials outside chat, validate /readyz, then explicitly authorize the release.
- Verify read-only health, login, room data and absence of live/mock mixing. Physical scene/device tests require a separate specific user request.

## Rollback

Prefer reverting feature commits while retaining the authentication gate. A full rollback to the old commit reintroduces the public unauthenticated API and must not be performed without approved access protection. The new additive tables/columns can remain: do not drop history. Keep the config backup; restore it only if specifically needed and approved. Do not automatically reverse physical device commands. Failed or pending scene actions require inspection, not automatic retry.

## First-version scope and data requirements

1. Rooms: current available temperature/humidity/power readings and reported device availability. No new sensors or person tracking.
2. Brief: deterministic facts, offline devices and reported alarms. Temperature thresholds (5/30 C) are simple notices, not safety judgments.
3. Learned routines: repeated onoff observations on at least three distinct local dates; suggestions only. Existing AI suggestions/compile workflow remains available with disabled outputs. Polling time is explicitly approximate.
4. Dry-run: replay up to 5000 observations from 30 days against a saved device-change flow and cooldown; never executes actions. It is not a physical simulator and does not synthesize downstream events.
5. Scenes: user-configured dimmable lights for film/dinner/night/away. No locks, alarms or arbitrary Homey flows. Results are checked with a fresh read. Undo is one-use, within two minutes, and requires current values still matching; races with external controllers remain possible because Homey has no compare-and-swap operation. Stop rather than blindly retry when uncertain.
6. Energy detective: measured instantaneous power ranked per meter; no overlap-prone house total, invented kWh, costs or savings. Reliable aggregate energy needs a validated Homey report endpoint or meter history, meter hierarchy and tariff/prices.
7. Timeline: observed transitions, app action requests/results and automation runs; unknown causality is labeled. Old history cannot retrospectively acquire an actor/source timestamp.

## Retention and region work

No retention job runs and no history is deleted. Choose retention periods and archive/restore policy before enabling cleanup. App/database colocation should be planned separately with latency measurements, backup, migration window and explicit approval. No active memory leak was established by the review.

## Third-party UI and authentication

The previously unversioned ElevenLabs script and its custom elements have been removed from the authenticated document. A script loaded into that origin could access the dashboard session and act as the user. The voice embed needs a separately hosted, sandboxed origin and its own narrowly scoped integration; this branch does not provision it. Existing external avatar content remains cross-origin. CSP restricts scripts and API connections to self.

The first-version role credentials are shared per role, not individual identities. The audit timeline records a role or system actor, never claims a named person. Individual SSO/MFA remains a separate access provisioning decision.

## Existing-client compatibility gate

Before activation, inventory all existing browser/API/automation consumers. Unauthenticated API calls will return 401 after this change; provision only the minimum required role and update consumers to send Authorization: Bearer before cutover. Browser sessions need a new login; shared role tokens do not identify individual users. A viewer must not be used for existing command clients. Do not temporarily disable authentication for compatibility. Keep the previous deployment available behind approved protection until consumers are validated. Voice compatibility is an explicit unresolved release gate; see verification/RESULTS.md.
