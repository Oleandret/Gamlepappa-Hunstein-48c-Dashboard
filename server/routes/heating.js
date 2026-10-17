import { Router } from 'express';
import { createMyUplinkReader } from '../lib/myuplinkReader.js';
import { myuplinkOAuth } from '../lib/myuplinkOAuth.js';
const disconnected=createMyUplinkReader();
let reader, revision;
async function connectedRead() {
  const state=await myuplinkOAuth.status();
  if(!state.connected||!state.selected||state.reauthorizationRequired)return {...await disconnected(),reason:state.reauthorizationRequired?'Lesetilgangen er utløpt. Koble til på nytt.':state.connected?'Velg den bekreftede varmepumpen for å lese målinger.':state.reason};
  if(!reader || revision!==myuplinkOAuth.revision()) {
    const selected=await myuplinkOAuth.record();
    reader=createMyUplinkReader({enabled:true,deviceId:selected.deviceId,systemId:selected.systemId,getAccessToken:myuplinkOAuth.accessToken,allowOffline:state.offline});revision=myuplinkOAuth.revision();
  }
  return reader();
}
export function createHeatingRoutes(read=connectedRead, oauth=myuplinkOAuth) {
  const router=Router();
  const handle=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){res.status([400,403,429,503].includes(e.status)?e.status:503).json({error:'myUplink-forespørselen kunne ikke fullføres. Kontroller tilkoblingsstatus.'});}};
  router.get('/',handle(async(_req,res)=>{const connection=await oauth.status();res.json({...await read(),model:'NIBE F1255-12 R EM',executionEnabled:false,oauthReady:connection.configured,connection});}));
  router.post('/connect',handle(async(req,res)=>res.json(await oauth.start(req,res))));
  router.get('/systems',handle(async(req,res)=>res.json({devices:await oauth.systems(req)})));
  router.post('/select',handle(async(req,res)=>res.json(await oauth.select(req))));
  router.post('/disconnect',handle(async(req,res)=>res.json(await oauth.disconnect(req))));
  router.all('*',(_req,res)=>res.status(405).set('Allow','GET, HEAD').json({error:'Ingen fysisk styring støttes'}));
  return router;
}
export const heatingRoutes=createHeatingRoutes();
