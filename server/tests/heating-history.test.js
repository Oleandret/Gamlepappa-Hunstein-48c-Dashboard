import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHeatingHistory} from '../lib/heatingHistory.js';
test('persistent history deduplicates across restart, separates source/fetch times and excludes secrets',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'heating-history-'));let t=1792269000000;
 const opts={dir,now:()=>t,minFreeBytes:0};let h=createHeatingHistory(opts);
 const id={deviceId:'pump',systemId:'system',accessToken:'NEVER'};
 const sample={status:'ok',fetchedAt:t,accessToken:'NEVER',alarms:{available:true,count:0},points:[{parameterId:'1',parameterName:'Temperature',value:40,timestamp:new Date(t-60000).toISOString(),accessToken:'NEVER'}]};
 try {
  await Promise.all([h.append(sample,id),h.append(sample,id)]);
  h=createHeatingHistory(opts);t+=1000;assert.equal((await h.append(sample,id)).points,0);
  const names=await fs.readdir(dir);const rows=await Promise.all(names.map(async n=>JSON.parse(await fs.readFile(path.join(dir,n),'utf8'))));
  assert.equal(rows.flatMap(x=>x.points).length,1);assert.equal(rows[0].fetchedAt,sample.fetchedAt);assert.equal(rows.flatMap(x=>x.points)[0].timestamp,sample.points[0].timestamp);assert.doesNotMatch(JSON.stringify(rows),/NEVER|accessToken/);
  for(const n of names)assert.equal((await fs.stat(path.join(dir,n))).mode&511,384);
  t+=31*86400000;await h.append({...sample,status:'unavailable'},id);assert.equal((await fs.readdir(dir)).length,1);
  const low=createHeatingHistory({...opts,minFreeBytes:Number.MAX_SAFE_INTEGER});await assert.rejects(low.append(sample,id),/Low disk/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
