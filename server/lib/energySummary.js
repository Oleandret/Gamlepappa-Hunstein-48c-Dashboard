// Main meter verified against the existing Homey inventory. Never sum sub-meters.
export const MAIN_METER_ID = '52c4a219-ebee-4be0-aa52-38e800aaa239';
export function powerObservation(device, now=Date.now()) {
  const cap=device?.capabilitiesObj?.measure_power,raw=cap?.lastUpdated;
  const at=typeof raw==='number'?raw:typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)?Date.parse(raw):NaN;
  const fresh=device?.available!==false&&Number.isFinite(at)&&at<=now&&now-at<=900000;
  const numeric=typeof cap?.value==='number'&&Number.isFinite(cap.value);
  const watts=!fresh||!numeric?null:cap.units==='kW'?cap.value*1000:cap.units==null||cap.units==='W'?cap.value:null;
  return {watts,sourceAt:Number.isFinite(at)?new Date(at).toISOString():null};
}
export function energySummary(devices, now=Date.now()) {
  const {watts,sourceAt}=powerObservation(devices?.[MAIN_METER_ID],now);
  return {live:{watts,solar:null},today:{kwh:null,trend:null},points:[],source:'Pulse Hunstein 48C · hovedmåler',sourceAt,quality:watts===null?'unavailable':'measured',note:'Kun hovedmålerens siste effekt. Døgnrapport, solproduksjon og sammenligning er ikke verifisert her.'};
}
