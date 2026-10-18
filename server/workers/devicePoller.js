import { homeyClient } from '../lib/homeyClient.js';
import { isDemoMode } from '../config.js';
import { MOCK_DEVICES, MOCK_ZONES } from '../lib/mockData.js';
import { isEnabled, query } from '../lib/db.js';
import { onDeviceChanges } from '../lib/autoFlowExecutor.js';

/**
 * Server-side poller som hver POLL_MS-millisekund henter device-status
 * fra Homey, sammenlikner mot forrige snapshot, og logger TRANSITIONS
 * (faktiske endringer) + periodiske SNAPSHOTS til Postgres.
 *
 * Kjører kun hvis DATABASE_URL er satt. Polling skjer asynkront i
 * bakgrunnen og blokkerer aldri HTTP-handlere.
 */

const DEFAULT_POLL_MS = Number(process.env.DEVICE_POLL_MS) || (10 * 60 * 1000); // 10 min default
// Snapshots for slow-moving sensor-verdier (temp, batteri) — én gang per time
const SNAPSHOT_EVERY_MS = 60 * 60 * 1000;
// Backoff: hvis polls feiler gjentatte ganger, doble intervallet opp til denne maks
const MAX_BACKOFF_MS = 60 * 60 * 1000; // 1 time

let inFlight = null;
let startupTimer = null;
let lastState = new Map();       // device_id → { capability → value }
let lastSnapshotTs = 0;
let pollTimer = null;
let lastPollAt = null;
let lastPollResult = null;       // {ok, polledDevices, transitions, snapshots, error?}

// Runtime-kontroll
let pollIntervalMs = DEFAULT_POLL_MS;
let pollerEnabled = true;        // kan skrus av fra UI uten å restarte serveren
let consecutiveFailures = 0;     // for backoff
let currentBackoffMs = 0;        // ekstra ventetid etter feil

function capObj(d) {
  // Normaliser capability-payload til { cap: value } map
  if (!d) return {};
  if (d.capabilities && !Array.isArray(d.capabilities)) {
    // Allerede flat — Homey returnerer noen ganger {cap: value, cap2: value2}
    return d.capabilities;
  }
  if (d.capabilitiesObj && typeof d.capabilitiesObj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(d.capabilitiesObj)) {
      out[k] = v?.value;
    }
    return out;
  }
  return {};
}

/**
 * Hent enheter + soner. I demo-mode brukes mock-data, ellers homeyClient.
 */
async function fetchDevicesAndZones() {
  if (isDemoMode()) {
    return { devices: MOCK_DEVICES, zones: MOCK_ZONES };
  }
  const [devices, zones] = await Promise.all([
    homeyClient.listDevices(),
    homeyClient.listZones()
  ]);
  return { devices, zones };
}

/**
 * Diff to capability-maps og returner liste av endringer som skal logges
 * som transitions.
 */
function diffCaps(prev, next) {
  const changes = [];
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  for (const cap of keys) {
    const a = prev?.[cap];
    const b = next?.[cap];
    if (b === undefined) continue;             // capability forsvant — hopp over
    if (!valuesEqual(a, b)) {
      changes.push({ capability: cap, prev: a, next: b });
    }
  }
  return changes;
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    // Behandle små flytende endringer som "ingen endring" for å unngå støy
    // (typisk strømmålere som rapporterer en watt opp/ned)
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const diff = Math.abs(a - b);
      const mag = Math.max(Math.abs(a), Math.abs(b), 1);
      return diff / mag < 0.005;  // < 0.5% relativ endring = ignorer
    }
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function nowContext() {
  const local = new Date().toLocaleString('en-US', { timeZone: 'Europe/Oslo' });
  const d = new Date(local);
  return {
    hour_of_day: d.getHours(),
    day_of_week: d.getDay(),
    is_weekend: d.getDay() === 0 || d.getDay() === 6,
    is_dark: null,        // fyll inn fra værdata senere
    outdoor_temp: null,
    someone_home: null
  };
}

/**
 * Skriv en batch av events til DB. Bruker én INSERT med VALUES-liste for
 * effektivitet — 1 round-trip uansett antall rader.
 */
async function insertEvents(rows) {
  if (rows.length === 0) return 0;
  const values = [];
  const placeholders = [];
  rows.forEach((r, i) => {
    const base = i * 14;
    // Kolonnerekkefølge: device_id, device_name, zone, class, capability,
    // value (jsonb), prev_value (jsonb), kind, hour_of_day, day_of_week, is_weekend
    placeholders.push(
      `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6}::jsonb, $${base+7}::jsonb, $${base+8}, $${base+9}, $${base+10}, $${base+11}, $${base+12}, $${base+13}, $${base+14})`
    );
    values.push(
      r.device_id,
      r.device_name || null,
      r.zone || null,
      r.class || null,
      r.capability,
      r.value === undefined || r.value === null ? null : JSON.stringify(r.value),
      r.prev_value === undefined || r.prev_value === null ? null : JSON.stringify(r.prev_value),
      r.kind || 'transition',
      r.hour_of_day,
      r.day_of_week,
      r.is_weekend,
      r.sourceTs || new Date().toISOString(), new Date().toISOString(), r.sourceTs ? 'device' : 'poll'
    );
  });
  const sql = `
    INSERT INTO device_events
      (device_id, device_name, zone, class, capability, value, prev_value, kind, hour_of_day, day_of_week, is_weekend, ts, observed_at, time_source)
    VALUES ${placeholders.join(', ')}
  `;
  await query(sql, values);
  return rows.length;
}

/**
 * Én poll-syklus.
 */
function pollOnce(options = {}) {
  if (!inFlight) inFlight = performPoll(options).finally(() => { inFlight = null; });
  return inFlight;
}

async function performPoll({ manual = false } = {}) {
  if (!isEnabled()) return null;
  // Hopp over auto-polls hvis poller er pauset (men tillat manuelle 'Poll nå')
  if (!pollerEnabled && !manual) return lastPollResult;
  const startedAt = Date.now();
  let polledDevices = 0;
  let transitions = 0;
  let snapshots = 0;

  try {
    const { devices, zones } = await fetchDevicesAndZones();
    const zoneById = new Map(Object.values(zones || {}).map(z => [z.id, z]));
    const devArr = Array.isArray(devices) ? devices : Object.values(devices || {});
    polledDevices = devArr.length;

    const ctx = nowContext();
    const nextState = new Map();
    const transitionRows = [];
    const snapshotRows = [];
    const shouldSnapshot = (Date.now() - lastSnapshotTs) >= SNAPSHOT_EVERY_MS;
    // Samle alle endringer for executor — { deviceId, capability, prev, next }
    const allChanges = [];

    for (const d of devArr) {
      const caps = capObj(d);
      const prev = lastState.get(d.id) || {};
      const changes = lastState.has(d.id) ? diffCaps(prev, caps) : [];

      const zoneName = zoneById.get(d.zone)?.name || null;

      for (const c of changes) {
        transitionRows.push({
          device_id: d.id,
          device_name: d.name,
          zone: zoneName,
          class: d.class,
          capability: c.capability,
          value: c.next,
          prev_value: c.prev,
          kind: 'transition',
          sourceTs: sourceTimestamp(d.capabilitiesObj?.[c.capability]?.lastUpdated),
          ...ctx
        });
        allChanges.push({
          deviceId: d.id,
          deviceName: d.name,
          capability: c.capability,
          prev: c.prev,
          next: c.next
        });
      }

      // Snapshot: kun for sensor-aktige capabilities som ikke gir transitions
      // (temp, batteri, fuktighet, lux, effekt)
      if (shouldSnapshot) {
        for (const cap of ['measure_temperature', 'measure_humidity', 'measure_luminance', 'measure_battery', 'measure_power', 'meter_power']) {
          if (caps[cap] !== undefined) {
            snapshotRows.push({
              device_id: d.id,
              device_name: d.name,
              zone: zoneName,
              class: d.class,
              capability: cap,
              value: caps[cap],
              prev_value: null,
              kind: 'snapshot',
              sourceTs: sourceTimestamp(d.capabilitiesObj?.[cap]?.lastUpdated),
              ...ctx
            });
          }
        }
      }

      nextState.set(d.id, structuredClone(caps));
    }

    // One statement is atomic: a snapshot failure cannot leave committed transitions.
    await insertEvents([...transitionRows, ...snapshotRows]);
    transitions = transitionRows.length;
    snapshots = snapshotRows.length;
    lastState = nextState;
    if (shouldSnapshot && snapshotRows.length > 0) lastSnapshotTs = Date.now();

    // Trigger eventuelle auto-flows som matcher disse endringene
    let firedFlows = 0;
    if (allChanges.length > 0) {
      try {
        const flowResult = await onDeviceChanges(allChanges);
        firedFlows = flowResult.fired || 0;
      } catch (err) {
        console.warn('[poller] auto-flow executor error:', err.message);
      }
    }

    // Vellykket poll — nullstill backoff
    consecutiveFailures = 0;
    if (currentBackoffMs > 0) {
      currentBackoffMs = 0;
      rescheduleTimer();
    }

    lastPollAt = startedAt;
    lastPollResult = {
      ok: true, polledDevices, transitions, snapshots, firedFlows,
      durationMs: Date.now() - startedAt
    };
    console.log(`[poller] ok — ${polledDevices} devs, ${transitions} transitions, ${snapshots} snapshots, ${firedFlows} flows fired, ${Date.now() - startedAt}ms`);
    return lastPollResult;
  } catch (err) {
    // Feil — øk backoff slik at vi ikke hamrer en Homey som sliter
    consecutiveFailures++;
    if (consecutiveFailures >= 3) {
      const prev = currentBackoffMs || pollIntervalMs;
      currentBackoffMs = Math.min(prev * 2, MAX_BACKOFF_MS);
      rescheduleTimer();
      console.warn(`[poller] ${consecutiveFailures} feil på rad — backoff til ${(pollIntervalMs + currentBackoffMs) / 1000}s`);
    }
    lastPollAt = startedAt;
    lastPollResult = {
      ok: false, polledDevices, transitions, snapshots, error: err.message,
      consecutiveFailures, durationMs: Date.now() - startedAt
    };
    console.error('[poller] error:', err.message);
    return lastPollResult;
  }
}

function effectiveInterval() {
  return pollIntervalMs + currentBackoffMs;
}

function rescheduleTimer() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = setInterval(() => pollOnce(), effectiveInterval());
}

export function startDevicePoller() {
  if (!isEnabled()) {
    console.log('[poller] disabled (no DATABASE_URL)');
    return;
  }
  if (pollTimer) return;
  console.log(`[poller] starting — every ${pollIntervalMs / 1000}s (enabled=${pollerEnabled})`);
  startupTimer = setTimeout(() => pollOnce(), 15_000);
  pollTimer = setInterval(() => pollOnce(), effectiveInterval());
}

export function stopDevicePoller() {
  clearTimeout(startupTimer);
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/** Skru poller av/på i farten (auto-polls hopper over når av). */
export function setPollerEnabled(enabled) {
  pollerEnabled = Boolean(enabled);
  console.log(`[poller] ${pollerEnabled ? 'enabled' : 'PAUSED'} via runtime-kontroll`);
  return pollerEnabled;
}

/** Endre poll-intervall i farten (minutter). */
export function setPollIntervalMinutes(minutes) {
  const m = Math.max(1, Math.min(120, Number(minutes) || 10));
  pollIntervalMs = m * 60 * 1000;
  currentBackoffMs = 0;
  consecutiveFailures = 0;
  rescheduleTimer();
  console.log(`[poller] intervall satt til ${m} min`);
  return m;
}

export function pollerStatus() {
  return {
    enabled: isEnabled(),
    running: Boolean(pollTimer),
    paused: !pollerEnabled,
    intervalMs: pollIntervalMs,
    effectiveIntervalMs: effectiveInterval(),
    backoffMs: currentBackoffMs,
    consecutiveFailures,
    lastPollAt,
    lastPollResult,
    cachedDevices: lastState.size
  };
}

// Trigger en poll umiddelbart (brukes av /api/events/poll-now-endepunkt)
export async function triggerPollNow() {
  return pollOnce({ manual: true });
}

function sourceTimestamp(value) {
  const ts = typeof value === 'number' ? value : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? Date.parse(value) : NaN;
  // Preserve older source times; observed_at already records when we read them.
  return Number.isFinite(ts) && ts >= Date.UTC(2000, 0, 1) && ts <= Date.now() ? new Date(ts).toISOString() : null;
}
