/**
 * «Aktivitet» på forsiden: sensorhendelser fra den lagrede Homey-loggen,
 * nyeste først. Første observerte status (baseline) er ikke en hendelse og
 * tas ikke med. Tidspunktet er sensorens egen tid når Homey oppgir den,
 * ellers når dashboardet observerte endringen.
 */
const TEXT = {
  alarm_motion: [v => v ? 'Bevegelse' : 'Bevegelse stoppet', 'motion'],
  alarm_presence: [v => v ? 'Tilstedeværelse' : 'Tilstedeværelse borte', 'motion'],
  alarm_contact: [v => v ? 'Åpnet' : 'Lukket', 'door'],
  garagedoor_closed: [v => v ? 'Garasjeport lukket' : 'Garasjeport åpnet', 'door'],
  locked: [v => v ? 'Låst' : 'Låst opp', 'security'],
  alarm_smoke: [v => v ? 'RØYK' : 'Røykalarm avsluttet', 'alarm'],
  alarm_co: [v => v ? 'CO-alarm' : 'CO-alarm avsluttet', 'alarm'],
  alarm_water: [v => v ? 'VANNLEKKASJE' : 'Vannalarm avsluttet', 'alarm']
};

// «Bevegelse stoppet» gir bare støy i loggen; dører, lås og alarmer vises begge veier.
const QUIET_WHEN_FALSE = new Set(['alarm_motion', 'alarm_presence']);

export function activityFromHistory(events, zones = {}, { limit = 60 } = {}) {
  return (events || [])
    .filter(e => e.kind === 'transition' && TEXT[e.capability.split('.')[0]])
    .filter(e => e.value === true || !QUIET_WHEN_FALSE.has(e.capability.split('.')[0]))
    .map(e => {
      const [label, type] = TEXT[e.capability.split('.')[0]];
      const room = zones[e.zone]?.name;
      return { id: e.id, ts: e.sourceAt || e.observedAt, type, active: e.value === true,
        text: `${label(e.value)} — ${e.name}${room ? ` (${room})` : ''}`, timeSource: e.sourceAt ? 'sensor' : 'observert' };
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

// ─── Lang historikk fra hendelsesloggen i databasen (device_events) ─────
export const ACTIVITY_CAPS = Object.keys(TEXT);
export const ACTIVITY_DAYS = [1, 7, 30, 90, 365, 3650];

/** Rader fra device_events (zone er sonenavn) → samme format som activityFromHistory. */
export function activityFromRows(rows = []) {
  return rows.map(r => {
    const cap = String(r.capability).split('.')[0], entry = TEXT[cap];
    if (!entry || typeof r.value !== 'boolean') return null;
    const [label, type] = entry, ts = new Date(r.ts).getTime();
    return { id: `${r.device_id}:${r.capability}:${ts}`, ts, type, active: r.value === true,
      text: `${label(r.value)} — ${r.device_name || r.device_id}${r.zone ? ` (${r.zone})` : ''}`, timeSource: r.time_source === 'device' ? 'sensor' : 'observert' };
  }).filter(Boolean);
}

/** Én side med hendelser, nyeste først. `before` (ms) blar bakover. */
export async function readActivityPage(query, { days = 7, before = null, limit = 60 } = {}) {
  const rows = (await query(
    `SELECT ts, device_id, device_name, zone, capability, value, time_source
       FROM device_events
      WHERE kind = 'transition'
        AND split_part(capability, '.', 1) = ANY($1::text[])
        AND jsonb_typeof(value) = 'boolean'
        AND NOT (split_part(capability, '.', 1) IN ('alarm_motion', 'alarm_presence') AND value = 'false'::jsonb)
        AND ts > NOW() - ($2::int * INTERVAL '1 day')
        AND ($3::timestamptz IS NULL OR ts < $3::timestamptz)
      ORDER BY ts DESC
      LIMIT $4`,
    [ACTIVITY_CAPS, days, before ? new Date(before).toISOString() : null, limit + 1])).rows;
  const items = activityFromRows(rows.slice(0, limit));
  return { activity: items, hasMore: rows.length > limit, oldest: items.at(-1)?.ts ?? null };
}
