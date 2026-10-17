import {Router} from 'express';
import {getNamespace,setNamespace} from '../lib/configStore.js';
import {importNetwork,networkView} from '../lib/networkInventory.js';
export const networkRoutes=Router();
let pending=Promise.resolve();
networkRoutes.get('/',async(_req,res)=>{try{res.json(networkView(await getNamespace('_networkInventory')));}catch{res.status(503).json({error:'Nettverksoversikten kunne ikke leses'});}});
networkRoutes.post('/inventory',async(req,res)=>{
 if(req.user?.role!=='admin')return res.status(403).json({error:'Administrator kreves'});
 try{importNetwork(null,req.body);}catch(e){return res.status(400).json({error:e.message});}
 const task=pending.catch(()=>{}).then(async()=>{const next=importNetwork(await getNamespace('_networkInventory'),req.body);await setNamespace('_networkInventory',next);return networkView(next);});pending=task;
 try{res.json(await task);}catch{res.status(503).json({error:'Listen kunne ikke lagres'});}
});
