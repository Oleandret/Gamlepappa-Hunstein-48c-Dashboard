// Pure read-only energy domain model.
export const MAX_AGE_MS = 120_000;
export const finite = value => typeof value === 'number' && Number.isFinite(value);
export function reading(cap, quality, now = Date.now(), available = true) {
  const value = cap?.value;
  const at = Date.parse(cap?.lastUpdated || '');
  if (!finite(value)) return { value:null, quality:'missing', at:null };
  if (quality === 'demo') return { value, quality:'demo', at:finite(at)?at:null };
  if (!available || quality !== 'live' || !finite(at) || now - at > MAX_AGE_MS || at > now + 5000) return { value, quality:'stale', at:finite(at)?at:null };
  return { value, quality:'measured', at };
}
export function inventory(devices = {}, zones = {}, quality, now = Date.now()) {
  return Object.entries(devices).map(([id,d]) => ({
    id, name:d.name || id, room:zones[d.zone]?.name || 'Ukjent rom', kind:d.class || 'unknown',
    power:reading(d.capabilitiesObj?.measure_power, quality, now, d.available !== false),
    meter:reading(d.capabilitiesObj?.meter_power, quality, now, d.available !== false),
    // A light classification alone is not authorization to control it.
    canPlan:d.class === 'light' && typeof d.capabilitiesObj?.onoff?.value === 'boolean'
  }));
}
