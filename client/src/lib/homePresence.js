/**
 * Grupperer valgte enheter per person. En person er hjemme når minst én av
 * enhetene er på nett (sett på hjemmenettet siste 15 minutter). Personer
 * hjemme først, så alfabetisk.
 */
export function presencePeople(selected, netDevices) {
  const byMac = new Map((netDevices || []).map(d => [d.id, d]));
  const people = new Map();
  for (const [mac, { person }] of Object.entries(selected || {})) {
    const name = (person || '').trim() || byMac.get(mac)?.name || mac;
    const p = people.get(name) || { person: name, home: false, devices: [] };
    const d = byMac.get(mac);
    p.devices.push({ mac, name: d?.name || mac, online: d?.online === true, status: d?.status || 'ikke funnet i hjemmenett' });
    if (d?.online) p.home = true;
    people.set(name, p);
  }
  return [...people.values()].sort((a, b) => (b.home - a.home) || a.person.localeCompare(b.person, 'nb'));
}
