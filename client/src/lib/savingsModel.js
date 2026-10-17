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
export function overview(rows, mainId, subIds = []) {
  const main = rows.find(r => r.id === mainId);
  const trusted = r => r?.power.quality === 'measured';
  const selected = rows.filter(r => r.id !== mainId && subIds.includes(r.id));
  const valid = selected.filter(trusted);
  const subtotal = valid.length ? valid.reduce((sum,r)=>sum+r.power.value,0) : null;
  const total = trusted(main) ? main.power.value : null;
  return { total, subtotal, residual:total !== null && subtotal !== null ? total-subtotal : null,
    inconsistent:total !== null && subtotal !== null && subtotal > total,
    measured:rows.filter(trusted).length, stale:rows.filter(r=>r.power.quality==='stale').length,
    missing:rows.filter(r=>r.power.quality==='missing').length, selected:valid.length,
    rooms:[...new Set(selected.map(r=>r.room))].map(room=>({room, watts:selected.filter(r=>r.room===room&&trusted(r)).reduce((s,r)=>s+r.power.value,0), count:selected.filter(r=>r.room===room&&trusted(r)).length}))
  };
}
// Samples are cumulative meter readings, never instantaneous watts treated as kWh.
export function osloDate(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(now));
}
export function meterHistory(samples, mainId) {
  const points = samples.filter(s=>s.id===mainId&&finite(s.kwh)&&finite(s.at)).sort((a,b)=>a.at-b.at);
  const intervals = [];
  for (let i=1;i<points.length;i++) {
    const a=points[i-1], b=points[i], delta=b.kwh-a.kwh;
    if (b.at<=a.at) continue;
    intervals.push({start:a.at,end:b.at,kwh:delta>=0?delta:null,quality:delta>=0?'measured':'missing',reason:delta<0?'Måleren er nullstilt eller har endret retning':null});
  }
  return intervals;
}
export function appendSample(samples, row) {
  if(row?.meter.quality!=='measured') return samples;
  const point={id:row.id,at:row.meter.at,kwh:row.meter.value};
  if(samples.some(s=>s.id===point.id&&s.at===point.at)) return samples;
  return [...samples,point].slice(-1440);
}
