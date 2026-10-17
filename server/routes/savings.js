import { Router } from 'express';
import { homeyClient } from '../lib/homeyClient.js';
import { energyReader, osloDate } from '../lib/energyReader.js';
import { isDemoMode } from '../config.js';
import { MOCK_DEVICES, MOCK_ZONES } from '../lib/mockData.js';
// Kept separate from legacy /energy: its response schema is not a verified Homey schema.
export function createSavingsRoutes(client=homeyClient, demo=isDemoMode) {
  const router=Router();
  const devices=energyReader(()=>client.listDevices());
  const zones=energyReader(()=>client.listZones(),{ttl:300_000});
  const live=energyReader(()=>client.getEnergyLive());
  let dayDate, dayReader;
  router.get('/',async(_req,res)=>{
    const date=osloDate();
    if(demo()) return res.json({date,devices:{value:MOCK_DEVICES,quality:'demo',updatedAt:null},zones:{value:MOCK_ZONES,quality:'demo',updatedAt:null},live:{quality:'demo'},day:{quality:'demo'},executionEnabled:false,analysis:'rules'});
    if(dayDate!==date){dayDate=date;dayReader=energyReader(()=>client.getEnergyDay(date),{ttl:900_000});}
    const [d,z,l,h]=await Promise.all([devices(),zones(),live(),dayReader()]);
    // Raw energy responses are intentionally not exposed: units/hierarchy not yet verified.
    const metadata=({quality,updatedAt,retryAt,reason})=>({quality,updatedAt,retryAt,reason,schemaVerified:false});
    // Only fields required by energy insight leave the server.
    const safeDevices=Object.fromEntries(Object.entries(d.value||{}).map(([id,v])=>[id,{id,name:v.name,zone:v.zone,class:v.class,available:v.available,capabilitiesObj:Object.fromEntries(['measure_power','meter_power','onoff'].filter(k=>v.capabilitiesObj?.[k]).map(k=>[k,{value:v.capabilitiesObj[k].value,lastUpdated:v.capabilitiesObj[k].lastUpdated}]))}]));
    const safeZones=Object.fromEntries(Object.entries(z.value||{}).map(([id,v])=>[id,{name:v.name}]));
    res.json({date,devices:{...d,value:safeDevices},zones:{...z,value:safeZones},live:metadata(l),day:metadata(h),executionEnabled:false,analysis:'rules'});
  });
  // No action endpoint exists, even if a caller manually crafts a request.
  router.all('*',(_req,res)=>res.status(405).json({error:'Strømsparing støtter bare lesing',executionEnabled:false}));
  return router;
}
export const savingsRoutes=createSavingsRoutes();
