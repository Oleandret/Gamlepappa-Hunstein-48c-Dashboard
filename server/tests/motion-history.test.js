import test from 'node:test';import assert from 'node:assert/strict';import {createMotionHistory}from '../lib/motionHistory.js';
test('motion observation persists transitions on/off, initial states, concurrent sensors and restart without duplicates',async()=>{
 let state,t=100000;const opts={load:async()=>structuredClone(state),save:async s=>{state=structuredClone(s);},now:()=>t};let h=createMotionHistory(opts);
 const d=(v,stamp=1000)=>({name:'sensor',capabilitiesObj:{alarm_motion:{value:v,lastUpdated:new Date(stamp).toISOString()},alarm_presence:{value:false,lastUpdated:new Date(stamp).toISOString()}}});
 await h.observe({a:d(true),b:d(false)});assert.equal(state.events.length,4);assert.ok(state.events.every(x=>x.kind==='initial'&&x.zone===null));
 h=createMotionHistory(opts);await h.observe({a:d(true),b:d(false)});assert.equal(state.events.length,4);
 t++;await Promise.all([h.observe({a:d(false,2000),b:d(true,2000)}),h.observe({a:d(false,2000),b:d(true,2000)})]);assert.equal(state.events.length,6);
 await h.observe({a:d(true,500),b:d(false,500)});assert.equal(state.events.length,6);assert.equal(state.events.at(-1).sourceAt,2000);
});
