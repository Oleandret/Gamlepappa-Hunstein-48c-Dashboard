import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {createIphoneSms,findSendButton,parseElements,smsUrl,iphoneSmsConfigured} from '../lib/iphoneSms.js';
import {notifyAvvik,avvikSms,createAvvikRoutes} from '../routes/avvik.js';
const env={IPHONE_REMOTE_URL:'https://remote.example',IPHONE_REMOTE_USER:'ole',IPHONE_REMOTE_PASSWORD:'pw',IPHONE_MCP_TOKEN:'t'};
const sendBtn='{"type":"Button","label":"Send","name":"sendButton","identifier":"sendButton","coordinates":{"x":340,"y":700,"width":30,"height":30}}';
function fakePhone({sendStays=false,noButton=false}={}){const log=[];let opened=false,sent=false;
 const rpc=(id,text)=>new Response(JSON.stringify({jsonrpc:'2.0',id,result:{content:[{type:'text',text}]}}),{headers:{'content-type':'application/json'}});
 const fetchImpl=async(url,o={})=>{const u=new URL(url);const body=o.body?JSON.parse(o.body):null;
  if(u.pathname==='/login')return new Response('{}',{headers:{'set-cookie':'s=1; Path=/'}});
  if(u.pathname==='/api/unlock'){log.push('unlock');return new Response('{}');}
  if(u.pathname==='/api/url'){log.push('url '+body.url);opened=true;return new Response('{}');}
  if(u.pathname==='/mcp'){assert.equal(o.headers.authorization,'Bearer t');const {name,arguments:a}=body.params;log.push(name+(a.x?` ${a.x},${a.y}`:a.button?` ${a.button}`:''));
   if(name==='mobile_list_available_devices')return rpc(body.id,'{"devices":[{"id":"dev1","platform":"ios","state":"online"}]}');
   if(name==='mobile_list_elements_on_screen')return rpc(body.id,`Found these elements on screen: [${opened&&!noButton&&(!sent||sendStays)?sendBtn:''}]`);
   if(name==='mobile_click_on_screen_at_coordinates'){sent=true;return rpc(body.id,'ok');}
   return rpc(body.id,'ok');}
  throw new Error('unexpected '+url);};
 return {fetchImpl,log};}

test('helpers: element parsing, send button centre, sms url, config',()=>{
 const b=findSendButton(parseElements(`Found these elements on screen: [${sendBtn},{"type":"Icon","label":"Været","coordinates":{"x":1,"y":1,"width":2,"height":2}}]`));assert.deepEqual([b.x,b.y],[355,715]);
 assert.equal(findSendButton(parseElements('Found these elements on screen: []')),null);assert.deepEqual(parseElements('ingen liste'),[]);
 assert.equal(smsUrl('+4799999999','Hei & ha det'),'sms:+4799999999&body=Hei%20%26%20ha%20det');assert.throws(()=>smsUrl('99999999','x'));
 assert.ok(iphoneSmsConfigured(env));assert.ok(!iphoneSmsConfigured({...env,IPHONE_MCP_TOKEN:''}));
});

test('sends by opening Messages, tapping Send by name and checking it is gone',async()=>{
 const p=fakePhone();const sms=createIphoneSms({env,fetchImpl:p.fetchImpl,sleep:async()=>{}});
 await sms.send('+4799999999','Hei Ylva');
 assert.deepEqual(p.log,['mobile_list_available_devices','unlock','url sms:+4799999999&body=Hei%20Ylva','mobile_list_elements_on_screen','mobile_click_on_screen_at_coordinates 355,715','mobile_list_elements_on_screen','mobile_press_button HOME']);
});

test('fails honestly when Send cannot be found or the message stays',async()=>{
 await assert.rejects(createIphoneSms({env,fetchImpl:fakePhone({noButton:true}).fetchImpl,sleep:async()=>{}}).send('+4799999999','x'),/Fant ikke Send-knappen/);
 await assert.rejects(createIphoneSms({env,fetchImpl:fakePhone({sendStays:true}).fetchImpl,sleep:async()=>{}}).send('+4799999999','x'),/ikke ut til å være sendt/);
 await assert.rejects(createIphoneSms({env:{},fetchImpl:async()=>{throw new Error('no')}}).send('+4799999999','x'),/ikke satt opp/);
});

test('avvik notification: only to the person concerned, honest statuses',async()=>{
 const item={id:'a',person:'Ylva',registrertAv:'Ole Andre',kategori:'Kjøkken',beskrivelse:'Oppvasken ble stående',forslag:''};
 const sent=[];const messaging={channels:()=>({sms:true}),sendSms:async(to,t)=>sent.push([to,t])};
 const residents=(o)=>({list:async()=>[{navn:'Ylva',...o},{navn:'Ole Andre',telefon:'+4711111111',smsVarsel:true}]});
 assert.equal((await notifyAvvik(item,{messaging,residents:residents({telefon:'+4799999999',smsVarsel:true})})).status,'sendt');
 assert.deepEqual(sent,[['+4799999999',avvikSms(item)]]);assert.match(sent[0][1],/Hei Ylva! Nytt avvik i Huset \(Kjøkken\): Oppvasken ble stående Registrert av Ole Andre\./);
 assert.equal((await notifyAvvik(item,{messaging,residents:residents({telefon:'+4799999999',smsVarsel:false})})).status,'varsel_av');
 assert.equal((await notifyAvvik(item,{messaging,residents:residents({})})).status,'mangler_telefon');
 assert.equal((await notifyAvvik(item,{messaging:{...messaging,channels:()=>({sms:false})},residents:residents({})})).status,'ikke_satt_opp');
 const fail=await notifyAvvik(item,{messaging:{...messaging,sendSms:async()=>{throw new Error('Fant ikke Send-knappen i Meldinger')}},residents:residents({telefon:'+4799999999',smsVarsel:true})});assert.equal(fail.status,'feilet');assert.match(fail.feil,/Send-knappen/);
});

test('route stores the notification result on the avvik',async()=>{
 let store;const done=new Promise(r=>{globalThis.__done=r;});
 const app=express().use(express.json()).use('/avvik',createAvvikRoutes({read:async()=>store,update:async fn=>(store=fn(structuredClone(store))),clock:()=>new Date('2026-10-28T08:00:00Z'),notify:async()=>{setTimeout(()=>globalThis.__done(),20);return {kanal:'sms',status:'sendt',at:'x'};}}));
 const srv=app.listen(0);try{const r=await fetch(`http://127.0.0.1:${srv.address().port}/avvik`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({person:'Ylva',registrertAv:'Ole Andre',kategori:'Kjøkken',beskrivelse:'Test'})});
  const b=await r.json();assert.equal(b.item.varsel.status,'sender');await done;assert.equal(store[0].varsel.status,'sendt');}finally{srv.close();}
});
