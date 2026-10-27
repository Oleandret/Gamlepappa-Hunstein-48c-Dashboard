import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {bucketize,heatpumpSeries,readHeatpumpRecords,roomSeries,RANGES} from '../lib/temperatureHistory.js';
test('bucketize averages per bucket, keeps gaps and skips invalid values',()=>{
 assert.deepEqual(bucketize([{at:0,value:20},{at:1000,value:22},{at:5000,value:NaN},{at:10000,value:18}],5000),[{at:0,value:21},{at:10000,value:18}]);
});
test('heat pump series keep only °C, drop sentinel and enum values, one series per parameter',()=>{
 const recs=[{recordedAt:0,points:[{parameterId:40008,parameterName:'Tur',parameterUnit:'°C',value:35},{parameterId:1,parameterName:'Kompressor',parameterUnit:'Hz',value:50},{parameterId:2,parameterName:'Ugyldig',parameterUnit:'°C',value:-32768},{parameterId:3,parameterName:'Modus',parameterUnit:'°C',value:1,enumLabel:'Auto'}]},{recordedAt:60000,points:[{parameterId:40008,parameterName:'Tur',parameterUnit:'°C',value:37}]}];
 const s=heatpumpSeries(recs,3600000);assert.deepEqual(s.map(x=>[x.id,x.name,x.points]),[['40008','Tur',[{at:0,value:36}]]]);
});
test('heat pump records: only files in window, missing directory is empty',async()=>{
 assert.deepEqual(await readHeatpumpRecords('/does/not/exist',0),{records:[],startedAt:null});
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'temp-hist-'));try{
  await fs.writeFile(path.join(dir,'sample-1000000000000-aaaaaaaa.json'),JSON.stringify({recordedAt:1000000000000,points:[]}));
  await fs.writeFile(path.join(dir,'sample-2000000000000-bbbbbbbb.json'),JSON.stringify({recordedAt:2000000000000,points:[]}));
  await fs.writeFile(path.join(dir,'sample-2000000000001-cccccccc.json'),'{broken');
  const r=await readHeatpumpRecords(dir,1500000000000);assert.equal(r.records.length,1);assert.equal(r.startedAt,1000000000000);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('room series group by device with zone names; query is parameterised',async()=>{
 let seen;const q=async(sql,params)=>{seen={sql,params};return {rows:[{device_id:'a',name:'Stue sensor',zone:'z',bucket:'3600',value:'21.456'},{device_id:'a',name:'Stue sensor',zone:'z',bucket:'7200',value:'22'}]};};
 const s=await roomSeries(q,7,RANGES[7]*60000,{z:{name:'Stue'}});
 assert.deepEqual(s,[{id:'a',name:'Stue sensor',zone:'Stue',unit:'°C',points:[{at:3600000,value:21.46},{at:7200000,value:22}]}]);
 assert.deepEqual(seen.params,[7,3600]);assert.ok(!seen.sql.includes('${'));
});
