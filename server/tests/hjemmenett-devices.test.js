import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDevices,parseDataLabel,readHjemmenettDevices} from '../lib/hjemmenettClient.js';
import {roomIdForName,sortNetDevices,placeNetDevices} from '../../client/src/lib/networkDevices3d.js';

const raw={count:3,devices:[
 {name:'ole andre iphone',type:'Mobiler og nettbrett',room:null,owner:null,status:'på nett nå',online:true,ip:'192.168.10.244',mac:'06:36:6B:FB:12:1E',data_last_24h:'1,3 GB'},
 {name:'Mac på Soverom',type:'Datamaskiner',room:'Hovedsoverom',owner:null,status:'på nett nå',online:true,ip:'192.168.10.50',mac:'a4:fc:14:23:fe:f6',data_last_24h:'108 GB',password:'x'},
 {name:'Dobbel',type:'Datamaskiner',mac:'a4:fc:14:23:fe:f6'},
 {name:'Uten mac',type:'Kameraer'},
 {name:'Ukjent type',type:'Noe nytt',mac:'00:00:00:00:00:01',ip:'8.8.8.8',online:'yes'}
]};

test('normalizer keeps known fields, drops duplicates, extras, public IPs and non-boolean online',()=>{
 const out=normalizeDevices(raw);
 assert.equal(out.length,3);
 assert.equal(out[0].id,'06:36:6b:fb:12:1e');
 assert.equal(out[0].category,'mobile');
 assert.equal(out[1].password,undefined);
 assert.equal(out[2].category,'other');
 assert.equal(out[2].ip,null);
 assert.equal(out[2].online,false);
 assert.throws(()=>normalizeDevices({}));
});

test('data labels parse Norwegian decimals',()=>{
 assert.equal(parseDataLabel('1,3 GB'),1.3e9);
 assert.equal(parseDataLabel('268 kB'),268e3);
 assert.equal(parseDataLabel(null),null);
 assert.equal(parseDataLabel('mye'),null);
});

test('unconfigured and demo stay disconnected without calling out',async()=>{
 const old={url:process.env.HJEMMENETT_MCP_URL,tok:process.env.HJEMMENETT_MCP_TOKEN,demo:process.env.DEMO_MODE};
 try{
  delete process.env.HJEMMENETT_MCP_URL;delete process.env.HJEMMENETT_MCP_TOKEN;delete process.env.DEMO_MODE;
  assert.deepEqual(await readHjemmenettDevices(),{connected:false,reason:'not-configured',devices:[]});
  process.env.DEMO_MODE='true';
  assert.equal((await readHjemmenettDevices()).reason,'demo-isolation');
 }finally{for(const [k,v] of [['HJEMMENETT_MCP_URL',old.url],['HJEMMENETT_MCP_TOKEN',old.tok],['DEMO_MODE',old.demo]])if(v===undefined)delete process.env[k];else process.env[k]=v;}
});

test('portal room names map to 3D rooms, unknown rooms stay unplaced',()=>{
 assert.equal(roomIdForName('Hovedsoverom'),'f1-sov3');
 assert.equal(roomIdForName('Kino'),'u-kino');
 assert.equal(roomIdForName('Stue'),'f1-kjokken');
 assert.equal(roomIdForName('Andrea soverom'),'f2-sov4');
 assert.equal(roomIdForName('Teknisk rom i kjeller'),'u-tekrom');
 assert.equal(roomIdForName('Teknisk rom bak kjøkken'),null);
 assert.equal(roomIdForName('Treningsrom'),'u-bassbod');
 assert.equal(roomIdForName('Soverom'),null);
 assert.equal(roomIdForName('Kineo'),'u-kino');
 assert.equal(roomIdForName('1.etg Entre'),'f1-gang');
 assert.equal(roomIdForName('2.ETG entre'),'f2-gang');
 assert.equal(roomIdForName('Bod basseng inngang'),'u-bassbod');
 assert.equal(roomIdForName('Hovedinngangen utvendig'),null);
 assert.equal(roomIdForName('Hage'),null);
 assert.equal(roomIdForName('Soverom/Stue'),null);
 assert.equal(roomIdForName(null),null);
});

test('sorting by data puts unknown last, placement only uses rooms in the model',()=>{
 const devs=[{id:'a',name:'A',dataBytes:null,roomId:'u-kino',category:'tv'},{id:'b',name:'B',dataBytes:5,roomId:'u-kino',category:'mobile'},{id:'c',name:'C',dataBytes:9,roomId:null,category:'mobile'}];
 assert.deepEqual(sortNetDevices(devs,'data').map(d=>d.id),['c','b','a']);
 const placed=placeNetDevices(devs);
 assert.equal(placed.length,2);
 assert.ok(placed.every(p=>p.floorId==='basement'&&Number.isFinite(p.x)&&Number.isFinite(p.z)));
});

test('presence groups devices per person; home if any device online, home first',async()=>{
 const {presencePeople}=await import('../../client/src/lib/homePresence.js');
 const net=[{id:'m1',name:'Ole mobil',online:false,status:'sist sett 08:10'},{id:'m2',name:'Ole klokke',online:true,status:'på nett nå'},{id:'m3',name:'Vendela iPhone',online:false,status:'sist sett 07:00'}];
 const people=presencePeople({m1:{person:'Ole'},m2:{person:' Ole '},m3:{person:'Vendela'},m4:{person:'Andrea'}},net);
 assert.deepEqual(people.map(p=>[p.person,p.home,p.devices.length]),[['Ole',true,2],['Andrea',false,1],['Vendela',false,1]]);
 assert.equal(people[1].devices[0].status,'ikke funnet i hjemmenett');
 assert.deepEqual(presencePeople({},net),[]);
});

test('observatory snapshot from hjemmenett: 15-min window, no owner, honest states',async()=>{
 const {snapshotFromDevices}=await import('../lib/hjemmenettClient.js');
 const {deviceState,collectorReporting,recentMinutes}=await import('../../client/src/lib/networkModel.js');
 const at='2026-10-27T06:00:00.000Z',now=Date.parse(at);
 const devs=[{id:'02:00:00:00:00:01',name:'A',online:true,status:'på nett nå',ip:'192.168.10.2',owner:'Ole',room:'Stue'},{id:'02:00:00:00:00:02',name:'B',online:false,status:'sist sett 2 t siden',ip:null}];
 const s=snapshotFromDevices(devs,at);
 assert.equal(s.devices[0].owner,undefined);assert.equal(s.devices[0].room,'Stue');
 assert.equal(recentMinutes(s),15);
 assert.equal(deviceState(s.devices[0],s,now),'observed');
 assert.equal(deviceState(s.devices[1],s,now),'stale');
 assert.equal(deviceState(s.devices[0],s,now+300001),'stale');
 assert.equal(collectorReporting(s,now),true);
 const none=snapshotFromDevices(devs.map(d=>({...d,online:false})),at);
 assert.equal(none.collector.status,'unknown');assert.equal(collectorReporting(none,now),false);
});

test('room temperatures leave out outdoor zones (also sub-zones), garage and outdoor-named sensors',async()=>{
 const {indoorTemperatureGroups,isOutdoorZone}=await import('../../client/src/lib/roomTemps.js');
 const zones={ute:{id:'ute',name:'Ute'},hage:{id:'hage',name:'Bak huset',parent:'ute'},stue:{id:'stue',name:'Stue'},gar:{id:'gar',name:'Garasje'},kjk:{id:'kjk',name:'Kjøkken'}};
 const t=(id,zone,v,extra={})=>({id,zone,name:id,capabilitiesObj:{measure_temperature:{value:v}},...extra});
 const devices={a:t('Stue sensor','stue',21.5),b:t('Sensor bak','hage',6.2),c:t('Garasje temp','gar',9),d:t('Netatmo utendørs','stue',5),e:t('Kjøleskap','kjk',4),f:t('Kjøkken','kjk',22),g:t('Død sensor','stue',3,{available:false})};
 assert.equal(isOutdoorZone('hage',zones),true);assert.equal(isOutdoorZone('stue',zones),false);
 const g=indoorTemperatureGroups(devices,zones);
 assert.deepEqual(g.map(x=>[x.name,x.temp,x.sensorCount]),[['Kjøkken',22,1],['Stue',21.5,1]]);
});

test('overview and activity are normalised; timed lookups never leave the server',async()=>{
 const {normalizeOverview,normalizeActivity,snapshotFromDevices}=await import('../lib/hjemmenettClient.js');
 const ov=normalizeOverview({period_hours:24,findings:[{level:'advarsel',title:'Mulige IP-konflikter',text:'To enheter',devices:['A','B']},{level:'rar',title:'X'}]},{devices:[{name:'Mac',mac:'AA:BB:CC:DD:EE:01',room:'Stue',amount:'108 GB',bytes:108e9},{name:'bad',mac:'nope'}]},{devices:[{mac:'aa:bb:cc:dd:ee:02',ip:'8.8.8.8',last_seen:'2 min'}]});
 assert.equal(ov.findings[1].level,'tips');assert.equal(ov.topData.length,1);assert.equal(ov.topData[0].id,'aa:bb:cc:dd:ee:01');assert.equal(ov.newDevices[0].ip,null);
 const act=normalizeActivity({found:true,top_services_7_days:[{service:'YouTube',category:'Video',lookups:120}],background_7_days:[{service:'iCloud',lookups:9}],data_last_24h:{downloaded:'1,2 GB',sent:'40 MB',noise:'1 MB'},hourly_data_last_24h:[{hour:'08',data:'120 MB'}],recent_lookups:[{time:'08:01',service:'YouTube'}]});
 assert.equal(act.recent_lookups,undefined);assert.equal(act.services[0].service,'YouTube');assert.equal(act.hourly[0].bytes,120e6);
 assert.deepEqual(normalizeActivity({found:false}),{found:false});
 const snap=snapshotFromDevices([{id:'aa:bb:cc:dd:ee:01',name:'Mac',online:true,status:'på nett nå',ip:null,owner:'Ole',room:'Stue',category:'computer',dataLabel:'1 GB',dataBytes:1e9}],'2026-10-27T06:00:00.000Z');
 assert.equal(snap.devices[0].owner,undefined);assert.equal(snap.devices[0].room,'Stue');assert.equal(snap.devices[0].category,'computer');
});
