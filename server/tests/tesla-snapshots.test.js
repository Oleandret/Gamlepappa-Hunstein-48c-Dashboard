import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createTeslaSnapshots} from '../lib/teslaSnapshots.js';
const devices = battery => ({car:{id:'car',name:'Tesla Model X',class:'car',driverUri:'homey:app:com.tesla',settings:{secret:'must not persist'},capabilitiesObj:{measure_battery:{value:battery,lastUpdated:'2026-10-17T12:00:00Z'}}},lamp:{id:'lamp',name:'Lamp',capabilitiesObj:{onoff:{value:true}}}});
test('app load, refresh, interval and tab reads never update Tesla snapshot or contact vehicle',async()=>{
 let saved, writes=0,t=1000;const cache=createTeslaSnapshots({load:async()=>saved,save:async v=>{saved=v;writes++;},now:()=>t});
 for(const event of ['load','refresh','interval','tab']) {const projected=await cache.project(devices(50));assert.deepEqual(projected.car.capabilitiesObj,{},event);assert.equal(projected.lamp.capabilitiesObj.onoff.value,true);}
 assert.equal(writes,0);
 const [a,b]=await Promise.all([cache.update('car'),cache.update('car')]);assert.equal(writes,1);assert.equal(a.savedAt,b.savedAt);assert.equal(a.device.settings,undefined);
 t+=1000;for(let i=0;i<4;i++){const p=await cache.project(devices(80));assert.equal(p.car.capabilitiesObj.measure_battery.value,50);}
 await cache.update('car');assert.equal(writes,1);
 t+=300000;const c=await cache.update('car');assert.equal(c.device.capabilitiesObj.measure_battery.value,80);assert.equal(writes,2);
 const restarted=createTeslaSnapshots({load:async()=>saved,save:async()=>assert.fail('unexpected write')});assert.equal((await restarted.project(devices(90))).car.capabilitiesObj.measure_battery.value,80);
 await assert.rejects(cache.update('__proto__'),{status:409});
});
test('Tesla manual component has no effect or timer driven requests; route uses only snapshot cache',()=>{
 const ui=fs.readFileSync(new URL('../../client/src/components/special/TeslaCard.jsx',import.meta.url),'utf8');assert.doesNotMatch(ui,/useEffect|setInterval|setTimeout/);assert.match(ui,/onClick=\{refresh\}/);
 const module=fs.readFileSync(new URL('../lib/teslaSnapshots.js',import.meta.url),'utf8');assert.doesNotMatch(module,/fetch\(|https?:|wake_up/);
 const source=fs.readFileSync(new URL('../lib/homeyClient.js',import.meta.url),'utf8');assert.match(source,/teslaSnapshots.project\(devices\)/);assert.match(source,/updateTeslaSnapshot: async id => \{ const result=await teslaSnapshots.update\(id\)/);
});
