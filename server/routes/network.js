import {readNetworkSnapshot} from '../lib/networkSnapshot.js';
import {readHjemmenettDevices} from '../lib/hjemmenettClient.js';
import {homeyClient} from '../lib/homeyClient.js';
import {Router} from 'express';
import {getNamespace,setNamespace} from '../lib/configStore.js';
import {importNetwork,networkView} from '../lib/networkInventory.js';
export const networkRoutes=Router();
let pending=Promise.resolve();
// Inherits the existing /api authentication. No new collector access is created.
networkRoutes.get('/v1/snapshot', async (_req,res)=>res.json(await readNetworkSnapshot()));
// «Enhetene mine» fra hjemmenett-MCP-en (lese-nøkkel på serveren) for nettverkslaget i 3D-huset.
networkRoutes.get('/devices', async (_req,res)=>res.json(await readHjemmenettDevices()));
networkRoutes.get('/',async(_req,res)=>{try{const state=networkView(await getNamespace('_networkInventory'));let devices,quality='available';try{devices=await homeyClient.listDevices();}catch{devices=homeyClient.listDevices.snapshot?.()?.value;quality='stale';}const nodes=Object.values(devices||{}).filter(d=>d.driverUri==='homey:app:net.tornbloms.deco').map(d=>({id:d.id,name:d.name,available:d.available===true,fields:Object.fromEntries(['connected_clients','lan_ipv4_ipaddr','device_role','backhaul_connection','measure_down_kilo_bytes_per_second','measure_up_kilo_bytes_per_second'].filter(k=>d.capabilitiesObj?.[k]).map(k=>[k,{value:d.capabilitiesObj[k].value,units:d.capabilitiesObj[k].units||null,lastUpdated:d.capabilitiesObj[k].lastUpdated||null}]))}));res.json({...state,homey:{quality:devices?quality:'unavailable',nodes,clientListAvailable:false}});}catch{res.status(503).json({error:'Nettverksoversikten kunne ikke leses'});}});
networkRoutes.post('/inventory',async(req,res)=>{
 if(req.user?.role!=='admin')return res.status(403).json({error:'Administrator kreves'});
 try{importNetwork(null,req.body);}catch(e){return res.status(400).json({error:e.message});}
 const task=pending.catch(()=>{}).then(async()=>{const next=importNetwork(await getNamespace('_networkInventory'),req.body);await setNamespace('_networkInventory',next);return networkView(next);});pending=task;
 try{res.json(await task);}catch{res.status(503).json({error:'Listen kunne ikke lagres'});}
});

