import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { setDimmer, canWrite } from '../../client/src/lib/deviceCommands.js';
import { cachedReader } from '../lib/readCache.js';
const lamp = {id:'fixture',capabilitiesObj:{onoff:{value:false,setable:true},dim:{value:.5,setable:true}}};

test('dimmer awaits power-on before level; failed power-on never sends dim', async () => {
  const calls=[]; let release;
  const pending=setDimmer(lamp,10,async(id,cap,value)=>{calls.push({cap,value});if(cap==='onoff')return new Promise(r=>release=r);return {ok:true};});
  assert.deepEqual(calls,[{cap:'onoff',value:true}]); release({ok:true}); await pending;
  assert.deepEqual(calls,[{cap:'onoff',value:true},{cap:'dim',value:.1}]);
  calls.length=0;
  const result=await setDimmer(lamp,10,async(id,cap)=>{calls.push(cap);return {ok:false,error:'fixture failure'};});
  assert.equal(result.ok,false);assert.deepEqual(calls,['onoff']);
});
test('dim-only devices and zero level do not invent power commands; unavailable/read-only devices reject',async()=>{
  const dimOnly={id:'fixture',capabilitiesObj:{dim:{value:.5,setable:true}}};
  const calls=[];const send=async(id,cap,value)=>{calls.push([cap,value]);return {ok:true};};
  await setDimmer(dimOnly,100,send);await setDimmer(lamp,0,send);
  assert.deepEqual(calls,[['dim',1],['dim',0]]);
  for(const d of [{...lamp,available:false},{id:'fixture',capabilitiesObj:{dim:{setable:false}}}]){
    assert.equal(canWrite(d,'dim'),false);await assert.rejects(setDimmer(d,10,send));
  }
  for(const value of [-1,101,NaN,'10'])await assert.rejects(setDimmer(lamp,value,send));
});

test('refresh after invalidation starts a new read and old completion cannot overwrite fresh cache',async()=>{
  const finish=[];const read=cachedReader(()=>new Promise(r=>finish.push(r)));
  const old=read();await Promise.resolve();read.invalidate();
  const fresh=read();await Promise.resolve();assert.equal(finish.length,2);
  finish[1]('new');assert.equal(await fresh,'new');finish[0]('old');assert.equal(await old,'old');
  assert.equal(await read(),'new');assert.equal(finish.length,2);
});

// Execute the actual component handlers with persistent hook slots; no DOM, API or device access.
async function componentHarness(file,name) {
  const requireClient=createRequire(new URL('../../client/package.json',import.meta.url));
  const {transformWithOxc}=await import(requireClient.resolve('vite'));
  const slots=[];let cursor=0;
  const useRef=v=>{const i=cursor++;return slots[i]??=( {current:v} );};
  const useState=v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],value=>{slots[i]=value;}];};
  const useEffect=(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((d,n)=>d!==slots[i][n])){slots[i]=deps;fn();}};
  const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props||{},children})};
  const source=fs.readFileSync(new URL('../../client/src/components/'+file,import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
  const {code}=await transformWithOxc(source,file,{jsx:{runtime:'classic'}});
  const context=vm.createContext({React,useRef,useState,useEffect});
  vm.runInContext(code+'\nglobalThis.component='+name,context);
  return props=>{cursor=0;return context.component(props);};
}
test('slider sends once per gesture, supports keyboard/blur and cancels interrupted touches',async()=>{
  const render=await componentHarness('CommitSlider.jsx','CommitSlider');const sent=[];
  const props={value:50,label:'Dim-nivå',onCommit:value=>sent.push(value)};
  let input=render(props).children[0].props;
  for(const value of [40,30,20,10])input.onChange({target:{value:String(value)}});
  assert.deepEqual(sent,[]);input=render(props).children[0].props;assert.equal(input.value,10);
  input.onPointerUp();input.onBlur();assert.deepEqual(sent,[10]);
  input.onChange({target:{value:'11'}});input.onKeyUp({key:'ArrowRight'});input.onBlur();assert.deepEqual(sent,[10,11]);
  input.onChange({target:{value:'80'}});input.onPointerCancel();input.onPointerUp();assert.deepEqual(sent,[10,11]);
  input=render({...props,disabled:true}).children[0].props;input.onChange({target:{value:'70'}});input.onBlur();assert.deepEqual(sent,[10,11]);
});
test('rejected slider commit restores the last observed level',async()=>{
  const render=await componentHarness('CommitSlider.jsx','CommitSlider');
  const props={value:10,label:'Dim-nivå',onCommit:async()=>({ok:false,error:'fixture'})};
  const input=render(props).children[0].props;input.onChange({target:{value:'90'}});input.onPointerUp();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(render(props).children[0].props.value,10);
});
test('control exposes pending/errors and suppresses double-clicks while a command is pending',async()=>{
  const render=await componentHarness('DeviceCommandStatus.jsx','useDeviceCommand');let command=render();let calls=0,finish;
  const first=command.run(()=>{calls++;return new Promise(r=>finish=r);});
  command=render();assert.equal(command.pending,true);
  assert.equal((await command.run(()=>{calls++;})).ok,false);assert.equal(calls,1);
  finish({ok:false,error:'fixture rejected'});await first;command=render();
  assert.equal(command.pending,false);assert.equal(command.error,true);assert.equal(command.text,'fixture rejected');
  await command.run(async()=>({ok:true,confirmed:false}));assert.match(render().text,/venter/);
});
function routeHarness({commandError=null,failAudit=false}={}) {
  const routes=new Map();let executions=0,audits=0;
  const context=vm.createContext({console:{warn(){}},Router:()=>({get(){},post:(p,h)=>routes.set(p,h)}),isDemoMode:()=>false,
    recordAction:async()=>{if(++audits===2&&failAudit)throw Error('fixture audit failure');return 1;},
    homeyClient:{runFlow:async()=>{executions++;},setCapability:async()=>{if(commandError)throw commandError;executions++;},refreshDevices:async()=>({fixture:{capabilities:{dim:.1}}})},
    capValue:(d,cap)=>d?.capabilities?.[cap]
  });
  const source=fs.readFileSync(new URL('../routes/homey.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,'');vm.runInContext(source,context);
  return {async call(path){let status=200,body;await routes.get(path)({params:{id:'fixture',cap:'dim'},body:{value:.1},user:{role:'admin'}},{status(n){status=n;return this;},json(value){body=value;}});return{status,body,executions};}};
}
test('accepted commands remain successful if result logging fails',async()=>{
  for(const path of ['/flows/:id/run','/devices/:id/capability/:cap']){
    const result=await routeHarness({failAudit:true}).call(path);
    assert.equal(result.status,200);assert.equal(result.executions,1);assert.equal(result.body.ok,true);assert.match(result.body.warning,/aktivitetsloggen/);
  }
});
test('capability validation and queue rejection retain actionable HTTP status',async()=>{
  for(const [status,code] of [[400,'INVALID_CAPABILITY'],[429,'QUEUE_FULL'],[502,'RESULT_UNKNOWN']]){
    const result=await routeHarness({commandError:Object.assign(Error('fixture'),{status})}).call('/devices/:id/capability/:cap');
    assert.equal(result.status,status);assert.equal(result.body.code,code);assert.equal(result.executions,0);
  }
});

test('standard ElevenLabs widget keeps both existing agents and the original appearance',async()=>{
  const render=await componentHarness('VoiceAssistant.jsx','VoiceAssistant');
  assert.equal(render({section:'chat'}),null);assert.equal(render({section:'avatar'}),null);
  for(const [section,agent] of [['oversikt','SCOI5nAeUm2P90tPlhxJ'],['hus-3d','agent_4501kc02r47xec2s0r87f0awxdj6']]){
    const el=render({section});assert.equal(el.type,'elevenlabs-convai');
    assert.equal(el.props['agent-id'],agent);assert.equal(el.props.variant,'compact');assert.equal(el.props.placement,'bottom-right');
    assert.equal(el.props['avatar-orb-color-1'],'#22e6ff');assert.equal(el.props['avatar-orb-color-2'],'#7d5cff');
  }
});

test('widget script is pinned with SRI and allowed by CSP only from that exact package version',async()=>{
  const html=fs.readFileSync(new URL('../../client/index.html',import.meta.url),'utf8');
  const tag=html.match(/<script[^>]+convai-widget-embed@(\d+\.\d+\.\d+)\/dist\/index\.js[^>]*>/);
  assert.ok(tag,'widget script must reference an exact version');
  assert.match(tag[0],/integrity="sha384-[A-Za-z0-9+/=]+"/);assert.match(tag[0],/crossorigin="anonymous"/);
  const server=fs.readFileSync(new URL('../index.js',import.meta.url),'utf8');
  assert.ok(server.includes(`script-src 'self' https://unpkg.com/@elevenlabs/convai-widget-embed@${tag[1]}/`));
  assert.doesNotMatch(server,/script-src[^;]*'unsafe-(inline|eval)'/);
});
