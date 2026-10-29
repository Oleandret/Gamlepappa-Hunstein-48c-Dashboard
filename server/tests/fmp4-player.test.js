import test from 'node:test';import assert from 'node:assert/strict';
import {codecsFromInit,countFragments,concatBytes} from '../../client/src/lib/fmp4Player.js';
const box=(type,body)=>{const b=new Uint8Array(8+body.length);new DataView(b.buffer).setUint32(0,b.length);b.set([...type].map(c=>c.charCodeAt(0)),4);b.set(body,8);return b;};
test('codecsFromInit reads profile, compatibility and level out of the avcC box',()=>{
 const avcC=box('avcC',new Uint8Array([1,0x4D,0x00,0x28,0xFF,0xE1,0,4,0x67,0x4D,0x00,0x28,1,0,2,0x68,0xEE]));
 const init=concatBytes([box('ftyp',new Uint8Array(16)),box('moov',avcC)]);
 assert.equal(codecsFromInit(init),'avc1.4D0028');
 assert.equal(codecsFromInit(box('ftyp',new Uint8Array(16))),null);
 // Delt over to biter: fungerer så snart boksen er komplett i det sammenslåtte hodet.
 assert.equal(codecsFromInit(init.subarray(0,30)),null);
 assert.equal(codecsFromInit(concatBytes([init.subarray(0,30),init.subarray(30)])),'avc1.4D0028');
});
test('countFragments counts moof boxes in a chunk',()=>{
 const frag=concatBytes([box('moof',new Uint8Array(20)),box('mdat',new Uint8Array(100))]);
 assert.equal(countFragments(concatBytes([frag,frag,frag])),3);
 assert.equal(countFragments(box('mdat',new Uint8Array(5))),0);
});
