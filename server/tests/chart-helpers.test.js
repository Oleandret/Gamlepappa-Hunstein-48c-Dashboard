import test from 'node:test';import assert from 'node:assert/strict';
import {hourlyEnergy,timeTicks} from '../../client/src/lib/historySeries.js';
test('hourly energy sums only valid increments per hour',()=>{
 assert.deepEqual(hourlyEnergy([{at:0,value:0.1},{at:1000,value:0.2},{at:3600000,value:null},{at:3700000,value:0.5}]),[{at:0,value:0.3},{at:3600000,value:0.5}]);
});
test('time ticks are round, inside the range and few',()=>{
 const max=Date.parse('2026-10-27T21:23:00+01:00');
 for(const days of [1,7,30,365]){const t=timeTicks(max-days*86400000,max);assert.ok(t.length>=2&&t.length<=7,String(days));assert.ok(t.every(x=>x>=max-days*86400000&&x<=max));assert.ok(t.every(x=>new Date(x).getMinutes()===0));}
 assert.equal(timeTicks(5,5),undefined);
});
