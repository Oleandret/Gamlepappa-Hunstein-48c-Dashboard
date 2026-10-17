import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {normalizePrices,priceUrl,createPriceArchive} from '../lib/spotPrices.js';
function day(start,count,minutes=60){return Array.from({length:count},(_,i)=>({NOK_per_kWh:i%2?0.3:-0.5,time_start:new Date(Date.parse(start)+i*minutes*60000).toISOString(),time_end:new Date(Date.parse(start)+(i+1)*minutes*60000).toISOString()}));}
test('spot intervals preserve negatives, 23/25-hour Oslo DST days and quarter hours',()=>{
 for(const [date,start,count,minutes]of [['2026-03-29','2026-03-28T23:00:00Z',23,60],['2026-10-25','2026-10-24T22:00:00Z',25,60],['2026-10-17','2026-10-16T22:00:00Z',96,15]]){
  const raw=day(start,count,minutes),r=normalizePrices(raw,{date,area:'NO2'});assert.equal(r.complete,true);assert.equal(r.intervals.length,count);assert.equal(r.intervals[0].value,-.5);assert.equal(r.publishedAt,null);
  raw.splice(2,1);assert.equal(normalizePrices(raw,{date,area:'NO2'}).complete,false);
 }
 assert.throws(()=>priceUrl('2021-11-30','NO1'));assert.throws(()=>priceUrl('2026-10-17','unknown'));
 assert.throws(()=>normalizePrices([{NOK_per_kWh:1,time_start:'2026-10-17T00:00:00',time_end:'2026-10-17T01:00:00'}],{date:'2026-10-17',area:'NO1'}));
});
test('archive survives recreation, deduplicates and retains changed price revision',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'prices-'));const now=()=>Date.parse('2026-10-17T12:00:00Z');const options={dir,now,minFreeBytes:0};
 try{const r=normalizePrices(day('2026-10-16T22:00:00Z',24),{date:'2026-10-17',area:'NO2'});const a=createPriceArchive(options);assert.equal((await a.save(r)).changed,true);assert.equal((await createPriceArchive(options).save(r)).changed,false);r.intervals[0].value=-1;await a.save(r);const names=await fs.readdir(dir);assert.equal(names.length,2);for(const n of names){const file=path.join(dir,n);assert.equal((await fs.stat(file)).mode&511,384);assert.equal(JSON.parse(await fs.readFile(file)).area,'NO2');}}finally{await fs.rm(dir,{recursive:true,force:true});}
});
import {createPriceLogger} from '../workers/priceLogger.js';
test('unverified area makes zero requests; 429 backs off and concurrent runs share work',async()=>{
 let calls=0,t=Date.parse('2026-10-17T12:00:00Z');const no=createPriceLogger({binding:async()=>null,archive:{},fetchImpl:async()=>{calls++;},now:()=>t});await no.run();assert.equal(calls,0);
 const l=createPriceLogger({binding:async()=>({site:'hunstein',area:'NO2',deviceId:'mock',evidence:'mock-test-only',verifiedAt:t}),archive:{save:async()=>({changed:true})},now:()=>t,fetchImpl:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'7200'}});}});
 await Promise.all([l.run(),l.run()]);assert.equal(calls,1);await l.run();assert.equal(calls,1);assert.equal(l.state.retryAt,t+7200000);
});
