import test from 'node:test';import assert from 'node:assert/strict';
import {VIDEO_QUALITIES,DEFAULT_QUALITY,validQuality} from '../../client/src/lib/macVideoQuality.js';
test('validQuality keeps known names and falls back to normal',()=>{
 for(const [id] of VIDEO_QUALITIES) assert.equal(validQuality(id),id);
 assert.equal(validQuality('custom'),DEFAULT_QUALITY);assert.equal(validQuality(undefined),DEFAULT_QUALITY);assert.equal(validQuality(''),DEFAULT_QUALITY);
 assert.deepEqual(VIDEO_QUALITIES.map(v=>v[0]),['low','normal','high','max']);  // samme navn som mac-agent
});
