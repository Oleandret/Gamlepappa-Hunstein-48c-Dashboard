export function sourceAt(value) {
  const at=typeof value==='number'?value:typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)?Date.parse(value):NaN;
  return Number.isFinite(at)&&at>=Date.UTC(2000,0,1)?at:null;
}
// Homey's standard measure_power is W. Explicit driver overrides take precedence.
export function powerWatts(cap) {
  if(typeof cap?.value!=='number'||!Number.isFinite(cap.value))return null;
  if(cap.units==='kW')return cap.value*1000;
  if(cap.units==null||cap.units==='W')return cap.value;
  return null; // kWh is energy, never an instantaneous power value.
}
export function energyKwh(cap) {
  if(typeof cap?.value!=='number'||!Number.isFinite(cap.value))return null;
  if(cap.units==='Wh')return cap.value/1000;
  if(cap.units==null||cap.units==='kWh')return cap.value;
  return null;
}
