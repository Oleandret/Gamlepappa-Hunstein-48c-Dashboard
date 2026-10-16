import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture({failFirstWrite=false}={}) {
  let power=12, fail=failFirstWrite;
  const writes=[], actions=[];
  const sourceTime=new Date(Date.now()-1000).toISOString();
  const context=vm.createContext({structuredClone,process:{env:{}},console:{log(){},warn(){},error(){}},
    isEnabled:()=>true,isDemoMode:()=>false,
    homeyClient:{listZones:async()=>({}),listDevices:async()=>({sensor:{id:'sensor',capabilitiesObj:{
      measure_temperature:{value:21,lastUpdated:sourceTime},measure_power:{value:power,lastUpdated:'invalid'},measure_battery:{value:90}
    }}})},
    query:async(sql,params)=>{if(fail){fail=false;throw new Error('fixture disk failure');}writes.push(params);return{rows:[]};},
    onDeviceChanges:async changes=>{actions.push(...changes);return{fired:0};},
    setTimeout:()=>0,setInterval:()=>0,clearInterval(){},clearTimeout(){}
  });
  const source=fs.readFileSync(new URL('../workers/devicePoller.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,'');
  vm.runInContext(source+'\nglobalThis.poll=triggerPollNow;',context);
  return {poll:context.poll,writes,actions,sourceTime,setPower:value=>{power=value;}};
}

test('sensor baseline persists snapshots with correct capability timestamps and no actions',async()=>{
  const f=fixture();const first=await f.poll();
  assert.equal(first.ok,true,first.error);assert.equal(first.snapshots,3);assert.equal(first.transitions,0);assert.equal(first.firedFlows,0);assert.equal(f.actions.length,0);
  const rows=[];for(let i=0;i<f.writes[0].length;i+=14)rows.push(f.writes[0].slice(i,i+14));
  const temp=rows.find(r=>r[4]==='measure_temperature');assert.equal(temp[11],f.sourceTime);assert.equal(temp[13],'device');
  for(const cap of ['measure_power','measure_battery']){const row=rows.find(r=>r[4]===cap);assert.equal(row[13],'poll');assert.ok(Number.isFinite(Date.parse(row[11])));}
  const unchanged=await f.poll();assert.equal(unchanged.ok,true);assert.equal(unchanged.snapshots,0);assert.equal(unchanged.transitions,0);assert.equal(f.actions.length,0);
  f.setPower(20);const changed=await f.poll();assert.equal(changed.ok,true);assert.equal(changed.transitions,1);assert.equal(f.actions.length,1);assert.equal(f.actions[0].prev,12);assert.equal(f.actions[0].next,20);
});

test('failed initial snapshot retries as baseline without replaying device actions',async()=>{
  const f=fixture({failFirstWrite:true});const failed=await f.poll();assert.equal(failed.ok,false);assert.equal(failed.error,'fixture disk failure');assert.equal(f.actions.length,0);
  const retried=await f.poll();assert.equal(retried.ok,true,retried.error);assert.equal(retried.snapshots,3);assert.equal(retried.transitions,0);assert.equal(retried.firedFlows,0);assert.equal(f.actions.length,0);
});
