/**
 * Romtemperaturer for forsiden: gjennomsnitt av innendørs temperaturfølere
 * per Homey-sone. Følere i utendørs eller uoppvarmede soner (også undersoner
 * av f.eks. «Ute») og følere i kjøl/frys/ovn o.l. holdes utenfor, så
 * utetemperaturen ikke blir vist som romtemperatur.
 */

const EXCLUDE_NAME_RE = /(kj.l|frys|fridge|freezer|ovn|oven|varmtvann|water heater|sauna|badstu|\bute\b|utend|utvend|outdoor|outside|grill|peis|terr?asse|balkong|hage|garden)/i;
const EXCLUDE_CLASS = new Set(['fridge', 'freezer']);
const OUTDOOR_ZONE_RE = /(\bute\b|utend|utvend|uteplass|hage|garden|terr?asse|balkong|veranda|garasje|carport|ballbane|sykler|outdoor|outside)/i;

/** Sonen eller en av over-sonene er utendørs eller uoppvarmet. */
export function isOutdoorZone(zoneId, zones) {
  const seen = new Set();
  let z = zones?.[zoneId];
  while (z && !seen.has(z.id)) {
    if (OUTDOOR_ZONE_RE.test(z.name || '')) return true;
    seen.add(z.id);
    z = z.parent ? zones[z.parent] : null;
  }
  return false;
}

const capNum = (d, cap) => {
  const v = d?.capabilitiesObj?.[cap]?.value ?? (Array.isArray(d?.capabilities) ? undefined : d?.capabilities?.[cap]);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

export function indoorTemperatureGroups(devices, zones, limit = 6) {
  const byZone = new Map();
  for (const d of Object.values(devices || {})) {
    const t = capNum(d, 'measure_temperature');
    if (t === null || d.available === false) continue;
    if (EXCLUDE_CLASS.has(d.class) || EXCLUDE_NAME_RE.test(d.name || '')) continue;
    const zone = zones?.[d.zone];
    if (!zone || isOutdoorZone(zone.id, zones)) continue;
    if (!byZone.has(zone.id)) byZone.set(zone.id, { id: zone.id, name: zone.name || 'Rom', temps: [], targets: [] });
    const g = byZone.get(zone.id);
    g.temps.push(t);
    const target = capNum(d, 'target_temperature');
    if (target !== null) g.targets.push(target);
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  return [...byZone.values()]
    .map(g => ({ id: g.id, name: g.name, temp: avg(g.temps), target: g.targets.length ? avg(g.targets) : null, sensorCount: g.temps.length }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
    .slice(0, limit);
}
