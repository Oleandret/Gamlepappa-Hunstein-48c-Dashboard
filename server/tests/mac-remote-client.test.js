import test from 'node:test';import assert from 'node:assert/strict';
import {macPointerAction,keyEventAction} from '../../client/src/lib/macGestures.js';
test('mac pointer gestures: click, double click, modifier click and drag',()=>{
 assert.deepEqual(macPointerAction({x:10,y:10},{x:12,y:11},0.1),['/api/mac/click',{x:10,y:10}]);
 assert.deepEqual(macPointerAction({x:10,y:10},{x:10,y:10},0.1,2),['/api/mac/click',{x:10,y:10,count:2}]);
 assert.deepEqual(macPointerAction({x:10,y:10},{x:10,y:10},0.1,1,['cmd']),['/api/mac/click',{x:10,y:10,modifiers:['cmd']}]);
 assert.deepEqual(macPointerAction({x:10,y:400},{x:10,y:100},0.05),['/api/mac/drag',{fromX:10,fromY:400,toX:10,toY:100,duration:0.2}]);
 assert.equal(macPointerAction({x:0,y:0},{x:50,y:0},9)[1].duration,2);
});
test('keyboard capture: plain characters are typed, everything else becomes a key combo',()=>{
 assert.deepEqual(keyEventAction({key:'a'}),['/api/mac/type',{text:'a'}]);
 assert.deepEqual(keyEventAction({key:'Æ',shiftKey:true}),['/api/mac/type',{text:'Æ'}]);
 assert.deepEqual(keyEventAction({key:'c',metaKey:true}),['/api/mac/key',{combo:'cmd+c'}]);
 assert.deepEqual(keyEventAction({key:'Enter'}),['/api/mac/key',{combo:'return'}]);
 assert.deepEqual(keyEventAction({key:'ArrowUp',ctrlKey:true}),['/api/mac/key',{combo:'ctrl+up'}]);
 assert.deepEqual(keyEventAction({key:'F11'}),['/api/mac/key',{combo:'f11'}]);
 assert.deepEqual(keyEventAction({key:'4',metaKey:true,shiftKey:true}),['/api/mac/key',{combo:'cmd+shift+4'}]);
 assert.equal(keyEventAction({key:'Shift',shiftKey:true}),null);
 assert.equal(keyEventAction({key:'Unidentified'}),null);
});
