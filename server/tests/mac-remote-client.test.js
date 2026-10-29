import test from 'node:test';import assert from 'node:assert/strict';
import {macPointerAction,keyEventAction,containedRect,pointInScreen} from '../../client/src/lib/macGestures.js';
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
test('pointer math: letterboxed box (fullscreen) maps the image area, not the whole box',()=>{
 const size={width:1920,height:1080};
 // 16:9-bilde midt i en 2000×1500-boks: bildet er 2000×1125 med 187,5 px svart over og under.
 const box={left:0,top:0,width:2000,height:1500};
 assert.deepEqual(containedRect(box,16/9),{left:0,top:187.5,width:2000,height:1125});
 assert.deepEqual(pointInScreen({clientX:1000,clientY:750},box,size),{x:960,y:540});
 assert.deepEqual(pointInScreen({clientX:0,clientY:0},box,size),{x:0,y:0});
 assert.deepEqual(pointInScreen({clientX:2000,clientY:1500},box,size),{x:1920,y:1080});
 // Boks med riktig sideforhold: uendret.
 assert.deepEqual(pointInScreen({clientX:10+96,clientY:20+54},{left:10,top:20,width:192,height:108},size),{x:960,y:540});
});
