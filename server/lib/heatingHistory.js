import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';

export function createHeatingHistory({dir,now=Date.now,retentionMs=30*86400000,maxBytes=64*1024*1024,minFreeBytes=64*1024*1024}={}) {
  let loaded=false, seen=new Map(), queue=Promise.resolve(), last=null;
  const pattern=/^sample-\d{13}-[a-f0-9]{8}\.json$/;
  async function files() {
    const names=(await fs.readdir(dir)).filter(n=>pattern.test(n)).sort();
    if(names.length>4096)throw Error('History file limit');
    return Promise.all(names.map(async name=>{const stat=await fs.lstat(path.join(dir,name));if(!stat.isFile()||stat.isSymbolicLink())throw Error('Invalid history file');return {name,size:stat.size,time:Number(name.split('-')[1])};}));
  }
  async function prepare() {
    await fs.mkdir(dir,{recursive:true,mode:0o700});
    const stat=await fs.lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&63))throw Error('History directory must be private');
    const list=await files();let total=list.reduce((n,f)=>n+f.size,0);
    for(const f of list) if(f.time<now()-retentionMs || total>maxBytes) {await fs.unlink(path.join(dir,f.name));total-=f.size;seen.clear();loaded=false;}
    if(!loaded) {
      for(const f of await files()) {if(f.size>512*1024)throw Error('History record too large');const r=JSON.parse(await fs.readFile(path.join(dir,f.name),'utf8'));for(const p of r.points||[])seen.set(`${r.deviceId}:${p.parameterId}`,JSON.stringify([p.timestamp,p.value,p.strVal,p.enumLabel]));last={recordedAt:r.recordedAt,fetchedAt:r.fetchedAt,points:r.points?.length||0};}
      loaded=true;
    }
    return total;
  }
  function append(sample, identity) {
    const task=queue.catch(()=>{}).then(async()=>{
      if(!identity?.deviceId)return null;
      let total=await prepare();
      const disk=await fs.statfs(dir);if(disk.bavail*disk.bsize<minFreeBytes)throw Error('Low disk space');
      const points=[],updates=[];
      for(const p of (sample.status==='ok'?sample.points||[]:[]).slice(0,1000)) {
        const key=`${identity.deviceId}:${p.parameterId}`, stamp=JSON.stringify([p.timestamp,p.value,p.strVal,p.enumLabel]);
        if(seen.get(key)===stamp)continue;
        const item={};for(const k of ['parameterId','parameterName','parameterUnit','timestamp','value','strVal','category','enumLabel'])if(['string','number','boolean'].includes(typeof p[k])||p[k]===null)item[k]=typeof p[k]==='string'?p[k].slice(0,1000):p[k];
        const age=now()-Date.parse(p.timestamp);item.quality=p.value==null?'missing':!Number.isFinite(age)?'unknown-time':age<0||age>900000?'stale':'measured';
        points.push(item);updates.push([key,stamp]);
      }
      const r={version:1,recordedAt:now(),fetchedAt:sample.fetchedAt||null,deviceId:identity.deviceId,systemId:identity.systemId,status:sample.status,alarms:{available:sample.alarms?.available===true,count:sample.alarms?.count??null},points};
      const body=JSON.stringify(r);const bytes=Buffer.byteLength(body);if(bytes>512*1024)throw Error('History record too large');
      for(const f of await files()) {if(total+bytes<=maxBytes)break;await fs.unlink(path.join(dir,f.name));total-=f.size;}
      const name=`sample-${now()}-${randomBytes(4).toString('hex')}.json`, tmp=path.join(dir,`.${name}.tmp`),dest=path.join(dir,name);
      try {const fd=await fs.open(tmp,'wx',0o600);try{await fd.writeFile(body);await fd.sync();}finally{await fd.close();}await fs.rename(tmp,dest);const fdDir=await fs.open(dir,'r');try{await fdDir.sync();}finally{await fdDir.close();}}
      finally{await fs.unlink(tmp).catch(()=>{});}
      updates.forEach(([k,v])=>seen.set(k,v));last={recordedAt:r.recordedAt,fetchedAt:r.fetchedAt,points:points.length};return last;
    });queue=task;return task;
  }
  return {append,status:()=>last};
}
