import test from 'node:test';import assert from 'node:assert/strict';
import {pointerAction} from '../../client/src/lib/iphoneGestures.js';
test('pointer gestures map to tap, long press and swipe like iphone-remote',()=>{
 assert.deepEqual(pointerAction({x:10,y:10},{x:12,y:11},0.1),['/api/tap',{x:10,y:10}]);
 assert.deepEqual(pointerAction({x:10,y:10},{x:10,y:10},1.2),['/api/longpress',{x:10,y:10,duration:1.2}]);
 assert.deepEqual(pointerAction({x:10,y:400},{x:10,y:100},0.05),['/api/swipe',{fromX:10,fromY:400,toX:10,toY:100,duration:0.1}]);
 assert.equal(pointerAction({x:0,y:0},{x:0,y:0},9)[1].duration,3);
});
