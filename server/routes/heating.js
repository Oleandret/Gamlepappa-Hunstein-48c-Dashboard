import { Router } from 'express';
import { createMyUplinkReader } from '../lib/myuplinkReader.js';
import { myuplinkOAuth } from '../lib/myuplinkOAuth.js';
import { settingsLog, settingsWriter } from '../lib/heatingControl.js';
import { settingsOf, diffSettings } from '../lib/heatingSettingsLog.js';
const disconnected=createMyUplinkReader();
let reader, revision;
export async function connectedRead() {
  const state=await myuplinkOAuth.status();
  if(!state.connected||!state.selected||state.reauthorizationRequired)return {...await disconnected(),reason:state.reauthorizationRequired?'Lesetilgangen er utløpt. Koble til på nytt.':state.connected?'Velg den bekreftede varmepumpen for å lese målinger.':state.reason};
  if(!reader || revision!==myuplinkOAuth.revision()) {
    const selected=await myuplinkOAuth.record();
    reader=createMyUplinkReader({enabled:true,deviceId:selected.deviceId,systemId:selected.systemId,getAccessToken:myuplinkOAuth.accessToken,allowOffline:state.offline,allowWrite:state.writeApproved});revision=myuplinkOAuth.revision();
  }
  return reader();
}
// A setting change must show up on the next read, not after the 60 s cache.
export function resetHeatingRead(){reader=null;}
const defaultControl={log:settingsLog,writer:settingsWriter,afterWrite:resetHeatingRead};
export function createHeatingRoutes(read=connectedRead, oauth=myuplinkOAuth, control=defaultControl) {
  const router=Router();
  const handle=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){res.status([400,403,429,503].includes(e.status)?e.status:503).json({error:'myUplink-forespørselen kunne ikke fullføres. Kontroller tilkoblingsstatus.'});}};
  router.get('/',handle(async(_req,res)=>{const connection=await oauth.status();res.json({...await read(),model:'NIBE F1255-12 R EM',executionEnabled:connection.writeGranted===true,oauthReady:connection.configured,connection});}));
  router.post('/connect',handle(async(req,res)=>res.json(await oauth.start(req,res))));
  router.get('/systems',handle(async(req,res)=>res.json({devices:await oauth.systems(req)})));
  router.post('/select',handle(async(req,res)=>res.json(await oauth.select(req))));
  router.post('/disconnect',handle(async(req,res)=>res.json(await oauth.disconnect(req))));

  // Setting changes: owner's Google session + CSRF only, validated against the device's own limits.
  const handleControl=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){const status=[400,403,404,409,429].includes(e.status)?e.status:503;res.status(status).json({error:status===503?'Varmepumpen kunne ikke nås. Ingen endring er bekreftet.':e.message});}};
  const history=()=>{const log=control.log();if(!log)throw Object.assign(new Error('myUplink er ikke konfigurert'),{status:409});return log;};
  router.get('/settings',handleControl(async(_req,res)=>{const [data,connection]=await Promise.all([read(),oauth.status()]);res.json({status:data.status,fetchedAt:data.fetchedAt,settings:settingsOf(data.points),writeApproved:connection.writeApproved===true,writeGranted:connection.writeGranted===true});}));
  router.post('/settings',handleControl(async(req,res)=>{oauth.owner(req,true);const changes=req.body?.changes;if(!changes||typeof changes!=='object'||Array.isArray(changes))throw Object.assign(new Error('Ingen endringer'),{status:400});const entry=await(await control.writer()).apply(changes,{source:'manuell'});control.afterWrite();res.json(entry);}));
  router.get('/settings/history',handleControl(async(_req,res)=>res.json({days:await history().days()})));
  router.get('/settings/changes',handleControl(async(_req,res)=>res.json({changes:await history().changes(200)})));
  router.get('/settings/history/:date',handleControl(async(req,res)=>{const snapshot=await history().day(req.params.date);if(!snapshot)throw Object.assign(new Error('Ingen innstillinger lagret for denne dagen'),{status:404});const data=await read();res.json({snapshot,diff:data.points?diffSettings(snapshot,data.points):null,currentStatus:data.status});}));
  router.post('/settings/restore',handleControl(async(req,res)=>{
    oauth.owner(req,true);
    const date=req.body?.date,only=Array.isArray(req.body?.parameterIds)?new Set(req.body.parameterIds.map(String)):null;
    const snapshot=await history().day(date);if(!snapshot)throw Object.assign(new Error('Ingen innstillinger lagret for denne dagen'),{status:404});
    const writer=await control.writer();
    const diff=diffSettings(snapshot,[...(await writer.readPoints()).values()]).filter(d=>d.restorable&&(!only||only.has(d.parameterId)));
    if(!diff.length)return res.json({at:new Date().toISOString(),source:`gjenoppretting:${date}`,results:[],message:'Ingenting å gjenopprette; innstillingene er like'});
    const entry=await writer.apply(Object.fromEntries(diff.map(d=>[d.parameterId,d.value])),{source:`gjenoppretting:${date}`});control.afterWrite();res.json(entry);
  }));
  router.all('*',(_req,res)=>res.status(405).set('Allow','GET, HEAD').json({error:'Metoden støttes ikke'}));
  return router;
}
export const heatingRoutes=createHeatingRoutes();
