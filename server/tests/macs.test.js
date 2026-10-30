import test from 'node:test';import assert from 'node:assert/strict';
import {MACS,DEFAULT_MAC,validMac,macName,twoLines} from '../../client/src/lib/macs.js';
test('validMac keeps known ids and falls back to the default Mac',()=>{
 for(const m of MACS) assert.equal(validMac(m.id),m.id);
 assert.equal(validMac('mac'),DEFAULT_MAC);assert.equal(validMac(undefined),DEFAULT_MAC);assert.equal(validMac('kjeller'),DEFAULT_MAC);
 assert.equal(DEFAULT_MAC,'soverom');assert.equal(macName('stue'),'Mac i stua');assert.equal(macName('eufy'),'Eufy-Macen');assert.equal(macName('andreas'),'Andreas-iMac');assert.equal(macName('halsaneset'),'Mac på Halsaneset');assert.equal(macName('travbaneveien'),'Travbaneveien-laptop');assert.equal(macName('x'),macName(DEFAULT_MAC));
 assert.equal(twoLines('Mac på Soverom'),'Mac på\nSoverom');assert.equal(twoLines('Mac'),'Mac');
});
