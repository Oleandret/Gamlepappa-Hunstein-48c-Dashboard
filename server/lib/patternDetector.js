import { query, isEnabled } from './db.js';

/**
 * Heuristisk pattern-detektor som leter etter to typer mønstre i
 * device_events:
 *
 *  1. **Co-occurrence**: "Når A skjer, skjer B innen N sekunder, M% av tiden".
 *     Finner kandidater til hvis-da-flows (f.eks. "stua-lys på → kjøkken-lys på").
 *
 *  2. **Tidsbasert**: "Lampe X slås på kl 06:42 ± 8 min, 18 dager av 30".
 *     Finner kandidater til tidsplan-flows (f.eks. morgenrutine, leggetid).
 *
 *  Resultater rangeres med en score (støtte × konfidens × stabilitet) og
 *  skrives til `patterns`-tabellen. Aktiv-flagget settes på dem som er
 *  topp-rangerte; resten ligger lagret som arkiv.
 *
 *  Kjøres som scheduled job (én gang per døgn) — typisk på natta — eller
 *  manuelt fra Innsikt-fanen via POST /api/insights/analyze.
 */

// Tidsvindu for hva som teller som "co-occurrence" — A skjer, B må skje
// innen denne tiden for å regnes som mønster.
const CO_WINDOW_SECONDS = 60;
// Hvor langt tilbake vi henter events fra
const LOOKBACK_DAYS = 30;
// Minimums-støtte: minst så mange ganger må mønsteret være observert
const MIN_SUPPORT_CO = 5;
const MIN_SUPPORT_TIME = 7;
// Minimums-konfidens for co-occurrence (0.5 = B følger A i minst halvparten av tilfellene)
const MIN_CONFIDENCE_CO = 0.5;
// Tidsmønstre må være stabile innenfor denne stddev (i timer)
const MAX_TIME_STDDEV_HOURS = 1.0;

export async function detectCoOccurrence() {
  if (!isEnabled()) return [];
  const sql = `
    WITH events AS (
      SELECT id, ts, device_id, device_name, zone, capability,
             COALESCE(value::text, 'null') AS val
      FROM device_events
      WHERE kind = 'transition' AND ts > NOW() - ($1 || ' days')::interval
    ),
    a_totals AS (
      SELECT device_id, device_name, zone, capability, val, COUNT(*)::int AS total
      FROM events
      GROUP BY device_id, device_name, zone, capability, val
      HAVING COUNT(*) >= $2
    ),
    pairs AS (
      SELECT
        a.device_id   AS a_id,   a.device_name AS a_name,   a.zone AS a_zone,
        a.capability  AS a_cap,  a.val          AS a_val,
        b.device_id   AS b_id,   b.device_name AS b_name,   b.zone AS b_zone,
        b.capability  AS b_cap,  b.val          AS b_val,
        COUNT(*)::int AS pair_count,
        AVG(EXTRACT(EPOCH FROM (b.ts - a.ts)))::real    AS avg_delay,
        STDDEV(EXTRACT(EPOCH FROM (b.ts - a.ts)))::real AS stddev_delay
      FROM events a
      JOIN events b
        ON b.ts > a.ts
       AND b.ts <= a.ts + ($3 || ' seconds')::interval
       AND b.device_id <> a.device_id
      GROUP BY a.device_id, a.device_name, a.zone, a.capability, a.val,
               b.device_id, b.device_name, b.zone, b.capability, b.val
      HAVING COUNT(*) >= $2
    )
    SELECT p.*, t.total AS a_total,
           (p.pair_count::real / t.total) AS confidence
    FROM pairs p
    JOIN a_totals t ON t.device_id = p.a_id
                   AND t.capability = p.a_cap
                   AND t.val = p.a_val
    WHERE (p.pair_count::real / t.total) >= $4
    ORDER BY (p.pair_count::real / t.total) * p.pair_count DESC
    LIMIT 50
  `;
  const res = await query(sql, [LOOKBACK_DAYS, MIN_SUPPORT_CO, CO_WINDOW_SECONDS, MIN_CONFIDENCE_CO]);
  return res.rows.map(r => ({
    kind: 'co_occurrence',
    description: `Når ${describeEvent(r.a_name, r.a_cap, r.a_val)}, skjer også ${describeEvent(r.b_name, r.b_cap, r.b_val)} innen ${Math.round(r.avg_delay)}s — ${Math.round(r.confidence * 100)}% av tiden (${r.pair_count}/${r.a_total} ganger)`,
    data: {
      trigger: { deviceId: r.a_id, deviceName: r.a_name, zone: r.a_zone, capability: r.a_cap, value: r.a_val },
      follows: { deviceId: r.b_id, deviceName: r.b_name, zone: r.b_zone, capability: r.b_cap, value: r.b_val },
      pairCount: r.pair_count,
      aTotal: r.a_total,
      avgDelaySec: r.avg_delay,
      stddevDelaySec: r.stddev_delay
    },
    confidence: r.confidence,
    support: r.pair_count,
    // Score: kombinasjon av konfidens og volum, justert mot stabilitet
    score: r.confidence * Math.log10(r.pair_count + 1) * (1 / (1 + (r.stddev_delay || 0) / 10))
  }));
}

export async function detectTimeBased() {
  if (!isEnabled()) return [];
  const sql = `
    WITH events AS (
      SELECT device_id, device_name, zone, capability,
             COALESCE(value::text, 'null') AS val,
             is_weekend,
             EXTRACT(HOUR FROM ts)::real + EXTRACT(MINUTE FROM ts)::real / 60.0 AS hour_dec
      FROM device_events
      WHERE kind = 'transition' AND ts > NOW() - ($1 || ' days')::interval
    )
    SELECT device_id, device_name, zone, capability, val, is_weekend,
           COUNT(*)::int AS occurrences,
           AVG(hour_dec)::real    AS avg_hour,
           STDDEV(hour_dec)::real AS stddev_hour
    FROM events
    GROUP BY device_id, device_name, zone, capability, val, is_weekend
    HAVING COUNT(*) >= $2
       AND COALESCE(STDDEV(hour_dec), 0) <= $3
    ORDER BY COUNT(*) DESC, COALESCE(STDDEV(hour_dec), 0) ASC
    LIMIT 50
  `;
  const res = await query(sql, [LOOKBACK_DAYS, MIN_SUPPORT_TIME, MAX_TIME_STDDEV_HOURS]);
  return res.rows.map(r => {
    const h = Math.floor(r.avg_hour);
    const m = Math.round((r.avg_hour - h) * 60);
    const stddev = r.stddev_hour || 0;
    const range = stddev * 60;
    const dayType = r.is_weekend ? 'helger' : 'hverdager';
    return {
      kind: 'time_based',
      description: `${describeEvent(r.device_name, r.capability, r.val)} skjer ~kl ${pad(h)}:${pad(m)} (±${Math.round(range)} min) på ${dayType}, ${r.occurrences} ganger siste 30 dager`,
      data: {
        device: { deviceId: r.device_id, deviceName: r.device_name, zone: r.zone, capability: r.capability, value: r.val },
        avgHour: r.avg_hour,
        stddevHours: r.stddev_hour,
        rangeMinutes: range,
        isWeekend: r.is_weekend,
        occurrences: r.occurrences
      },
      confidence: 1 / (1 + stddev),  // lavere stddev = høyere konfidens
      support: r.occurrences,
      score: Math.log10(r.occurrences + 1) * (1 / (1 + stddev * 2))
    };
  });
}

function describeEvent(name, cap, val) {
  const v = (val || '').replace(/^"|"$/g, '');
  if (cap === 'onoff') return `${name} ${v === 'true' ? 'slås på' : 'slås av'}`;
  if (cap === 'locked') return `${name} ${v === 'true' ? 'låses' : 'låses opp'}`;
  if (cap === 'dim') return `${name} dimmes til ${Math.round(Number(v) * 100)}%`;
  if (cap.startsWith('alarm_')) return `${name} alarm "${cap.replace('alarm_', '')}" = ${v}`;
  if (cap.startsWith('measure_')) return `${name} ${cap.replace('measure_', '')} = ${v}`;
  return `${name} ${cap}=${v}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

/**
 * Hovedinngang: kjør begge detektorer, merk gamle som inactive,
 * og lagre de nye til DB. Returnerer hva som ble lagret.
 */
export async function runDetection() {
  if (!isEnabled()) return { error: 'database not configured' };
  const startedAt = Date.now();

  // De-aktiver eksisterende patterns (vi sletter ikke, beholder dem for historikk)
  await query(`UPDATE patterns SET active = false WHERE active = true`);

  const [co, time] = await Promise.all([detectCoOccurrence(), detectTimeBased()]);
  const all = [...co, ...time].sort((a, b) => (b.score || 0) - (a.score || 0));

  // Lagre alle, men marker topp-50 som active
  let saved = 0;
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    const active = i < 50;
    await query(
      `INSERT INTO patterns (kind, description, data, confidence, support, score, active)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)`,
      [p.kind, p.description, JSON.stringify(p.data), p.confidence, p.support, p.score, active]
    );
    saved++;
  }

  return {
    ok: true,
    coOccurrence: co.length,
    timeBased: time.length,
    saved,
    durationMs: Date.now() - startedAt
  };
}
