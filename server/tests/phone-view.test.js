import test from 'node:test';import assert from 'node:assert/strict';
import {PHONE_VIEWS,validPhoneView,storPanelWidth} from '../../client/src/lib/phoneView.js';
test('phone view: normal, stor and fullskjerm; only normal/stor are remembered',()=>{
 assert.deepEqual(PHONE_VIEWS.map(v=>v[0]),['normal','stor','full']);
 assert.equal(validPhoneView('stor'),'stor');
 assert.equal(validPhoneView('normal'),'normal');
 assert.equal(validPhoneView('full'),'normal');   // fullskjerm krever et klikk hver gang
 assert.equal(validPhoneView(null),'normal');
});
test('stor panel width: phone fills the window height, clamped to a sane range',()=>{
 const size={width:375,height:812};
 // 1080 høy skjerm, 136 px til topptekst og kanter: telefonen blir 944 høy → 436 bred, pluss 26 px sidekanter.
 assert.equal(storPanelWidth({innerWidth:1920,innerHeight:1080,chrome:136,size}),462);
 // Lavt vindu: aldri smalere enn det vanlige panelet.
 assert.equal(storPanelWidth({innerWidth:1920,innerHeight:500,chrome:136,size}),340);
 // Smalt vindu: resten av siden skal fortsatt synes (240 px holdes av).
 assert.equal(storPanelWidth({innerWidth:800,innerHeight:1400,chrome:136,size}),560);
 // Liggende telefon gir bredere panel.
 assert.equal(storPanelWidth({innerWidth:3000,innerHeight:1080,chrome:136,size:{width:812,height:375}}),2071);
});
