# Concrete rollout configuration checklist

No production values have been read out, generated, written or changed by this checklist. Do not combine this checklist with an automatic deployment authorization.

| Item | Required action before cutover |
| --- | --- |
| API access | Securely provision AUTH_TOKENS_JSON as a JSON object mapping required viewer/operator/admin roles to distinct random credentials, minimum 24 characters each. Update every API client to Authorization: Bearer. No VITE secret variable. Confirm role allocation and recovery/rotation procedure. |
| Runtime | Deploy reviewed Dockerfile on Node 22, NODE_ENV=production, DEMO_MODE=false or unset; Railway start command node index.js, readiness /readyz, 120-second check. Keep one replica. |
| Persistent config | Explicitly set CONFIG_PATH=/data/config.json only if this is the verified existing volume/file. Preserve existing content; back it up and test restore. Verify the Docker node user can read/write that mount. Any ownership change needs approval. |
| Database | Retain DATABASE_URL and region. Confirm whether actual route is private railway.internal or public TLS. Public route must validate its certificate; add PG_TLS_CA only if a custom CA is actually required. Apply additive migration 002 only after a restorable backup and isolated migration check. No history deletion or retention change. |
| Existing Homey connection | Verify HOMEY_PAT is already securely provisioned; hardcoded fallback was removed. Preserve HOMEY_CLOUD_ID if set; discovery remains supported. Do not rotate grants or physically test devices as a side effect. |
| Existing OpenAI | Preserve OPENAI_API_KEY and selected OPENAI_MODEL/OPENAI_CHAT_MODEL if those features are desired. No new key/model choice is required by the code change. |
| MCP, conditional | For retained MCP chat tools, supply an approved authenticated HTTPS HOMEY_MCP_URL and HOMEY_MCP_TOKEN; review exact additional action names in HOMEY_MCP_ALLOWED_TOOLS_JSON. The existing bridge is untouched. If it cannot meet the requirements, explicitly accept MCP disabled or separately authorize a bridge project; no HTTP fallback. |
| Browser origin | Same-origin dashboard needs no new CORS origin or VITE_API_BASE. Verify any existing separately hosted clients before preserving/changing CORS_ORIGIN. |
| Voice, release blocker | Approve exact separate HTTPS voice host, verify existing two agent settings, add hostname to their allowlists only if needed, pin widget version and add parent frame-src plus origin-specific microphone delegation. See VOICE-ISOLATION.md. These voice settings are proposed, not implemented environment variables. |
| Publication | Explicit authorization for commit/push/PR/merge/deploy remains separate; main may auto-deploy. Capture previous image and retain access protection during rollback. |

Recommended single approval scope, once exact origins/roles are filled in: provision the listed role credentials securely, preserve existing service credentials, approve the verified DB TLS route and backup/migration, approve Node 22/non-root volume compatibility and readiness, choose authenticated MCP or explicitly disabled MCP, and approve the specified isolated voice host plus its two agent-domain entries and microphone delegation. Do not ask approval for unspecified origins, blanket provider access or unrelated region/retention changes.
