import {createInventoryReader} from '../lib/inventoryReader.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { authenticate, accessControl } from '../lib/auth.js';
import { validateCapability, validateFlow, validateMessages } from '../lib/validation.js';
import { cachedReader } from '../lib/readCache.js';
import { readRpcResponse } from '../lib/mcpClient.js';
import { roomOverview, houseBrief, energyDetective, learnedRoutines, simulate, safeSceneActions } from '../lib/experience.js';
// Every external dependency in worker/executor tests is an injected stub. No production imports.
function sandbox(file, globals, names) {
  const src=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,'');
  const ctx=vm.createContext({console:{log(){},warn(){},error(){}},structuredClone, ...globals});
  vm.runInContext(src+'\nglobalThis.result={'+names+'}',ctx);return ctx.result;
}
const tick=()=>new Promise(r=>setImmediate(r));
const devices={lamp:{id:'lamp',name:'Lampe',zone:'room',class:'light',capabilitiesObj:{onoff:{value:true,type:'boolean',setable:true},dim:{value:.5,type:'number',min:0,max:1,setable:true},measure_power:{value:12,type:'number',setable:false}}}};
test('auth fails closed and roles cannot be supplied by caller',()=>{
 const config=JSON.stringify({viewer:'fixture-only-not-a-real-secret'});
 assert.equal(authenticate('Bearer fixture-only-not-a-real-secret',config),'viewer');
 assert.equal(authenticate('Bearer incorrect',config),null);assert.equal(authenticate('',null),null);
});
test('viewer cannot mutate and operator cannot administer',()=>{
 const old=process.env.AUTH_TOKENS_JSON, demo=process.env.DEMO_MODE;
 process.env.AUTH_TOKENS_JSON=JSON.stringify({viewer:'fixture-viewer-not-a-real-secret',operator:'fixture-operator-not-a-real-secret'});process.env.DEMO_MODE='false';
 try {for(const [role,url] of [['viewer','/homey/devices/x'],['operator','/config/pinConfig']]){
 let status;accessControl({headers:{authorization:`Bearer fixture-${role}-not-a-real-secret`},ip:'test',path:url,method:'PUT'},{status(n){status=n;return this;},json(){}},()=>assert.fail('must deny'));assert.equal(status,403);
 }}finally{if(old===undefined)delete process.env.AUTH_TOKENS_JSON;else process.env.AUTH_TOKENS_JSON=old;if(demo===undefined)delete process.env.DEMO_MODE;else process.env.DEMO_MODE=demo;}
});
test('capability validation rejects impossible values and sensor writes',()=>{
 assert.doesNotThrow(()=>validateCapability(devices,'lamp','dim',.1));
 for(const [cap,v] of [['dim',10],['dim','0.1'],['onoff',1],['measure_power',5]])assert.throws(()=>validateCapability(devices,'lamp',cap,v));
 assert.throws(()=>validateCapability(devices,'missing','dim',.1));
});
test('flow validation rejects invented device and unknown trigger',()=>{
 const flow={trigger:{type:'device_change',deviceId:'lamp',capability:'onoff',condition:'becomes_true'},actions:[{type:'set_capability',deviceId:'lamp',capability:'dim',value:.2}]};
 assert.equal(validateFlow(flow,devices),flow);
 assert.throws(()=>validateFlow({...flow,actions:[{type:'set_capability',deviceId:'unknown',capability:'dim',value:.2}]},devices));
});
test('privileged and tool conversation roles are rejected',()=>{
 for(const role of ['system','developer','tool'])assert.throws(()=>validateMessages([{role,content:'x'}]));
 assert.deepEqual(validateMessages([{role:'user',content:'hello',tool_calls:[{}]}]),[{role:'user',content:'hello'}]);
});
test('concurrent config writes survive reload; corrupt config is preserved',async()=>{
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'dashboard-test-'));const file=path.join(dir,'config.json');
 try {
 const store=sandbox('lib/configStore.js',{process:{env:{CONFIG_PATH:file},cwd:()=>dir},fsp,path},'getAll,setNamespace');
 await Promise.all(Array.from({length:25},(_,i)=>store.setNamespace('key'+i,i)));
 const disk=JSON.parse(await fsp.readFile(file,'utf8'));assert.equal(Object.keys(disk).length,25);assert.equal(disk.key24,24);
 await fsp.writeFile(file,'{broken');
 const broken=sandbox('lib/configStore.js',{process:{env:{CONFIG_PATH:file},cwd:()=>dir},fsp,path},'setNamespace');
 await assert.rejects(broken.setNamespace('a',1));assert.equal(await fsp.readFile(file,'utf8'),'{broken');
 }finally{await fsp.rm(dir,{recursive:true,force:true});}
});
test('first user edit after hydration is saved',async()=>{
 const effects=[],timers=[];let writes=0;
 const hook=sandbox('../client/src/lib/useServerSyncedState.js',{
 useCallback:f=>f,useEffect:f=>effects.push(f),useRef:x=>({current:x}),useState:initial=>{let v=typeof initial==='function'?initial():initial;return[v,n=>{v=typeof n==='function'?n(v):n;}];},
 api:{config:{get:async()=>({value:['stored']}),put:async()=>writes++}},localStorage:{getItem:()=>null,setItem(){}},window:{addEventListener(){},removeEventListener(){}},AbortController,setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){}
 },'useServerSyncedState');
 const [,set]=hook.useServerSyncedState('links',[]);effects.forEach(f=>f());await tick();set(['edit']);assert.equal(timers.length,1);timers[0]();await tick();assert.equal(writes,1);
});
test('poller establishes baseline, coalesces concurrent polls, then emits changes',async()=>{
 let state=true,reads=0,changes=[];
 const poller=sandbox('workers/devicePoller.js',{
 process:{env:{}},isEnabled:()=>true,isDemoMode:()=>false,
 homeyClient:{listDevices:async()=>{reads++;return{lamp:{id:'lamp',capabilitiesObj:{onoff:{value:state}}}};},listZones:async()=>({})},query:async()=>({rows:[]}),onDeviceChanges:async c=>{changes.push(...c);return{fired:0};},setTimeout:()=>0,setInterval:()=>0,clearInterval(){},clearTimeout(){}
 },'triggerPollNow');
 await Promise.all([poller.triggerPollNow(),poller.triggerPollNow()]);assert.equal(reads,1);assert.equal(changes.length,0);
 state=false;await poller.triggerPollNow();assert.equal(changes.length,1);assert.equal(changes[0].prev,true);
});
test('executor reserves cooldown atomically before device call and skips baseline',async()=>{
 let called=0,claimed=false;
 const flow={id:1,trigger:{type:'device_change',deviceId:'lamp',capability:'onoff',condition:'becomes_true'},actions:[{type:'set_capability',deviceId:'lamp',capability:'dim',value:.2}],min_interval_seconds:3600};
 const client={query:async sql=>{if(sql.includes('try_advisory'))return{rows:[{locked:true}]};if(sql.includes('RETURNING id')){if(claimed)return{rows:[]};claimed=true;return{rows:[{id:1}]};}return{rows:[]};},release(){}};
 const executor=sandbox('lib/autoFlowExecutor.js',{isEnabled:()=>true,isDemoMode:()=>false,homeyClient:{setCapabilityValue:async()=>{assert.equal(claimed,true);called++;}},getPool:()=>({connect:async()=>client}),query:async sql=>({rows:sql.includes('SELECT')?[flow]:[]})},'onDeviceChanges');
 await executor.onDeviceChanges([{deviceId:'lamp',capability:'onoff',prev:undefined,next:true}]);assert.equal(called,0);
 const change={deviceId:'lamp',capability:'onoff',prev:false,next:true};await executor.onDeviceChanges([change]);await executor.onDeviceChanges([change]);assert.equal(called,1);
});
test('cache shares in-flight reads and invalidates',async()=>{let calls=0;const read=cachedReader(async()=>++calls);assert.deepEqual(await Promise.all([read(),read()]),[1,1]);read.invalidate();assert.equal(await read(),2);});
test('MCP reads matching SSE message without waiting for stream close',async()=>{
 let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"jsonrpc":"2.0","id":9,"result":{}}\n\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n'));},cancel(){cancelled=true;}});
 assert.deepEqual(await readRpcResponse(new Response(body,{headers:{'content-type':'text/event-stream'}}),1),{ok:true});assert.equal(cancelled,true);
});
test('MCP rejects wrong response id',async()=>{await assert.rejects(readRpcResponse(new Response('{"jsonrpc":"2.0","id":2,"result":{}}'),1));});
test('room/brief/energy contain only measured facts and do not sum overlapping meters',()=>{
 const rooms=roomOverview(devices,{room:{id:'room',name:'Stue'}});assert.equal(rooms[0].lightsOn,1);assert.deepEqual(rooms[0].temperature,[]);
 assert.match(houseBrief(rooms,'unavailable')[0].text,/ikke fersk/);
 const energy=energyDetective(devices);assert.equal(energy.measured[0].watts,12);assert.equal(energy.estimated.length,0);assert.equal(energy.total,undefined);
});
test('routine suggestions require three distinct dates and remain disabled',()=>{
 const base={device_id:'lamp',device_name:'Lampe',capability:'onoff',kind:'transition',value:true,prev_value:false};
 const events=[1,2,3].map(n=>({...base,id:n,ts:`2026-10-0${n}T17:00:00Z`}));
 assert.equal(learnedRoutines([events[0],events[0],events[0]]).length,0);
 assert.equal(learnedRoutines(events)[0].enabled,false);
});
test('dry-run respects cooldown and has no action executor',()=>{
 const flow={trigger:{type:'device_change',deviceId:'lamp',capability:'onoff',condition:'becomes_true'},actions:[{type:'run_flow',flowId:'x'}],min_interval_seconds:60};
 const events=[0,1,61].map(n=>({id:n,device_id:'lamp',capability:'onoff',prev_value:false,value:true,ts:new Date(100000+n*1000).toISOString()}));
 const result=simulate(flow,events);assert.equal(result.count,2);assert.equal(result.executed,0);
});
test('scenes cannot include locks, duplicate capabilities or flows',()=>{
 assert.throws(()=>safeSceneActions([{deviceId:'lock',capability:'locked',value:false}],{lock:{class:'lock'}}));
 assert.throws(()=>safeSceneActions([{deviceId:'lamp',capability:'dim'},{deviceId:'lamp',capability:'dim'}],devices));
 assert.doesNotThrow(()=>safeSceneActions([{deviceId:'lamp',capability:'dim',value:.2}],devices));
});
test('Homey outage returns unavailable, then stale only after a real success',async()=>{
 const routes=new Map();const homeyClient={listDevices:async()=>devices};
 const {homeyRoutes}=sandbox('routes/homey.js',{
   createInventoryReader,Router:()=>({get:(name,handler)=>routes.set(name,handler),post(){}}),homeyClient,
   isDemoMode:()=>false,buildInventory:()=>({}),MOCK_DEVICES:{fixture:'must not leak'},MOCK_ZONES:{},MOCK_FLOWS:{},MOCK_ACTIVITY:[],mockEnergyReport:()=>({})
 },'homeyRoutes');
 const handler=routes.get('/devices');
 async function call(){let body,status=200;await handler({originalUrl:'/devices'},{status(n){status=n;return this;},json(v){body=v;}});return{body,status};}
 try{
 homeyClient.listDevices=async()=>{throw new Error('fixture outage');};let r=await call();assert.equal(r.status,503);assert.equal(r.body._quality,'unavailable');assert.equal(r.body.devices,undefined);
 homeyClient.listDevices=async()=>devices;r=await call();assert.equal(r.body._quality,'live');
 homeyClient.listDevices=async()=>{throw new Error('fixture outage');};r=await call();assert.equal(r.body._quality,'stale');assert.equal(JSON.stringify(r.body.devices),JSON.stringify(devices));
 }finally{ /* injected client only */ }
});
test('failed disk write leaves last acknowledged config intact',async()=>{
 let fail=false,disk='{}';
 const store=sandbox('lib/configStore.js',{process:{env:{CONFIG_PATH:'/virtual/config'},cwd:()=>'/virtual'},path,
 fsp:{readFile:async()=>disk,mkdir:async()=>{},writeFile:async(_p,data)=>{if(fail)throw new Error('disk full');disk=data;},rename:async()=>{}}},'setNamespace,getNamespace');
 await store.setNamespace('links',['old']);fail=true;await assert.rejects(store.setNamespace('links',['new']));assert.equal((await store.getNamespace('links'))[0],'old');
});
function sceneHarness({expired=false,changed=false}={}) {
 const routes=new Map();const current=structuredClone(devices);current.lamp.capabilitiesObj.dim.value=changed?.8:.2;
 let writes=0;const statuses=[];
 const action={deviceId:'lamp',capability:'dim',value:.2,before:.5,confirmed:true};
 sandbox('routes/experience.js',{
 createInventoryReader,Router:()=>({get(){},put(){},post:(name,handler)=>routes.set(name,handler)}),
 isDemoMode:()=>false,isEnabled:()=>true,
 query:async(sql,args)=>{
   if(sql.includes('RETURNING detail'))return{rows:expired?[]:[{detail:{actions:[action]}}]};
   statuses.push(args?.[0]);return{rows:[]};
 },getNamespace:async()=>({}),recordAction:async()=>1,
 homeyClient:{refreshDevices:async()=>structuredClone(current),setCapability:async(id,cap,value)=>{writes++;current[id].capabilitiesObj[cap].value=value;}},
 safeSceneActions,capValue:(d,c)=>d?.capabilitiesObj?.[c]?.value,validateCapability
 },'experienceRoutes');
 return {async undo(){let code=200,result;await routes.get('/scenes/:id/undo')({params:{id:'film'},body:{actionId:1},user:{role:'operator'}},{status(c){code=c;return this;},json(r){result=r;}},err=>{throw err;});return{code,result,writes,statuses};}};
}
test('expired undo cannot perform any physical write',async()=>{const r=await sceneHarness({expired:true}).undo();assert.equal(r.code,409);assert.equal(r.writes,0);});
test('changed light refuses undo without writing',async()=>{const r=await sceneHarness({changed:true}).undo();assert.equal(r.code,409);assert.equal(r.writes,0);});
test('unchanged confirmed scene restores previous value and verifies result',async()=>{const r=await sceneHarness().undo();assert.equal(r.code,200);assert.equal(r.result.ok,true);assert.equal(r.writes,1);assert.ok(r.statuses.includes('undone'));});

test('Homey device responses omit pairing secrets without changing cached originals',async()=>{
 const privateDevices={fixture:{id:'fixture',name:'Lamp',capabilities:['onoff'],capabilitiesObj:{onoff:{value:true}},data:{token:'fixture-secret'},settings:{apikey:'fixture-key'},settingsObj:true}};
 const routes=new Map();sandbox('routes/homey.js',{createInventoryReader,Router:()=>({get:(n,h)=>routes.set(n,h),post(){}}),homeyClient:{listDevices:async()=>privateDevices},isDemoMode:()=>false},'homeyRoutes');
 let body;await routes.get('/devices')({originalUrl:'/devices'},{json(v){body=v;}});
 assert.equal(body.devices.fixture.name,'Lamp');assert.equal(body.devices.fixture.capabilitiesObj.onoff.value,true);
 assert.equal(body.devices.fixture.settings,undefined);assert.equal(body.devices.fixture.data,undefined);assert.equal(body.devices.fixture.settingsObj,undefined);
 assert.equal(privateDevices.fixture.settings.apikey,'fixture-key');assert.equal(privateDevices.fixture.data.token,'fixture-secret');
});

test('poller preserves numeric and older source timestamps and rejects invalid/future times',()=>{
 const p=sandbox('workers/devicePoller.js',{process:{env:{}}},'sourceTimestamp');
 const old=Date.now()-3600000;
 assert.equal(p.sourceTimestamp(old),new Date(old).toISOString());
 assert.equal(p.sourceTimestamp(new Date(old).toISOString()),new Date(old).toISOString());
 for(const value of [null,'',true,NaN,Date.now()+60000,1700000000,'123','2026-10-17T12:00:00'])assert.equal(p.sourceTimestamp(value),null);
});
test('poller writes snapshots and transitions atomically, preserves meter source time, and retries failed batch',async()=>{
 let value=100,fail=false,writes=[];const source=Date.now()-60000;
 const p=sandbox('workers/devicePoller.js',{
 process:{env:{}},isEnabled:()=>true,isDemoMode:()=>false,
 homeyClient:{listDevices:async()=>({meter:{id:'meter',capabilitiesObj:{measure_power:{value,lastUpdated:source},meter_power:{value:value/10,lastUpdated:source}}}}),listZones:async()=>({})},
 query:async(sql,values)=>{if(fail)throw Error('Mock write failure');writes.push(values);return{rows:[]};},onDeviceChanges:async()=>({fired:0}),setTimeout:()=>0,setInterval:()=>0,clearInterval(){},clearTimeout(){}
 },'triggerPollNow');
 await p.triggerPollNow();assert.equal(writes.length,1);assert.equal(writes[0].length,28);assert.equal(writes[0][13],'device');
 value=200;fail=true;assert.equal((await p.triggerPollNow()).ok,false);assert.equal(writes.length,1);
 fail=false;const result=await p.triggerPollNow();assert.equal(result.transitions,2);assert.equal(writes.length,2);assert.equal(writes[1][11],new Date(source).toISOString());
 await p.triggerPollNow();assert.equal(writes.length,2);
});
