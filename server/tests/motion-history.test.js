import test from 'node:test';import assert from 'node:assert/strict';import {createMotionHistory}from '../lib/motionHistory.js';
test('motion observation persists transitions on/off, initial states, concurrent sensors and restart without duplicates',async()=>{
 let state,t=100000;const opts={load:async()=>structuredClone(state),save:async s=>{state=structuredClone(s);},now:()=>t};let h=createMotionHistory(opts);
 const d=(v,stamp=1000)=>({name:'sensor',capabilitiesObj:{alarm_motion:{value:v,lastUpdated:new Date(stamp).toISOString()},alarm_presence:{value:false,lastUpdated:new Date(stamp).toISOString()}}});
 await h.observe({a:d(true),b:d(false)});assert.equal(state.events.length,4);assert.ok(state.events.every(x=>x.kind==='initial'&&x.zone===null));
 h=createMotionHistory(opts);await h.observe({a:d(true),b:d(false)});assert.equal(state.events.length,4);
 t++;await Promise.all([h.observe({a:d(false,2000),b:d(true,2000)}),h.observe({a:d(false,2000),b:d(true,2000)})]);assert.equal(state.events.length,6);
 await h.observe({a:d(true,500),b:d(false,500)});assert.equal(state.events.length,6);assert.equal(state.events.at(-1).sourceAt,2000);
});
test('numeric source timestamps advance watermark without inventing events; retention prunes without transitions',async()=>{
 let state,t=1792270000000;const h=createMotionHistory({load:async()=>structuredClone(state),save:async s=>{state=structuredClone(s);},now:()=>t});const d=(value,lastUpdated)=>({s:{name:'s',capabilitiesObj:{alarm_motion:{value,lastUpdated}}}});
 await h.observe(d(false,t));await h.observe(d(false,t+2000));assert.equal(state.events.length,1);await h.observe(d(true,t+1000));assert.equal(state.events.length,1);assert.equal(state.last['s:alarm_motion'].sourceAt,t+2000);t+=8*86400000;await h.observe(d(false,t));assert.equal(state.events.length,0);
});
import {motionLocation} from '../../client/src/lib/motionLocation.js';
test('explicit zone ancestry distinguishes properties without assuming unknown rooms are Hunstein',()=>{
 const zones={room:{name:'Stue',parent:'home'},home:{name:'Hunstein 48C'},cabin:{name:'Halsaneset'}};assert.equal(motionLocation({zone:'room'},zones).site,'Hunstein (Homey-sonenavn)');assert.equal(motionLocation({zone:'cabin'},zones).site,'Halsaneset (Homey-sonenavn)');assert.equal(motionLocation({zone:'missing'},zones).room,'Ukjent rom');assert.equal(motionLocation({zone:'missing'},zones).site,'Anlegg ubekreftet');
});
import {activityFromHistory} from '../lib/activityFeed.js';
import {MOTION_CAPS} from '../lib/motionHistory.js';
test('door, lock and alarm transitions are stored; activity skips baseline and motion-stopped, newest first',async()=>{
 let state,t=1792270000000;const h=createMotionHistory({load:async()=>structuredClone(state),save:async s=>{state=structuredClone(s);},now:()=>t});
 const dev=(motion,door,locked,at)=>({pir:{name:'PIR gang',zone:'z1',capabilitiesObj:{alarm_motion:{value:motion,lastUpdated:at}}},dor:{name:'Ytterdør',zone:'z1',capabilitiesObj:{alarm_contact:{value:door,lastUpdated:at},locked:{value:locked,lastUpdated:at}}},lamp:{name:'Lampe',capabilitiesObj:{onoff:{value:true,lastUpdated:at}}}});
 await h.observe(dev(false,false,true,t));t+=60000;await h.observe(dev(true,true,false,t));t+=60000;await h.observe(dev(false,false,true,t));
 assert.ok(state.events.every(e=>e.deviceId!=='lamp'));
 const feed=activityFromHistory(state.events,{z1:{name:'Gang'}});
 assert.deepEqual(feed.map(e=>e.text).sort(),['Bevegelse — PIR gang (Gang)','Lukket — Ytterdør (Gang)','Låst opp — Ytterdør (Gang)','Låst — Ytterdør (Gang)','Åpnet — Ytterdør (Gang)'].sort());
 assert.deepEqual(new Set(feed.slice(0,2).map(e=>e.text)),new Set(['Lukket — Ytterdør (Gang)','Låst — Ytterdør (Gang)']));
 assert.equal(feed.length,5);assert.equal(feed.filter(e=>e.text.startsWith('Bevegelse stoppet')).length,0);
 assert.ok(feed[0].ts>=feed.at(-1).ts);assert.equal(feed.find(e=>e.text.startsWith('Åpnet')).active,true);
 assert.equal(state.events.filter(e=>MOTION_CAPS.test(e.capability)).length,3);
});
import {activityFromRows,readActivityPage,ACTIVITY_CAPS} from '../lib/activityFeed.js';
test('long activity history reads device_events with period and paging',async()=>{
 const rows=[{ts:'2026-10-27T10:00:00Z',device_id:'d',device_name:'Ytterdør',zone:'Gang',capability:'alarm_contact',value:true,time_source:'device'},{ts:'2026-10-27T09:00:00Z',device_id:'p',device_name:'PIR',zone:null,capability:'alarm_motion.1',value:true,time_source:'poll'},{ts:'2026-10-27T08:00:00Z',device_id:'x',device_name:'Lampe',zone:'Stue',capability:'onoff',value:true}];
 const feed=activityFromRows(rows);assert.deepEqual(feed.map(e=>e.text),['Åpnet — Ytterdør (Gang)','Bevegelse — PIR']);assert.equal(feed[1].timeSource,'observert');
 let seen;const q=async(sql,params)=>{seen={sql,params};return {rows:rows.slice(0,2)};};
 const page=await readActivityPage(q,{days:365,before:Date.parse('2026-10-28T00:00:00Z'),limit:1});
 assert.equal(page.activity.length,1);assert.equal(page.hasMore,true);assert.equal(page.oldest,Date.parse('2026-10-27T10:00:00Z'));
 assert.deepEqual(seen.params,[ACTIVITY_CAPS,365,'2026-10-28T00:00:00.000Z',2]);assert.ok(!/\$\{/.test(seen.sql));
});
