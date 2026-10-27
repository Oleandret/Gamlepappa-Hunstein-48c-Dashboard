import test from 'node:test';import assert from 'node:assert/strict';
import {buildActionPlan,priceStats} from '../../client/src/lib/actionPlan.js';
const now=Date.parse('2026-10-27T18:30:00+01:00'),H=3600000,day0=Date.parse('2026-10-27T00:00:00+01:00');
const prices=Array.from({length:24},(_,h)=>({start:day0+h*H,end:day0+(h+1)*H,value:h>=17&&h<=19?2:h>=21?0.2:0.8}));
const row=(id,name,w,room='Stue',quality='measured')=>({id,name,room,power:{value:w,quality}});
const devices={tv:{class:'tv',capabilitiesObj:{onoff:{value:true}}},lamp:{class:'light',capabilitiesObj:{onoff:{value:true}}},fridge:{class:'socket',capabilitiesObj:{onoff:{value:true}}},deco:{class:'socket',capabilitiesObj:{onoff:{value:true}}},sb:{class:'socket',capabilitiesObj:{onoff:{value:false}}},ch:{class:'socket',capabilitiesObj:{onoff:{value:false}}},oven:{class:'oven'},th:{name:'Stue termostat',class:'thermostat',capabilitiesObj:{target_temperature:{value:21}}},old:{class:'light',capabilitiesObj:{onoff:{value:true}}}};
const rows=[row('tv','TV stue',120),row('lamp','Taklampe',40),row('fridge','Kjøleskap',90),row('deco','Deco ruter',8),row('sb','Stikkontakt TV-benk',4),row('ch','Lader-plugg',4),row('oven','Ovn',2500,'Kjøkken'),row('old','Gammel lampe',60,'Gang','stale'),{id:'th',name:'Stue termostat',room:'Stue',power:{value:null,quality:'missing'}}];
test('away plan lists only measured, non-critical, switched-on devices and is urgent when nobody is home',()=>{
 const plan=buildActionPlan({rows,devices,presence:{known:true,anyoneHome:false},prices,now});
 const away=plan.find(a=>a.id==='away-off');assert.ok(away.urgent);assert.equal(plan[0].urgent,true);
 assert.deepEqual(away.devices.map(d=>d.name),['TV stue','Taklampe']);assert.equal(away.kwhPerHour,0.16);assert.equal(away.krPerHour,0.32);
 const home=buildActionPlan({rows,devices,presence:{known:true,anyoneHome:true},prices,now}).find(a=>a.id==='away-off');assert.ok(!home.urgent);assert.match(home.title,/huset er tomt/);
});
test('standby, price window, heating and big consumers',()=>{
 const plan=buildActionPlan({rows,devices,presence:{known:false},prices,now});
 const sb=plan.find(a=>a.id==='standby');assert.deepEqual(sb.devices.map(d=>d.name),['Stikkontakt TV-benk']);assert.equal(sb.kwhPerDay,0.1);
 const shift=plan.find(a=>a.id==='shift');assert.ok(shift.urgent);assert.equal(new Date(shift.window.start).getTime(),day0+21*H);assert.equal(shift.krPerKwh,1.8);
 assert.equal(plan.find(a=>a.id==='heat-away').devices.length,1);
 assert.deepEqual(plan.find(a=>a.id==='big').devices.map(d=>d.name),['Ovn']);
});
test('no prices and no data give an empty, honest plan',()=>{
 assert.equal(priceStats([]),null);
 assert.deepEqual(buildActionPlan({rows:[],devices:{},presence:{known:false},prices:[],now}),[]);
});
test('steady loads with older source time still count, unavailable or very old do not',()=>{
 const at=now-2*H;const r=(id,name,w,extra={})=>({id,name,room:'Stue',power:{value:w,quality:'stale',at,...extra}});
 const dv={a:{class:'tv',capabilitiesObj:{onoff:{value:true}}},b:{class:'tv',available:false,capabilitiesObj:{onoff:{value:true}}},c:{class:'tv',capabilitiesObj:{onoff:{value:true}}}};
 const plan=buildActionPlan({rows:[r('a','TV 1',100),r('b','TV 2',100),r('c','TV 3',100,{at:now-7*H})],devices:dv,presence:{known:false},prices:[],now});
 assert.deepEqual(plan.find(x=>x.id==='away-off').devices.map(d=>d.name),['TV 1']);
});
