import test from 'node:test';import assert from 'node:assert/strict';
import {presencePeople,minutesSinceSeen,deviceState,RECENT_MINUTES} from '../../client/src/lib/homePresence.js';
test('minutes since seen is read from the monitor\'s wording',()=>{
 assert.equal(minutesSinceSeen('på nett nå'),0);
 assert.equal(minutesSinceSeen('sist sett akkurat nå'),0);
 assert.equal(minutesSinceSeen('sist sett for 18 min siden'),18);
 assert.equal(minutesSinceSeen('sist sett for 1 time siden'),60);
 assert.equal(minutesSinceSeen('sist sett for 3 timer siden'),180);
 assert.equal(minutesSinceSeen('sist sett for 2 dager siden'),2880);
 assert.equal(minutesSinceSeen('ikke sett ennå'),null);
 assert.equal(minutesSinceSeen(null),null);
});
test('a phone asleep for a while is «nylig», not away',()=>{
 assert.equal(RECENT_MINUTES,60);
 assert.equal(deviceState({online:true,status:'på nett nå'}),'home');
 assert.equal(deviceState({online:false,status:'sist sett for 18 min siden'}),'recent');
 assert.equal(deviceState({online:false,status:'sist sett for 1 time siden'}),'recent');
 assert.equal(deviceState({online:false,status:'sist sett for 2 timer siden'}),'away');
 assert.equal(deviceState({online:false,status:'ikke sett ennå'}),'unknown');
 assert.equal(deviceState(undefined),'unknown');
});
test('people take the best state of their devices; home and recent count as home',()=>{
 const net=[{id:'aa',name:'Ole mobil',online:false,status:'sist sett for 18 min siden'},{id:'bb',name:'Ole klokke',online:false,status:'ikke sett ennå'},
  {id:'cc',name:'Vendela mobil',online:false,status:'sist sett for 2 dager siden'},{id:'dd',name:'Ylva mobil',online:true,status:'på nett nå'}];
 const people=presencePeople({aa:{person:'Ole'},bb:{person:'Ole'},cc:{person:'Vendela'},dd:{person:'Ylva'},ee:{person:'Gjest'}},net);
 assert.deepEqual(people.map(p=>[p.person,p.state,p.home]),[['Ylva','home',true],['Ole','recent',true],['Vendela','away',false],['Gjest','unknown',false]]);
 assert.deepEqual(people[1].devices.map(d=>d.state),['recent','unknown']);
 assert.equal(people[3].devices[0].status,'ikke funnet i hjemmenett');
});
