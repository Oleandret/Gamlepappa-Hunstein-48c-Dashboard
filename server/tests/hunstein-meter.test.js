import test from 'node:test';import assert from 'node:assert/strict';import {HUNSTEIN_MAIN_ID,hunsteinMeter,sourceTime}from '../../client/src/lib/hunsteinMeter.js';import {inventory}from '../../client/src/lib/savingsModel.js';
test('confirmed Pulse alone supplies total; numeric millisecond timestamps preserved and daily register never derived from power',()=>{
 const now=1792270000000,d={name:'Pulse Hunstein 48C',capabilitiesObj:{measure_power:{value:6000,lastUpdated:now},meter_power:{value:107.51,lastUpdated:now-86400000}}};const ds={[HUNSTEIN_MAIN_ID]:d,other:{...d,name:'Halsaneset'},sub:d};const m=hunsteinMeter(ds,now);assert.equal(m.watts,6000);assert.equal(m.dailyKwh,107.51);assert.equal(m.meterAt,now-86400000);assert.equal(m.stale,false);assert.equal(hunsteinMeter(ds,now+130000).stale,true);assert.equal(hunsteinMeter({other:d}),null);assert.equal(sourceTime(now),now);assert.equal(inventory(ds,{},'live',now)[0].power.quality,'measured');delete d.capabilitiesObj.meter_power;assert.equal(hunsteinMeter(ds,now).dailyKwh,null);
});

test('actual Homey Pulse identity resolves without name matching',()=>{
 const m=hunsteinMeter({'52c4a219-ebee-4be0-aa52-38e800aaa239':{name:'Pulse Hunstein 48C',capabilitiesObj:{measure_power:{value:6337,lastUpdated:1792267981462},meter_power:{value:107.51,lastUpdated:1792267981497}}}},1792272000000);
 assert.equal(m.watts,6337);assert.equal(m.dailyKwh,107.51);assert.equal(m.stale,true);
});
