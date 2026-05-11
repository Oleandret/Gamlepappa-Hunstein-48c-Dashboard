import { homeyClient } from '../lib/homeyClient.js';
import { isDemoMode } from '../config.js';
import { MOCK_DEVICES, MOCK_ZONES } from '../lib/mockData.js';
import { isEnabled, query } from '../lib/db.js';

/**
 * Server-side poller som hver POLL_MS-millisekund henter device-status
 * fra Homey, sammenlikner mot forrige snapshot, og logger TRANSITIONS
 * (faktiske endringer) + periodiske SNAPSHOTS til Postgres.
 *
 * Kjører kun hvis DATABASE_URL er satt. Polling skjer asynkront i
 * bakgrunnen og blokkerer aldri HTTP-handlere.
 */

const POLL_MS = Number(process.env.DEVICE_POLL_MS) || (10 * 60 * 1000); // 10 min default
// Snapshots for slow-moving sensor-verdier (temp, batteri) — én gang per time
const SNAPSHOT_EVERY_MS = 60 * 60 * 1000;

let lastState = new Map();       // device_id → { capability → value }
let lastSnapshotTs = 0;
let pollTimer = null;
let lastPollAt = null;
let lastPollResult = null;       // {ok, polledDevices, transitions, snapshots, error?}

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
  const d = new Date();
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
    const base = i * 11;
    placeholders.push(
      `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}::jsonb, $${base+6}::jsonb, $${base+7}, $${base+8}, $${base+9}, $${base+10}, $${base+11})`
    );
    values.push(
      r.device_id, r.device_name || null, r.zone || null, r.class || null,
      r.capability,
      r.value === undefined ? null : JSON.stringify(r.value),
      r.prev_value === undefined ? null : JSON.stringify(r.prev_value),
      r.kind || 'transition',
      r.hour_of_day, r.day_of_week, r.is_weekend
    );
  });
  const sql = `
    INSERT INTO device_events
      (device_id, device_name, zone, class, capability, value, prev_value, kind, hour_of_day, day_of_week, is_weekend)
    VALUES ${placeholders.join(', ')}
  `;
  await query(sql, values);
  return rows.length;
}

/**
 * Én poll-syklus.
 */
async function pollOnce() {
  if (!isEnabled()) return null;
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
    const transitionRows = [];
    const snapshotRows = [];
    const shouldSnapshot = (Date.now() - lastSnapshotTs) >= SNAPSHOT_EVERY_MS;

    for (const d of devArr) {
      const caps = capObj(d);
      const prev = lastState.get(d.id) || {};
      const changes = diffCaps(prev, caps);

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
          ...ctx
        });
      }

      // Snapshot: kun for sensor-aktige capabilities som ikke gir transitions
      // (temp, batteri, fuktighet, lux, effekt)
      if (shouldSnapshot) {
        for (const cap of ['measure_temperature', 'measure_humidity', 'measure_luminance', 'measure_battery', 'measure_power']) {
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
              ...ctx
            });
          }
        }
      }

      lastState.set(d.id, caps);
    }

    transitions = await insertEvents(transitionRows);
    snapshots = await insertEvents(snapshotRows);
    if (shouldSnapshot && snapshotRows.length > 0) lastSnapshotTs = Date.now();

    lastPollAt = startedAt;
    lastPollResult = { ok: true, polledDevices, transitions, snapshots, durationMs: Date.now() - startedAt };
    console.log(`[poller] ok — ${polledDevices} devs, ${transitions} transitions, ${snapshots} snapshots, ${Date.now() - startedAt}ms`);
    return lastPollResult;
  } catch (err) {
    lastPollAt = startedAt;
    lastPollResult = { ok: false, polledDevices, transitions, snapshots, error: err.message, durationMs: Date.now() - startedAt };
    console.error('[poller] error:', err.message);
    return lastPollResult;
  }
}

export function startDevicePoller() {
  if (!isEnabled()) {
    console.log('[poller] disabled (no DATABASE_URL)');
    return;
  }
  if (pollTimer) return;
  console.log(`[poller] starting — every ${POLL_MS / 1000}s`);
  // Første poll etter 15s slik at serveren rekker å starte ferdig
  setTimeout(pollOnce, 15_000);
  pollTimer = setInterval(pollOnce, POLL_MS);
}

export function stopDevicePoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function pollerStatus() {
  return {
    enabled: isEnabled(),
    running: Boolean(pollTimer),
    intervalMs: POLL_MS,
    lastPollAt,
    lastPollResult,
    cachedDevices: lastState.size
  };
}

// Trigger en poll umiddelbart (brukes av /api/events/poll-now-endepunkt)
export async function triggerPollNow() {
  return pollOnce();
}
