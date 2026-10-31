import test from 'node:test';import assert from 'node:assert/strict';
import {MACS,DEFAULT_MAC,validMac,macName,macVncUrl,twoLines} from '../../client/src/lib/macs.js';
test('validMac keeps known ids and falls back to the default Mac',()=>{
 for(const m of MACS) assert.equal(validMac(m.id),m.id);
 assert.equal(validMac('mac'),DEFAULT_MAC);assert.equal(validMac(undefined),DEFAULT_MAC);assert.equal(validMac('kjeller'),DEFAULT_MAC);
 assert.equal(DEFAULT_MAC,'soverom');assert.equal(macName('stue'),'Mac i stua');assert.equal(macName('eufy'),'Eufy-Macen');assert.equal(macName('andreas'),'Andreas-iMac');assert.equal(macName('halsaneset'),'Mac på Halsaneset');assert.equal(macName('x'),macName(DEFAULT_MAC));
 assert.equal(twoLines('Mac på Soverom'),'Mac på\nSoverom');assert.equal(twoLines('Mac'),'Mac');
});
test('every Mac has a Skjermdeling (VNC) address; Macs without Tailscale use their LAN address via the subnet route',()=>{
 for(const m of MACS) assert.match(macVncUrl(m.id),/^vnc:\/\/(100|192\.168)\.\d+\.\d+(\.\d+)?$/);
 assert.equal(macVncUrl('soverom'),'vnc://100.91.248.127');
 assert.equal(macVncUrl('eufy'),'vnc://192.168.10.207');assert.equal(macVncUrl('andreas'),'vnc://192.168.10.42');
 assert.equal(macVncUrl('x'),null);
});
