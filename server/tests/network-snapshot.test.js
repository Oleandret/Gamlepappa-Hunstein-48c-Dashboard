import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {normalizeNetworkSnapshot,readNetworkSnapshot} from '../lib/networkSnapshot.js';
import {collectorReporting,deviceState,observedLinks,historyPoints} from '../../client/src/lib/networkModel.js';
const now=Date.parse('2026-10-18T06:00:00Z'),at=new Date(now).toISOString();
const fixture=()=>({schema_version:1,snapshot_id:'test',source:'hjemmenett-monitor',observed_at:at,collector:{status:'ok',last_seen:at},devices:[{id:'a',label:'Enhet A',last_seen:at,status:'observed',source:'neighbor-cache',ip:'192.168.1.2'},{id:'b',label:'Enhet B',last_seen:at,status:'observed',source:'deco'}],links:[],history:[],events:[]});
test('normalizer drops traffic, credentials and presence instead of exposing them',()=>{const s=fixture();s.password='secret';s.presence=[{name:'Person'}];s.devices[0].domains=['private.example'];const out=normalizeNetworkSnapshot(s);assert.equal(out.password,undefined);assert.equal(out.devices[0].domains,undefined);assert.deepEqual(out.presence,[]);});
test('unknown and stale are not reported as observed',()=>{const s=fixture();assert.equal(deviceState(s.devices[0],s,now),'observed');assert.equal(deviceState(s.devices[0],s,now+300001),'stale');s.collector.status='unknown';assert.equal(deviceState(s.devices[0],s,now),'stale');s.devices[0].last_seen=null;assert.equal(deviceState(s.devices[0],s,now),'unknown');});
test('future source timestamps cannot be considered live',()=>{const s=fixture();s.devices[0].last_seen='2099-01-01T00:00:00Z';assert.equal(deviceState(s.devices[0],s,now),'unknown');});
test('topology requires existing endpoints, timestamp and source',()=>{const s=fixture();s.links=[{source_id:'a',target_id:'b',source:'deco',observed_at:at},{source_id:'a',target_id:'missing',source:'deco',observed_at:at},{source_id:'a',target_id:'b'}];assert.equal(normalizeNetworkSnapshot(s).links.length,1);assert.equal(observedLinks(s,now).length,1);});
test('duplicate device IDs and invalid version fail closed',()=>{const s=fixture();s.devices.push(s.devices[0]);assert.throws(()=>normalizeNetworkSnapshot(s));assert.throws(()=>normalizeNetworkSnapshot({...fixture(),schema_version:2}));});
test('history preserves zero and rejects invented or invalid counts',()=>{assert.deepEqual(historyPoints({history:[{at,observed_devices:0},{at,observed_devices:null},{at:'bad',observed_devices:2}]}),[{at,observed_devices:0}]);});
test('unconfigured and invalid file stay disconnected',async()=>{assert.deepEqual(await readNetworkSnapshot(''),{connected:false,reason:'not-configured',snapshot:null});assert.equal((await readNetworkSnapshot('/does/not/exist')).connected,false);const dir=await fs.mkdtemp(path.join(os.tmpdir(),'net-snapshot-'));const file=path.join(dir,'snapshot.json');try{await fs.writeFile(file,JSON.stringify(fixture()));assert.equal((await readNetworkSnapshot(file,now)).snapshot.devices.length,2);await fs.writeFile(file,'broken');assert.equal((await readNetworkSnapshot(file,now)).reason,'unavailable');}finally{await fs.rm(dir,{recursive:true,force:true});}});
test('manual entries and stale snapshot cannot appear recently observed',()=>{const s=fixture();assert.equal(deviceState({...s.devices[0],source:'manual'},s,now),'unknown');s.observed_at='2020-01-01T00:00:00Z';assert.equal(deviceState(s.devices[0],s,now),'stale');});

test('collector can report a genuine zero while unknown sources remain unknown',()=>{const s=fixture();assert.equal(collectorReporting({...s,devices:[]},now),true);assert.equal(collectorReporting(s,now+300001),false);assert.equal(deviceState({...s.devices[0],source:'unverified'},s,now),'unknown');});

test('timezone-free, future history and old links are not live',()=>{const s=fixture();s.observed_at='2026-10-18T06:00:00';assert.throws(()=>normalizeNetworkSnapshot(s));assert.equal(historyPoints({history:[{at:'2099-01-01T00:00:00Z',observed_devices:3}]},now).length,0);assert.equal(observedLinks({...fixture(),links:[{source_id:'a',target_id:'b',source:'deco',observed_at:'2020-01-01T00:00:00Z'}]},now).length,0);});
test('window event is retained without claiming arrival',()=>{const s=fixture();s.events=[{id:'x',device_id:'a',at,type:'first_in_snapshot_window'}];assert.equal(normalizeNetworkSnapshot(s).events[0].type,'first_in_snapshot_window');});
test('demo mode cannot expose real snapshot file',async()=>{const old=process.env.DEMO_MODE;try{process.env.DEMO_MODE='true';assert.deepEqual(await readNetworkSnapshot('/any/path'),{connected:false,reason:'demo-isolation',snapshot:null});}finally{if(old===undefined)delete process.env.DEMO_MODE;else process.env.DEMO_MODE=old;}});

test('Python UTC timestamps preserve microsecond precision at the contract boundary',()=>{const s=fixture();s.observed_at='2026-10-18T06:00:00.123456Z';assert.equal(normalizeNetworkSnapshot(s).observed_at,s.observed_at);});

test('exports older than seven days expose no devices even if collector stopped',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'net-expiry-'));const file=path.join(dir,'snapshot.json');try{await fs.writeFile(file,JSON.stringify(fixture()));assert.deepEqual(await readNetworkSnapshot(file,now+7*86400000+1),{connected:false,reason:'expired',snapshot:null});}finally{await fs.rm(dir,{recursive:true,force:true});}});
