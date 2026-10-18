// Main meter verified against the existing Homey inventory. Never sum sub-meters.
export const MAIN_METER_ID = '52c4a219-ebee-4be0-aa52-38e800aaa239';
export function energySummary(devices, now=Date.now()) {
  const meter=devices?.[MAIN_METER_ID], cap=meter?.capabilitiesObj?.measure_power;
  const raw=cap?.lastUpdated;
  const sourceAt=typeof raw==='number'?raw:typeof raw==='string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)?Date.parse(raw):NaN;
  const fresh=meter?.available!==false && Number.isFinite(sourceAt) && sourceAt<=now && now-sourceAt<=900000;
  const watts=fresh && typeof cap?.value==='number' && Number.isFinite(cap.value)?cap.value:null;
  return {live:{watts,solar:null},today:{kwh:null,trend:null},points:[],source:'Pulse Hunstein 48C · hovedmåler',sourceAt:Number.isFinite(sourceAt)?new Date(sourceAt).toISOString():null,quality:watts===null?'unavailable':'measured',note:'Kun hovedmålerens siste effekt. Døgnrapport, solproduksjon og sammenligning er ikke verifisert her.'};
}
