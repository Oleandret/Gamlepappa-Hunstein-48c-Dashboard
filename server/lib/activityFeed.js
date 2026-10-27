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
