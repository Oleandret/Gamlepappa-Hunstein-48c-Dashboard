import { Router } from 'express';
import { homeyClient } from '../lib/homeyClient.js';
import { isEnabled, query } from '../lib/db.js';
import { getNamespace, setNamespace } from '../lib/configStore.js';
import { roomOverview, houseBrief, energyDetective, learnedRoutines, simulate, safeSceneActions } from '../lib/experience.js';
import { capValue, validateCapability } from '../lib/validation.js';
import { recordAction } from '../lib/audit.js';
import { isDemoMode } from '../config.js';
export const experienceRoutes=Router();
const sceneIds=['film','middag','natt','borte'];
const sceneRunning=new Set();
const wrap=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(err){next(err);}};
async function history(limit=5000) {
  if(!isEnabled()) return [];
  return (await query(`SELECT id,ts,device_id,device_name,zone,capability,value,prev_value,kind FROM device_events WHERE ts>NOW()-INTERVAL '30 days' ORDER BY ts DESC LIMIT $1`,[limit])).rows;
}
experienceRoutes.get('/overview',wrap(async(req,res)=>{
  let devices={},zones={},quality='unavailable';
  try {if(!isDemoMode()) { [devices,zones]=await Promise.all([homeyClient.listDevices(),homeyClient.listZones()]);quality='live'; }} catch { /* explicit unavailable */ }
  const updatedAt=quality==='live'?new Date().toISOString():null;
  const rooms=roomOverview(devices,zones,quality,updatedAt);
  const events=await history();
  res.json({quality,updatedAt,rooms,brief:houseBrief(rooms,quality),energy:energyDetective(devices),routines:learnedRoutines(events),historyLimited:events.length===5000,historyAvailable:isEnabled()});
}));
experienceRoutes.get('/timeline',wrap(async(req,res)=>{
  if(!isEnabled()) return res.json({items:[],available:false});
  const [events,actions,runs]=await Promise.all([history(100),query('SELECT id,ts,kind,detail,status,actor FROM dashboard_actions ORDER BY ts DESC LIMIT 100'),query('SELECT id,run_at AS ts,flow_id,trigger_event,actions_result,ok FROM auto_flow_runs ORDER BY run_at DESC LIMIT 100')]);
  res.json({available:true,items:[...runs.rows.map(r=>({...r,id:`flow-${r.id}`,type:'action',status:r.ok?'accepted':'failed',explanation:`Automasjon ${r.flow_id}: trigger ${r.trigger_event?.capability || 'ukjent'}. ${r.ok?'Handlinger mottatt av Homey; fysisk sluttresultat er ikke verifisert.':'En eller flere handlinger feilet.'}`})),...events.map(e=>({...e,id:`event-${e.id}`,type:'observation',explanation:'Observert ved polling; årsak er ukjent.'})),...actions.rows.map(a=>({...a,id:`action-${a.id}`,type:'action',explanation:`${a.actor}: ${a.kind} — ${a.status}`}))].sort((a,b)=>Date.parse(b.ts)-Date.parse(a.ts)).slice(0,150)});
}));
experienceRoutes.get('/simulate/:id',wrap(async(req,res)=>{
  if(!isEnabled()) return res.status(503).json({error:'Historikkdatabase mangler'});
  if(!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Ugyldig ID'});
  const {rows}=await query('SELECT trigger,actions,min_interval_seconds FROM auto_flows WHERE id=$1',[req.params.id]);
  if(!rows[0]) return res.status(404).json({error:'Flow finnes ikke'});
  const events=await history();res.json({...simulate(rows[0],events),historyLimited:events.length===5000});
}));
experienceRoutes.get('/scenes',wrap(async(req,res)=>res.json({scenes:await getNamespace('scenes') || {}})));
experienceRoutes.put('/scenes/:id',wrap(async(req,res)=>{
  if(!sceneIds.includes(req.params.id)) return res.status(400).json({error:'Ukjent stemning'});
  const devices=await homeyClient.listDevices();
  const actions=safeSceneActions(req.body.actions,devices);
  actions.forEach(a=>validateCapability(devices,a.deviceId,a.capability,a.value));
  const scenes=await getNamespace('scenes') || {};
  await setNamespace('scenes',{...scenes,[req.params.id]:{actions}});res.json({ok:true});
}));
experienceRoutes.post('/scenes/:id/run',wrap(async(req,res)=>{
  if(isDemoMode() || !isEnabled()) return res.status(503).json({error:'Krever live-data og historikkdatabase'});
  const scene=(await getNamespace('scenes'))?.[req.params.id];
  if(!scene) return res.status(404).json({error:'Velg lys og lagre stemningen først'});
  if(sceneRunning.size) return res.status(409).json({error:'En stemning behandles allerede'});
  sceneRunning.add(req.params.id);
  try {
    const devices=await homeyClient.refreshDevices();safeSceneActions(scene.actions,devices);
    const actions=scene.actions.map(a=>{validateCapability(devices,a.deviceId,a.capability,a.value);return {...a,before:capValue(devices[a.deviceId],a.capability)};});
    const id=await recordAction('scene',{scene:req.params.id,actions},'pending',req.user.role);
    const results=[];
    for(const a of actions) {
      try{await homeyClient.setCapability(a.deviceId,a.capability,a.value);results.push({...a,accepted:true});}
      catch{results.push({...a,accepted:false});}
    }
    const latest=await homeyClient.refreshDevices().catch(()=>null);
    for(const r of results) r.confirmed=r.accepted && latest && capValue(latest[r.deviceId],r.capability)===r.value;
    const ok=results.every(r=>r.confirmed===true);
    await query('UPDATE dashboard_actions SET status=$1,detail=$2::jsonb WHERE id=$3',[ok?'confirmed':'unconfirmed',JSON.stringify({scene:req.params.id,actions:results}),id]);
    res.json({id,ok,results,undoAvailable:ok && results.every(r=>r.before!==undefined),message:ok?'Bekreftet med ny avlesning':'En eller flere handlinger er ikke bekreftet. Kontroller lysene.'});
  }finally{sceneRunning.delete(req.params.id);}
}));
experienceRoutes.post('/scenes/:id/undo',wrap(async(req,res)=>{
  if(isDemoMode() || !isEnabled()) return res.status(503).json({error:'Krever live og historikk'});
  if(!/^\d+$/.test(String(req.body.actionId))) return res.status(400).json({error:'Ugyldig handling'});
  if(sceneRunning.size) return res.status(409).json({error:'En stemning behandles allerede'});
  sceneRunning.add(req.params.id);
  try {
    const {rows}=await query(`UPDATE dashboard_actions SET status='undo_pending' WHERE id=$1 AND kind='scene' AND status='confirmed' AND ts>NOW()-INTERVAL '2 minutes' AND detail->>'scene'=$2 RETURNING detail`,[req.body.actionId,req.params.id]);
    if(!rows.length) return res.status(409).json({error:'Angre er utløpt eller handlingen er ikke bekreftet'});
    const actions=rows[0].detail.actions;
    const devices=await homeyClient.refreshDevices();safeSceneActions(actions,devices);
    // Refuse undo if a light has changed since this scene. Never reverse locks/alarms/flows.
    if(actions.some(a=>a.before===undefined || capValue(devices[a.deviceId],a.capability)!==a.value)) {
      await query("UPDATE dashboard_actions SET status='undo_refused' WHERE id=$1",[req.body.actionId]);
      return res.status(409).json({error:'Lysene er endret siden stemningen. Angre er stoppet.'});
    }
    const results=[];
    for(const a of [...actions].reverse()) {
      try{const current = await homeyClient.refreshDevices(); if(capValue(current[a.deviceId],a.capability)!==a.value) throw new Error('Changed'); await homeyClient.setCapability(a.deviceId,a.capability,a.before);results.push({...a,accepted:true});}
      catch{results.push({...a,accepted:false});}
    }
    const latest=await homeyClient.refreshDevices().catch(()=>null);
    const ok=results.every(a=>a.accepted && latest && capValue(latest[a.deviceId],a.capability)===a.before);
    await query('UPDATE dashboard_actions SET status=$1 WHERE id=$2',[ok?'undone':'undo_unconfirmed',req.body.actionId]);
    await recordAction('scene_undo',{original:req.body.actionId,results},ok?'confirmed':'unconfirmed',req.user.role);
    res.json({ok,results});
  } finally{sceneRunning.delete(req.params.id);}
}));
