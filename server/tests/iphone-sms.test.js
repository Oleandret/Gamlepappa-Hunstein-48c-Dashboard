import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {createIphoneSms,findSendButton,findComposeButton,findRecipientField,findBodyField,parseElements,iphoneSmsConfigured} from '../lib/iphoneSms.js';
import {notifyAvvik,avvikSms,createAvvikRoutes} from '../routes/avvik.js';
const env={IPHONE_REMOTE_URL:'https://remote.example',IPHONE_REMOTE_USER:'ole',IPHONE_REMOTE_PASSWORD:'pw',IPHONE_MCP_TOKEN:'t'};
// Elementene slik Meldinger på telefonen (iOS 16, norsk) faktisk viser dem.
const el=(type,label,x,y,w,h,identifier=null)=>({type,label,name:identifier||label,identifier,coordinates:{x,y,width:w,height:h}});
const UI={compose:el('Button','Ny melding',318,44,49,44,'composeButton'),back:el('Button','Tilbake',0,44,80,44,'BackButton'),
 to:el('TextField','Til:',16,134,343,55),body:el('TextField','Melding',131,434,194,38,'messageBodyField'),cancel:el('Button','Avbryt',306,73,53,44),
 send:el('Button','Send',326,439,29,28,'sendButton'),failed:el('Button','Feil ved sending',334,281,29,30),icon:el('Icon','Været',25,69,64,89,'Været')};
const hit=(e,x,y)=>{const c=e.coordinates;return x>=c.x&&x<=c.x+c.width&&y>=c.y&&y<=c.y+c.height;};
/**
 * Falsk telefon som Meldinger: hjem-skjerm → samtaleliste (eller åpen samtale /
 * gammelt utkast) → ny melding. Meldingsfeltet er skjult bak forslagslisten
 * til mottakeren er låst med Retur.
 */
function fakePhone({sendStays=false,noSend=false,inConversation=false,openDraft=false,undelivered=false}={}){const log=[];const st={screen:'home',focus:null,to:'',locked:false,body:'',sent:[],failed:0};
 const shown=()=>st.screen==='home'?[UI.icon]:st.screen==='conversation'?[UI.back]:st.screen==='list'?[UI.compose]
  :[UI.cancel,{...UI.to,value:st.to},...Array(st.failed).fill(UI.failed),...(st.locked?[{...UI.body,value:st.body}]:[]),...(st.body&&!noSend?[UI.send]:[])];
 const rpc=(id,text)=>new Response(JSON.stringify({jsonrpc:'2.0',id,result:{content:[{type:'text',text}]}}),{headers:{'content-type':'application/json'}});
 const fetchImpl=async(url,o={})=>{const u=new URL(url);const body=o.body?JSON.parse(o.body):null;
  if(u.pathname==='/login')return new Response('{}',{headers:{'set-cookie':'s=1; Path=/'}});
  if(u.pathname==='/api/unlock'){log.push('unlock');return new Response('{}');}
  if(u.pathname==='/mcp'){assert.equal(o.headers.authorization,'Bearer t');const {name,arguments:a}=body.params;
   if(name==='mobile_list_available_devices'){log.push(name);return rpc(body.id,'{"devices":[{"id":"dev1","platform":"ios","state":"online"}]}');}
   if(name==='mobile_list_elements_on_screen')return rpc(body.id,`Found these elements on screen: ${JSON.stringify(shown())}`);
   if(name==='mobile_launch_app'){log.push('launch '+a.packageName);st.screen=openDraft?'compose':inConversation?'conversation':'list';if(openDraft)Object.assign(st,{to:'+4711111111',locked:true});return rpc(body.id,'ok');}
   if(name==='mobile_click_on_screen_at_coordinates'){const e=shown().find(e=>hit(e,a.x,a.y));log.push('tap '+(e?.label??'?'));
    if(e===UI.compose)Object.assign(st,{screen:'compose',to:'',locked:false,body:''});if(e===UI.cancel)st.screen='list';if(e===UI.back)st.screen='list';if(e?.label==='Til:')st.focus='to';if(e?.label==='Melding')st.focus='body';
    if(e===UI.send){st.sent.push([st.to,st.body]);if(undelivered)st.failed++;if(!sendStays)st.body='';}return rpc(body.id,'ok');}
   if(name==='mobile_type_keys'){assert.equal(a.submit,false);log.push(`type ${st.focus}`);st[st.focus]+=a.text;return rpc(body.id,'ok');}
   if(name==='mobile_press_button'){log.push('press '+a.button);if(a.button==='ENTER'){if(st.focus==='to')st.locked=true;}else st.screen='home';return rpc(body.id,'ok');}
   return rpc(body.id,'ok');}
  throw new Error('unexpected '+url);};
 return {fetchImpl,log,st};}
const mk=(o)=>{const p=fakePhone(o);return {p,sms:createIphoneSms({env,fetchImpl:p.fetchImpl,sleep:async()=>{}})};};

test('helpers: element parsing, finding buttons and fields by name, config',()=>{
 const els=parseElements(`Found these elements on screen: ${JSON.stringify([UI.icon,UI.to,UI.body,UI.send,UI.compose])}`);
 assert.deepEqual([findSendButton(els).x,findSendButton(els).y],[341,453]);
 assert.equal(findComposeButton(els).identifier,'composeButton');assert.equal(findRecipientField(els).label,'Til:');assert.equal(findBodyField(els).identifier,'messageBodyField');
 assert.equal(findSendButton(parseElements('Found these elements on screen: []')),null);assert.deepEqual(parseElements('ingen liste'),[]);
 assert.ok(iphoneSmsConfigured(env));assert.ok(!iphoneSmsConfigured({...env,IPHONE_MCP_TOKEN:''}));
});

test('sends through the Messages app: new message, recipient, text, Send, verified',async()=>{
 const {p,sms}=mk();await sms.send('+4799999999','Hei Ylva');
 assert.deepEqual(p.st.sent,[['+4799999999','Hei Ylva']]);
 assert.deepEqual(p.log,['mobile_list_available_devices','unlock','launch com.apple.MobileSMS','tap Ny melding','tap Til:','type to','press ENTER','tap Melding','type body','tap Send','press HOME']);
});

test('goes back to the list when Messages opens in a conversation',async()=>{
 const {p,sms}=mk({inConversation:true});await sms.send('+4799999999','Hei');
 assert.deepEqual(p.st.sent,[['+4799999999','Hei']]);assert.ok(p.log.includes('tap Tilbake'));
});

test('closes a draft left open from an earlier attempt before starting a new one',async()=>{
 const {p,sms}=mk({openDraft:true});await sms.send('+4799999999','Hei');
 assert.deepEqual(p.st.sent,[['+4799999999','Hei']]);assert.ok(p.log.indexOf('tap Avbryt')<p.log.indexOf('tap Ny melding'));
});

test('without Return the message field stays hidden, so the recipient must be locked first',async()=>{
 const p=fakePhone();const sms=createIphoneSms({env,fetchImpl:async(u,o)=>{const b=o.body&&JSON.parse(o.body);if(b?.params?.name==='mobile_press_button'&&b.params.arguments.button==='ENTER')return new Response(JSON.stringify({jsonrpc:'2.0',id:b.id,result:{content:[{type:'text',text:'ok'}]}}));return p.fetchImpl(u,o);},sleep:async()=>{}});
 await assert.rejects(sms.send('+4799999999','Hei'),/Fant ikke meldingsfeltet/);assert.deepEqual(p.st.sent,[]);assert.equal(p.log.at(-1),'press HOME');
});

test('reports a message the phone could not deliver',async()=>{
 const {sms}=mk({undelivered:true});await assert.rejects(sms.send('+4799999999','Hei'),/ikke levert/);
});

test('fails honestly when Send cannot be found or the message stays, and goes home',async()=>{
 const a=mk({noSend:true});await assert.rejects(a.sms.send('+4799999999','x'),/Fant ikke Send-knappen/);assert.equal(a.p.log.at(-1),'press HOME');assert.deepEqual(a.p.st.sent,[]);
 const b=mk({sendStays:true});await assert.rejects(b.sms.send('+4799999999','x'),/ikke ut til å være sendt/);
 await assert.rejects(mk().sms.send('99999999','x'),/Ugyldig telefonnummer/);
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

test('check reads only; send reports each step',async()=>{
 const {p,sms}=mk();
 const steps=[];const r=await sms.check({onStep:t=>steps.push(t)});
 assert.deepEqual(r,{device:'dev1',elements:1});assert.ok(!p.log.some(l=>/^(tap|type|launch)/.test(l)));
 assert.deepEqual(steps.map(s=>s.split(' ')[0]),['Innlogging','MCP','Leste']);
 const s2=[];await sms.send('+4799999999','Hei',{onStep:t=>s2.push(t)});
 assert.deepEqual(s2,['Fant telefonen via MCP','Låste opp telefonen','Åpnet Meldinger','Skrev mottaker +4799999999','Skrev meldingen','Trykket Send','Bekreftet: meldingen er sendt','Tilbake til hjem-skjermen']);
});

test('SMS test and send routes: owner only, validated, honest results',async()=>{
 const {createBeboerRoutes}=await import('../routes/beboere.js');
 const calls=[];const iphoneSms={configured:()=>true,check:async({onStep})=>{onStep('MCP svarer');return {device:'d'};},send:async(to,t,{onStep})=>{calls.push([to,t]);onStep('Trykket Send');if(t==='feil')throw new Error('Fant ikke Send-knappen i Meldinger');}};
 const mk=owner=>{const app=express().use(express.json()).use('/a',createBeboerRoutes({owner:()=>owner,iphoneSms,residents:{list:async()=>[]},reminders:{settings:async()=>({}),log:async()=>[]},messaging:{channels:()=>({})}}));const s=app.listen(0);return {s,u:`http://127.0.0.1:${s.address().port}/a`};};
 const post=(u,b)=>fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(async r=>({status:r.status,body:await r.json()}));
 const no=mk(false);try{assert.equal((await post(no.u+'/sms/send',{til:'99999999',tekst:'x'})).status,403);assert.equal(calls.length,0);}finally{no.s.close();}
 const yes=mk(true);try{
  const t=await post(yes.u+'/sms/test',{});assert.equal(t.body.ok,true);assert.equal(t.body.steps[0].tekst,'MCP svarer');
  assert.equal((await post(yes.u+'/sms/send',{til:'123',tekst:'x'})).status,400);assert.equal((await post(yes.u+'/sms/send',{til:'99999999',tekst:''})).status,400);
  const ok=await post(yes.u+'/sms/send',{til:'99 99 99 99',tekst:'Hei'});assert.equal(ok.body.ok,true);assert.equal(ok.body.til,'+4799999999');assert.deepEqual(calls.at(-1),['+4799999999','Hei']);
  const bad=await post(yes.u+'/sms/send',{til:'99999999',tekst:'feil'});assert.equal(bad.body.ok,false);assert.match(bad.body.error,/Send-knappen/);assert.equal(bad.body.steps.length,1);
 }finally{yes.s.close();}
});
