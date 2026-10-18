import {sourceAt,powerWatts,energyKwh} from './measurements.js';
// Owner confirmed whole-house Pulse; stable ID read from Homey 2026-10-17.
export const HUNSTEIN_MAIN_ID='52c4a219-ebee-4be0-aa52-38e800aaa239';
export const sourceTime=sourceAt;
export function hunsteinMeter(devices,now=Date.now()){
 const d=devices?.[HUNSTEIN_MAIN_ID];if(!d)return null;
 const p=d.capabilitiesObj?.measure_power,m=d.capabilitiesObj?.meter_power;
 const at=sourceTime(p?.lastUpdated),meterAt=sourceTime(m?.lastUpdated);
 return {name:d.name,watts:powerWatts(p),at:Number.isFinite(at)?at:null,stale:!Number.isFinite(at)||now-at>120000||at>now+5000,
 dailyKwh:energyKwh(m),meterAt:Number.isFinite(meterAt)?meterAt:null};
}
