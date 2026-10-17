// Pure domain logic shared by the UI and isolated Node tests. No command adapter.
export const MAX_AGE_MS = 120_000;
export const finite = value => typeof value === 'number' && Number.isFinite(value);
export function osloDate(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(now));
}
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
export function intervalCost(intervals, prices) {
  // Exact matching avoids spreading daily kWh over hourly prices or inventing missing prices.
  let cost=0, covered=0;
  for(const i of intervals) {
    const p=prices.find(p=>p.start===i.start&&p.end===i.end&&p.currency==='NOK'&&p.unit==='NOK/kWh');
    if(i.quality==='measured'&&finite(i.kwh)&&p&&finite(p.value)) {cost+=i.kwh*p.value; covered++;}
  }
  return {cost:covered ? cost:null,covered,complete:intervals.length>0&&covered===intervals.length};
}
export function recommendations(rows, summary) {
  const result=[];
  if(summary.total===null) result.push({title:'Identifiser hovedmåleren',body:'Velg bekreftet hovedmåler med fersk effektmåling før du vurderer hele husets forbruk.'});
  if(summary.stale) result.push({title:'Kontroller datakildene',body:`${summary.stale} enheter har foreldet eller ukjent måletid. De er utelatt fra beregningene.`});
  if(summary.inconsistent) result.push({title:'Mulig overlapp eller usamtidige målinger',body:'Valgte undermålere overstiger hovedmåleren. Kontroller målerhierarkiet før du bruker romfordelingen.'});
  const top=rows.filter(r=>r.power.quality==='measured'&&r.power.value>0).sort((a,b)=>b.power.value-a.power.value)[0];
  if(top) result.push({title:`Undersøk ${top.name}`,body:`Høyeste observerte effekt er ${Math.round(top.power.value)} W. Dette er ikke et bekreftet avvik; historisk normalnivå mangler. Ingen besparelse er beregnet.`});
  return result;
}
export function validatePlan(plan, rows) {
  const device=rows.find(d=>d.id===plan.deviceId);
  const errors=[];
  if(!device?.canPlan) errors.push('Bare identifiserte lys med av/på kan planlegges. Ukjente og kritiske enheter er sperret.');
  if(device?.power.quality!=='measured') errors.push('Fersk målt effekt kreves.');
  if(!plan.nonCritical) errors.push('Bekreft at lyset ikke er kritisk, nødlys eller nødvendig for trygg ferdsel.');
  if(!plan.reason?.trim()) errors.push('Beskriv hvorfor tiltaket er ønskelig.');
  if(!plan.comfort?.trim()) errors.push('Oppgi egne komfort- og sikkerhetsgrenser.');
  if(!finite(plan.minutes)||plan.minutes<1||plan.minutes>120) errors.push('Velg en simulering på 1–120 minutter.');
  return errors;
}
export function simulate(plan, rows) {
  const errors=validatePlan(plan,rows);
  if(errors.length) return {ok:false,errors};
  const d=rows.find(d=>d.id===plan.deviceId);
  return {ok:true,deviceId:d.id,watts:d.power.value,estimatedKwh:Math.max(0,d.power.value)/1000*plan.minutes/60,
    note:'Estimert energiforskjell hvis observert effekt varer hele perioden og lyset ellers ville vært på. Ikke dokumentert besparelse.',physicalExecution:false};
}
export function appendSample(samples, row) {
  if(row?.meter.quality!=='measured') return samples;
  const point={id:row.id,at:row.meter.at,kwh:row.meter.value};
  if(samples.some(s=>s.id===point.id&&s.at===point.at)) return samples;
  return [...samples,point].slice(-1440);
}
