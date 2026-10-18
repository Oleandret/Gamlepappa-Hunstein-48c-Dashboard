import fs from 'node:fs/promises';
const MAX_BYTES=1024*1024;
const stamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s))?s:null;
const text=(s,max=120)=>typeof s==='string'?s.replace(/[\u0000-\u001f]/g,'').slice(0,max):null;
const count=n=>Number.isInteger(n)&&n>=0?n:null;
const id=s=>typeof s==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(s)?s:null;
const privateIp=s=>typeof s==='string'&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(s)&&s.split('.').length===4&&s.split('.').every(p=>/^\d{1,3}$/.test(p)&&+p<=255)?s:null;
export function normalizeNetworkSnapshot(raw) {
 if(raw?.schema_version!==1||raw?.source!=='hjemmenett-monitor'||!stamp(raw.observed_at)||!Array.isArray(raw.devices)||raw.devices.length>2048)throw Error('Invalid network snapshot');
 const seen=new Set();
 const devices=raw.devices.map(d=>{
  if(!id(d.id)||seen.has(d.id))throw Error('Invalid device identity');seen.add(d.id);
  return {id:d.id,label:text(d.label)||'Ukjent enhet',last_seen:stamp(d.last_seen),status:['observed','stale','unknown'].includes(d.status)?d.status:'unknown',source:['neighbor-cache','deco','manual'].includes(d.source)?d.source:'unknown',ip:privateIp(d.ip),mac:typeof d.mac==='string'&&/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(d.mac)?d.mac:null,manufacturer:text(d.manufacturer)};
 });
 return {schema_version:1,snapshot_id:id(raw.snapshot_id),source:raw.source,observed_at:stamp(raw.observed_at),received_at:stamp(raw.received_at),collector:{status:['ok','stale','unknown'].includes(raw.collector?.status)?raw.collector.status:'unknown',last_seen:stamp(raw.collector?.last_seen)},devices,
 links:(Array.isArray(raw.links)?raw.links:[]).slice(0,4096).filter(l=>seen.has(l.source_id)&&seen.has(l.target_id)&&l.source_id!==l.target_id&&stamp(l.observed_at)&&text(l.source)).map(l=>({source_id:l.source_id,target_id:l.target_id,source:text(l.source),observed_at:stamp(l.observed_at)})),
 events:(Array.isArray(raw.events)?raw.events:[]).slice(-500).filter(e=>stamp(e.at)&&seen.has(e.device_id)&&['observed','stale','unknown','new-device','address-changed','returned','first_in_snapshot_window'].includes(e.type)).map(e=>({id:id(e.id),type:e.type,at:stamp(e.at),device_id:e.device_id})),
 history:(Array.isArray(raw.history)?raw.history:[]).slice(-1440).filter(p=>stamp(p.at)&&count(p.observed_devices)!==null).map(p=>({at:stamp(p.at),observed_devices:p.observed_devices})),presence:[]};
}
export async function readNetworkSnapshot(file=process.env.NETWORK_SNAPSHOT_FILE, now=Date.now()) {
 if(process.env.DEMO_MODE==='true')return {connected:false,reason:'demo-isolation',snapshot:null};
 if(!file)return {connected:false,reason:'not-configured',snapshot:null};
 try {const stat=await fs.stat(file);if(!stat.isFile()||stat.size>MAX_BYTES)throw Error('Invalid snapshot size');const raw=await fs.readFile(file,'utf8');if(Buffer.byteLength(raw)>MAX_BYTES)throw Error('Invalid snapshot size');const snapshot=normalizeNetworkSnapshot(JSON.parse(raw));if(now-Date.parse(snapshot.observed_at)>7*24*60*60*1000)return {connected:false,reason:'expired',snapshot:null};return {connected:true,snapshot};}
 catch{return {connected:false,reason:'unavailable',snapshot:null};}
}
