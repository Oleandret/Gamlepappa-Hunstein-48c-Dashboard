import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Temperaturhistorikk for «Grafer» under Varmestyring:
 *  - varmepumpen: °C-punkter fra myUplink-loggen (heating-history, 30 dagers bevaring)
 *  - romfølere: measure_temperature fra Homey-hendelsesloggen (device_events)
 * Punktene slås sammen til gjennomsnitt per tidsbøtte så lange perioder holder
 * seg små. Bøttene inneholder bare faktiske målinger; tomme bøtter er hull.
 */
export const RANGES = { 1: 15, 7: 60, 30: 360, 365: 1440 }; // dager → bøttestørrelse i minutter
const SENTINEL = -32768;

export function bucketize(points, bucketMs) {
  const buckets = new Map();
  for (const { at, value } of points) {
    if (!Number.isFinite(at) || !Number.isFinite(value)) continue;
    const key = Math.floor(at / bucketMs) * bucketMs;
    const b = buckets.get(key) || { sum: 0, n: 0 };
    b.sum += value; b.n++;
    buckets.set(key, b);
  }
  return [...buckets].sort((a, b) => a[0] - b[0]).map(([at, b]) => ({ at, value: Math.round((b.sum / b.n) * 100) / 100 }));
}

/** °C-serier fra myUplink-loggfiler (allerede lest og parset), én per parameter. */
export function heatpumpSeries(records, bucketMs) {
  const byParam = new Map();
  for (const r of records) {
    for (const p of r.points || []) {
      if (p.parameterUnit !== '°C' || p.enumLabel || typeof p.value !== 'number' || !Number.isFinite(p.value) || p.value === SENTINEL) continue;
      const id = String(p.parameterId);
      const s = byParam.get(id) || { id, name: p.parameterName || id, unit: '°C', raw: [] };
      s.raw.push({ at: r.recordedAt, value: p.value });
      byParam.set(id, s);
    }
  }
  return [...byParam.values()]
    .map(({ raw, ...s }) => ({ ...s, points: bucketize(raw, bucketMs) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}

const pattern = /^sample-(\d{13})-[a-f0-9]{8}\.json$/;
export async function readHeatpumpRecords(dir, since, { maxFiles = 4096, maxBytes = 64 * 1024 * 1024 } = {}) {
  let names;
  try { names = await fs.readdir(dir); } catch (e) { if (e.code === 'ENOENT') return { records: [], startedAt: null }; throw e; }
  const all = names.filter(n => pattern.test(n)).sort();
  const selected = all.filter(n => Number(n.match(pattern)[1]) >= since).slice(-maxFiles);
  const records = [];
  let bytes = 0;
  for (const n of selected) {
    const file = path.join(dir, n), st = await fs.lstat(file);
    if (!st.isFile() || st.isSymbolicLink() || st.size > 512 * 1024) continue;
    bytes += st.size;
    if (bytes > maxBytes) break;
    try { records.push(JSON.parse(await fs.readFile(file, 'utf8'))); } catch { /* hopp over ødelagt fil */ }
  }
  return { records, startedAt: all.length ? Number(all[0].match(pattern)[1]) : null };
}

/** Romfølere fra device_events, snitt per bøtte i databasen. */
export async function roomSeries(query, days, bucketMs, zones = {}) {
  const bucketSec = bucketMs / 1000;
  const rows = (await query(
    `SELECT device_id, MAX(device_name) AS name, MAX(zone) AS zone,
            floor(extract(epoch FROM ts) / $2) * $2 AS bucket,
            AVG((value)::text::double precision) AS value
       FROM device_events
      WHERE capability = 'measure_temperature' AND jsonb_typeof(value) = 'number'
        AND ts > NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY device_id, bucket
      ORDER BY device_id, bucket
      LIMIT 200000`, [days, bucketSec])).rows;
  const byDevice = new Map();
  for (const r of rows) {
    const s = byDevice.get(r.device_id) || { id: r.device_id, name: r.name || r.device_id, zone: zones[r.zone]?.name || null, unit: '°C', points: [] };
    const value = Number(r.value);
    if (Number.isFinite(value)) s.points.push({ at: Number(r.bucket) * 1000, value: Math.round(value * 100) / 100 });
    byDevice.set(r.device_id, s);
  }
  return [...byDevice.values()].sort((a, b) => (a.zone || '~').localeCompare(b.zone || '~', 'nb') || a.name.localeCompare(b.name, 'nb'));
}
