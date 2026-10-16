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

test('voice widget is embedded only in a sandboxed opaque-origin frame per existing agent',async()=>{
  const render=await componentHarness('VoiceAssistant.jsx','VoiceAssistant');
  assert.equal(render({section:'chat'}),null);assert.equal(render({section:'avatar'}),null);
  const find=(node,pred)=>{if(!node||typeof node!=='object')return null;if(pred(node))return node;
    for(const c of [].concat(node.children||[]).flat()){const r=find(c,pred);if(r)return r;}return null;};
  for(const [section,key] of [['oversikt','oversikt'],['3d','standard']]){
    const fresh=await componentHarness('VoiceAssistant.jsx','VoiceAssistant');
    let tree=fresh({section});
    assert.equal(find(tree,n=>n.type==='iframe'),null,'third-party frame must not load before the user opens it');
    find(tree,n=>n.type==='button'&&n.props['aria-expanded']===false).props.onClick();
    tree=fresh({section});const frame=find(tree,n=>n.type==='iframe');
    assert.equal(frame.props.src,`/voice/widget?agent=${key}`);
    assert.doesNotMatch(frame.props.sandbox,/allow-same-origin/);assert.match(frame.props.sandbox,/allow-scripts/);
    assert.match(frame.props.allow,/microphone/);assert.equal(frame.props.referrerPolicy,'no-referrer');
  }
});

test('voice widget page is sandboxed by CSP, pinned with SRI and limited to known agents',async()=>{
  const {voiceWidget,VOICE_AGENTS,WIDGET_SCRIPT}=await import('../routes/voiceWidget.js');
  const run=agent=>{const res={headers:{'X-Frame-Options':'DENY'},body:'',removeHeader(h){delete this.headers[h];},set(h){Object.assign(this.headers,h);},send(b){this.body=b;}};
    voiceWidget({query:{agent}},res);return res;};
  const res=run('oversikt');const csp=res.headers['Content-Security-Policy'];
  assert.equal(res.headers['X-Frame-Options'],undefined);
  assert.match(csp,/(^|; )sandbox allow-scripts/);assert.doesNotMatch(csp,/allow-same-origin/);
  assert.match(csp,/frame-ancestors 'self'/);assert.match(csp,/default-src 'none'/);
  assert.match(res.body,new RegExp(`agent-id="${VOICE_AGENTS.oversikt}"`));
  assert.ok(res.body.includes(`integrity="${WIDGET_SCRIPT.integrity}"`));assert.match(WIDGET_SCRIPT.src,/@\d+\.\d+\.\d+\//);
  assert.match(run('"><script>alert(1)</script>').body,new RegExp(`agent-id="${VOICE_AGENTS.standard}"`));
});
