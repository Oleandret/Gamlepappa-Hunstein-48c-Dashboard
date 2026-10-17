// Owner confirmed whole-house Pulse; stable ID read from Homey 2026-10-17.
export const HUNSTEIN_MAIN_ID='52c4a219-ebee-4be0-a052-38e800aaa239';
export const sourceTime=value=>typeof value==='number'&&Number.isFinite(value)&&value>1e12?value:Date.parse(typeof value==='string'?value:'');
export function hunsteinMeter(devices,now=Date.now()){
 const d=devices?.[HUNSTEIN_MAIN_ID];if(!d)return null;
 const p=d.capabilitiesObj?.measure_power,m=d.capabilitiesObj?.meter_power;
 const at=sourceTime(p?.lastUpdated),meterAt=sourceTime(m?.lastUpdated);
 return {name:d.name,watts:typeof p?.value==='number'&&Number.isFinite(p.value)?p.value:null,at:Number.isFinite(at)?at:null,stale:!Number.isFinite(at)||now-at>120000||at>now+5000,
 dailyKwh:typeof m?.value==='number'&&Number.isFinite(m.value)?m.value:null,meterAt:Number.isFinite(meterAt)?meterAt:null};
}
