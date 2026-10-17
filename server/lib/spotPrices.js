import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
export const SOURCE='https://www.hvakosterstrommen.no';
export const localDate=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
export function priceUrl(date,area) {
 if(typeof date!=='string'||typeof area!=='string'||!/^NO[1-5]$/.test(area)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<'2021-12-01'||new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date)throw Error('Invalid price request');
 return `${SOURCE}/api/v1/prices/${date.slice(0,4)}/${date.slice(5)}_${area}.json`;
}
export function normalizePrices(raw,{date,area,fetchedAt=Date.now()}) {
 priceUrl(date,area);
 if(!Array.isArray(raw)||raw.length>100)throw Error('Invalid price response');
 const intervals=raw.map(p=>{
  if(typeof p.NOK_per_kWh!=='number'||!Number.isFinite(p.NOK_per_kWh)||!/(Z|[+-]\d{2}:\d{2})$/.test(p.time_start)||!/(Z|[+-]\d{2}:\d{2})$/.test(p.time_end))throw Error('Invalid price interval');
  const start=Date.parse(p.time_start),end=Date.parse(p.time_end),minutes=(end-start)/60000;
  if(![15,60].includes(minutes)||localDate(start)!==date||localDate(end-1)!==date)throw Error('Invalid price duration');
  return {start,end,minutes,value:p.NOK_per_kWh};
 }).sort((a,b)=>a.start-b.start);
 for(let i=1;i<intervals.length;i++)if(intervals[i].start<intervals[i-1].end)throw Error('Overlapping prices');
 const gaps=[];
 for(let i=1;i<intervals.length;i++)if(intervals[i].start!==intervals[i-1].end)gaps.push({start:intervals[i-1].end,end:intervals[i].start});
 const first=intervals[0],last=intervals.at(-1);
 const complete=!!first&&localDate(first.start-1)!==date&&localDate(last.end)!==date&&!gaps.length;
 return {version:1,area,date,currency:'NOK',unit:'NOK/kWh',timeZone:'Europe/Oslo',source:SOURCE,publishedAt:null,publicationTimeKnown:false,fetchedAt,vatIncluded:false,gridFeesIncluded:false,taxesIncluded:false,subsidyIncluded:false,kind:'published-spot',complete,gaps,intervals};
}
// Immutable revisions: unchanged responses do not produce duplicate files.
export function createPriceArchive({dir,now=Date.now,maxBytes=64*1024*1024,minFreeBytes=64*1024*1024,retentionDays=730}) {
 let queue=Promise.resolve();
 async function save(record){
  const task=queue.catch(()=>{}).then(async()=>{
   await fs.mkdir(dir,{recursive:true,mode:0o700});const st=await fs.lstat(dir);
   if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&63))throw Error('Private archive required');
   const disk=await fs.statfs(dir);if(disk.bavail*disk.bsize<minFreeBytes)throw Error('Low disk space');
   const hash=createHash('sha256').update(JSON.stringify(record.intervals)).digest('hex').slice(0,24);
   const prior=(await fs.readdir(dir)).filter(n=>new RegExp(`^${record.date}_${record.area}_(?:[0-9]{13}_)?[a-f0-9]{24}\\.json$`).test(n));
   let latest=null;
   for(const n of prior){const file=path.join(dir,n),st=await fs.lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.size>65536)throw Error('Invalid archive record');const r=JSON.parse(await fs.readFile(file,'utf8'));if(!latest||r.firstObservedAt>latest.record.firstObservedAt)latest={name:n,record:r};}
   if(latest?.record.revision===hash)return {changed:false,file:latest.name,firstObservedAt:latest.record.firstObservedAt};
   const observedAt=Math.max(now(),(latest?.record.firstObservedAt||0)+1);
   const name=`${record.date}_${record.area}_${observedAt}_${hash}.json`;
   const body=JSON.stringify({...record,revision:hash,firstObservedAt:observedAt});if(Buffer.byteLength(body)>65536)throw Error('Oversized record');
   const names=(await fs.readdir(dir)).filter(n=>/^\d{4}-\d{2}-\d{2}_NO[1-5]_(?:[0-9]{13}_)?[a-f0-9]{24}\.json$/.test(n)).sort();
   let total=0;const files=[];
   for(const n of names){const st=await fs.lstat(path.join(dir,n));if(!st.isFile()||st.isSymbolicLink())throw Error('Invalid archive file');total+=st.size;files.push({n,size:st.size});}
   for(const f of files)if(f.n.slice(0,10)<localDate(now()-retentionDays*86400000)||total+Buffer.byteLength(body)>maxBytes){await fs.unlink(path.join(dir,f.n));total-=f.size;}
   if(Buffer.byteLength(body)>maxBytes)throw Error('Archive limit');
   const tmp=path.join(dir,`.${randomBytes(8).toString('hex')}.tmp`);
   try{const f=await fs.open(tmp,'wx',0o600);try{await f.writeFile(body);await f.sync();}finally{await f.close();}await fs.rename(tmp,path.join(dir,name));}finally{await fs.unlink(tmp).catch(()=>{});}
   return {changed:true,file:name,firstObservedAt:observedAt};
  });queue=task;return task;
 }
 return {save};
}
