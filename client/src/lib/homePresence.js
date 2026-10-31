/**
 * Hvem er hjemme, ut fra nettverksenhetene som er valgt i 3D-huset.
 *
 * Monitoren sier bare «på nett nå» (sett i trafikken siste 15 minutter) og en
 * lesbar «sist sett»-tekst. En iPhone i dvale er stille lenger enn 15 minutter,
 * så en enhet som er sett for inntil RECENT_MINUTES siden regnes som «nylig»
 * og personen som hjemme – slik monitorens eget «hvem er hjemme» gjør det.
 * Personer hjemme først, så alfabetisk.
 */
export const RECENT_MINUTES = 60;

/** «sist sett for 12 min siden» → 12, «akkurat nå» → 0, «for 2 timer siden» → 120, «for 1 dag siden» → 1440; ukjent tekst → null. */
export function minutesSinceSeen(status) {
  if (typeof status !== 'string') return null;
  const s = status.toLowerCase();
  if (s.includes('på nett nå') || s.includes('akkurat nå')) return 0;
  const m = s.match(/for (\d+) (min|time|dag)/);
  if (!m) return null;
  return Number(m[1]) * ({ min: 1, time: 60, dag: 1440 })[m[2]];
}

/** Tilstand for én enhet: home (på nett nå), recent (sett nylig), away (sett for lenge siden) eller unknown (ikke funnet / aldri sett). */
export function deviceState(d) {
  if (!d) return 'unknown';
  if (d.online === true) return 'home';
  const min = minutesSinceSeen(d.status);
  if (min === null) return 'unknown';
  return min <= RECENT_MINUTES ? 'recent' : 'away';
}

const RANK = { home: 0, recent: 1, away: 2, unknown: 3 };

export function presencePeople(selected, netDevices) {
  const byMac = new Map((netDevices || []).map(d => [d.id, d]));
  const people = new Map();
  for (const [mac, { person }] of Object.entries(selected || {})) {
    const name = (person || '').trim() || byMac.get(mac)?.name || mac;
    const p = people.get(name) || { person: name, state: 'unknown', home: false, devices: [] };
    const d = byMac.get(mac);
    const state = deviceState(d);
    p.devices.push({ mac, name: d?.name || mac, online: d?.online === true, state, status: d?.status || 'ikke funnet i hjemmenett' });
    if (RANK[state] < RANK[p.state]) p.state = state;
    p.home = p.state === 'home' || p.state === 'recent';
    people.set(name, p);
  }
  return [...people.values()].sort((a, b) => (RANK[a.state] - RANK[b.state]) || a.person.localeCompare(b.person, 'nb'));
}
