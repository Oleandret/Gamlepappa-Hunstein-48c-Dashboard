import { isEnabled, query } from './db.js';
import { homeyClient } from './homeyClient.js';
import { isDemoMode } from '../config.js';

/**
 * Auto-flow executor. Får liste av (device_id, capability, prev, next)-
 * endringer fra device-poller, sammenholder med enable-de auto-flows som
 * har matchende trigger, og kjører action-listene via homeyClient.
 *
 * Throttling: hver flow har et min_interval_seconds-felt slik at vi ikke
 * fyrer av samme flow flere ganger på rappen (f.eks. hvis en bryter sender
 * flere events kjapt).
 *
 * Demo-mode: actions skrives kun til logg, ikke faktisk sendt til Homey.
 */

let enabledFlowsCache = [];
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;  // last enabled-flows fra DB max én gang per minutt

async function loadEnabledFlows(force = false) {
  if (!force && Date.now() - cacheLoadedAt < CACHE_TTL_MS && enabledFlowsCache.length > 0) {
    return enabledFlowsCache;
  }
  const res = await query(
    `SELECT id, title, trigger, actions, last_run_at, min_interval_seconds
     FROM auto_flows
     WHERE enabled = true`
  );
  enabledFlowsCache = res.rows;
  cacheLoadedAt = Date.now();
  return enabledFlowsCache;
}

export function invalidateFlowCache() {
  cacheLoadedAt = 0;
  enabledFlowsCache = [];
}

/**
 * Sjekk om en spesifikk device-change matcher en triggers betingelse.
 * Endring = { deviceId, capability, prev, next }.
 */
function triggerMatches(trigger, change) {
  if (!trigger || trigger.type !== 'device_change') return false;
  if (trigger.deviceId !== change.deviceId) return false;
  if (trigger.capability !== change.capability) return false;
  switch (trigger.condition) {
    case 'changes':
      return true;
    case 'becomes_true':
      return change.next === true && change.prev !== true;
    case 'becomes_false':
      return change.next === false && change.prev !== false;
    case 'equals':
      return JSON.stringify(change.next) === JSON.stringify(trigger.value);
    default:
      return false;
  }
}

/**
 * Kjør én action og returner { ok, action, error? }.
 */
async function runAction(action) {
  if (!action?.type) return { ok: false, action, error: 'mangler type' };
  if (isDemoMode()) {
    // I demo skriver vi bare logg, men later som det gikk OK
    return { ok: true, action, demo: true };
  }
  try {
    if (action.type === 'set_capability') {
      if (!action.deviceId || !action.capability) throw new Error('mangler deviceId eller capability');
      await homeyClient.setCapabilityValue(action.deviceId, action.capability, action.value);
      return { ok: true, action };
    }
    if (action.type === 'run_flow') {
      if (!action.flowId) throw new Error('mangler flowId');
      await homeyClient.runFlow(action.flowId);
      return { ok: true, action };
    }
    return { ok: false, action, error: `ukjent action-type: ${action.type}` };
  } catch (err) {
    return { ok: false, action, error: err.message };
  }
}

/**
 * Kjør én auto-flow. Skriv run-rad til auto_flow_runs og oppdater
 * last_run_at / run_count / last_error på auto_flows.
 */
async function executeFlow(flow, triggerEvent) {
  const startedAt = Date.now();
  const results = [];
  let allOk = true;

  for (const action of flow.actions || []) {
    const r = await runAction(action);
    results.push(r);
    if (!r.ok) allOk = false;
  }

  const durationMs = Date.now() - startedAt;
  const lastError = results.find(r => !r.ok)?.error || null;

  try {
    await query(
      `INSERT INTO auto_flow_runs (flow_id, trigger_event, actions_result, ok, duration_ms)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5)`,
      [flow.id, JSON.stringify(triggerEvent), JSON.stringify(results), allOk, durationMs]
    );
    await query(
      `UPDATE auto_flows
       SET last_run_at = NOW(), last_run_ok = $1, last_error = $2, run_count = run_count + 1
       WHERE id = $3`,
      [allOk, lastError, flow.id]
    );
  } catch (err) {
    console.error('[auto-flow] failed to log run:', err.message);
  }

  return { flowId: flow.id, ok: allOk, results, durationMs };
}

/**
 * Hovedinngang fra device-poller. Tar en array av endringer:
 *   [{ deviceId, capability, prev, next }]
 * Sjekker hver mot alle aktive flows og kjører de som matcher.
 */
export async function onDeviceChanges(changes) {
  if (!isEnabled() || !changes?.length) return { fired: 0 };
  const flows = await loadEnabledFlows();
  if (flows.length === 0) return { fired: 0 };

  const now = Date.now();
  let fired = 0;

  for (const flow of flows) {
    // Throttling
    if (flow.last_run_at) {
      const ageSec = (now - new Date(flow.last_run_at).getTime()) / 1000;
      if (ageSec < (flow.min_interval_seconds || 5)) continue;
    }

    for (const change of changes) {
      if (triggerMatches(flow.trigger, change)) {
        try {
          await executeFlow(flow, change);
          fired++;
          // Etter en run må vi vente til neste flow-iterasjon for throttling
          break;
        } catch (err) {
          console.error(`[auto-flow ${flow.id}] execute error:`, err.message);
        }
      }
    }
  }

  return { fired };
}
