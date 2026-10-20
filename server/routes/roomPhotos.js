import {Router,raw} from 'express';import path from 'node:path';import {configPath} from '../lib/configStore.js';import {homeyClient} from '../lib/homeyClient.js';import {createRoomPhotos} from '../lib/roomPhotos.js';
export function createRoomPhotoRoutes({store=createRoomPhotos(path.join(path.dirname(configPath()),'room-photos')),zones=()=>homeyClient.listZones()}={}){
 const r=Router();
 r.get('/index',async(_req,res)=>{try{const byZone=await store.index();let names={};try{names=await zones();}catch{}res.json({rooms:Object.entries(byZone).map(([zoneId,photos])=>({zoneId,zoneName:names?.[zoneId]?.name||null,photos}))});}catch{res.status(503).json({error:'Bildene kunne ikke leses'});}});
 r.get('/rooms/:zoneId',async(req,res)=>{try{res.json({photos:await store.list(req.params.zoneId),analysisAvailable:false});}catch{res.status(503).json({error:'Bildene kunne ikke leses'});}});
 r.get('/images/:id',async(req,res)=>{try{const data=await store.read(req.params.id);res.set({'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Cache-Control':'no-store'}).send(data);}catch{res.status(404).json({error:'Bildet finnes ikke'});}});
 r.post('/rooms/:zoneId',raw({type:['image/jpeg','image/png','image/webp'],limit:'25mb'}),async(req,res)=>{try{if(!(await zones())[req.params.zoneId])return res.status(400).json({error:'Rommet må finnes i Homey'});res.status(201).json(await store.upload(req.params.zoneId,req.body,req.get('content-type')?.split(';')[0]));}catch{res.status(400).json({error:'Opplasting avvist. Bruk JPEG/PNG/WebP under 25 MB og 120 megapiksler, maks 20 bilder per rom. Kontroller datatilgang og lagringsplass.'});}});
 r.patch('/images/:id',async(req,res)=>{try{res.json(await store.update(req.params.id,req.body));}catch{res.status(400).json({error:'Beskrivelsen kunne ikke lagres'});}});
 return r;
}
export const roomPhotoRoutes=createRoomPhotoRoutes();
