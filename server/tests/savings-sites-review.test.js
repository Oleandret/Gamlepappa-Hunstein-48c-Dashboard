import test from 'node:test';
import assert from 'node:assert/strict';
import {siteRows,overview,inventory} from '../../client/src/lib/savingsModel.js';

const now=Date.parse('2026-10-17T10:00:00Z');
const cap=value=>({value,lastUpdated:new Date(now).toISOString()});
const device=(name,power)=>({name,class:'sensor',zone:'room',available:true,capabilitiesObj:{measure_power:cap(power),meter_power:cap(20)}});
const rows=()=>inventory({'hoved-hunstein':device('Pulse Hunstein 48C',4000),'varmepumpe':device('NIBE F1255',1500),'hoved-halsaneset':device('Pulse Halsaneset',900),'panelovn':device('Panelovn hytta',800)},{room:{name:'Stue'}},'live',now);
const TILDELT={'hoved-hunstein':'hunstein','varmepumpe':'hunstein','hoved-halsaneset':'halsaneset','panelovn':'halsaneset'};

test('målere fra et annet anlegg utelates fra utvalg og totaler',()=>{
  const h=siteRows(rows(),'hunstein',TILDELT);
  assert.deepEqual(h.map(r=>r.id),['hoved-hunstein','varmepumpe']);
  const s=overview(h,'hoved-hunstein',h.map(r=>r.id));
  assert.equal(s.total,4000);assert.equal(s.subtotal,1500);assert.equal(s.residual,2500);assert.equal(s.measured,2);
  const hals=siteRows(rows(),'halsaneset',TILDELT);
  assert.deepEqual(hals.map(r=>r.id),['hoved-halsaneset','panelovn']);
  assert.equal(overview(hals,'hoved-halsaneset',hals.map(r=>r.id)).total,900);
  // Hovedmåleren på det andre anlegget er ikke engang synlig som undermåler her.
  assert.equal(overview(h,'hoved-hunstein',['hoved-halsaneset','panelovn']).subtotal,null);
  assert.equal(overview(rows(),'hoved-hunstein',[]).measured,4);
});

test('ukjent anleggs-id og ukjent eller manglende tilordning utelates',()=>{
  const r=rows();
  for(const site of ['travbaneveien','','HUNSTEIN',null,undefined,0,['hunstein']])assert.deepEqual(siteRows(r,site,TILDELT),[]);
  assert.deepEqual(siteRows(r,'hunstein'),[]);
  const delvis={...TILDELT,varmepumpe:'travbaneveien',panelovn:undefined,'hoved-halsaneset':null};
  assert.deepEqual(siteRows(r,'hunstein',delvis).map(x=>x.id),['hoved-hunstein']);
  assert.deepEqual(siteRows(r,'halsaneset',delvis),[]);
  // Tomt utvalg gir null, ikke 0 W.
  assert.equal(overview(siteRows(r,'halsaneset',delvis),'hoved-halsaneset',[]).total,null);
});

test('navn og rom som peker på anlegget gir ingen tilordning',()=>{
  const navnerader=inventory({m1:device('Halsaneset hovedmåler',900),m2:device('Hunstein 48C',4000)},{room:{name:'Halsaneset'}},'live',now);
  assert.deepEqual(siteRows(navnerader,'halsaneset',{}),[]);
  assert.deepEqual(siteRows(navnerader,'hunstein',{}),[]);
  // Eksplisitt tilordning vinner over navnet, i begge retninger.
  assert.deepEqual(siteRows(navnerader,'hunstein',{m2:'hunstein'}).map(r=>r.id),['m2']);
  assert.deepEqual(siteRows(navnerader,'halsaneset',{m2:'hunstein'}),[]);
  assert.deepEqual(siteRows(navnerader,'halsaneset',{m2:'halsaneset'}).map(r=>r.id),['m2']);
});

test('prototypearvet tilordning teller ikke som brukerbekreftet',()=>{
  const r=rows();
  assert.deepEqual(siteRows(r,'hunstein',Object.create({'hoved-hunstein':'hunstein','varmepumpe':'hunstein'})),[]);
  const blandet=Object.assign(Object.create({varmepumpe:'hunstein'}),{'hoved-hunstein':'hunstein'});
  assert.deepEqual(siteRows(r,'hunstein',blandet).map(x=>x.id),['hoved-hunstein']);
  assert.equal(overview(siteRows(r,'hunstein',blandet),'hoved-hunstein',['varmepumpe']).subtotal,null);
  for(const key of ['constructor','toString','valueOf','hasOwnProperty','__proto__','isPrototypeOf'])
    assert.deepEqual(siteRows(inventory({[key]:device(key,100)},{},'live',now),'hunstein',{}),[]);
});
