import {buildInventory} from './inventory.js';
export function createInventoryReader(client,{now=Date.now,maxAge=300000}={}){
 return async(full=false)=>{
  const names=['devices','zones','flows'],readers=[client.listDevices,client.listZones,client.listFlows];
  const results=await Promise.allSettled(readers.map(r=>r()));const values={},sources={};
  for(let i=0;i<names.length;i++){const name=names[i],result=results[i],snapshot=readers[i].snapshot?.(),time=snapshot?.updatedAt;
   if(result.status==='fulfilled'){values[name]=result.value;sources[name]={quality:'live',updatedAt:time??now()};}
   else {const usable=snapshot?.value!==undefined&&Number.isFinite(time)&&now()-time<=maxAge&&time<=now();if(usable)values[name]=snapshot.value;sources[name]={quality:usable?'stale':'unavailable',updatedAt:time??null,retryAt:snapshot?.retryAt||null,error:result.reason?.upstreamStatus?`Homey HTTP ${result.reason.upstreamStatus}`:result.reason?.name==='TimeoutError'?'Tidsavbrudd':'Lesing feilet'};}
  }
  const available=names.every(n=>sources[n].quality!=='unavailable'),quality=!available?'unavailable':names.some(n=>sources[n].quality==='stale')?'stale':'live';
  const times=names.map(n=>sources[n].updatedAt).filter(Number.isFinite);
  if(!available)return {status:503,body:{error:'Full kartlegging mangler datakilder',sources,_quality:quality,_updatedAt:times.length?new Date(Math.min(...times)).toISOString():null}};
  return {status:200,body:{...buildInventory(values),...(full?{raw:values}:{}),sources,_quality:quality,_updatedAt:new Date(Math.min(...times)).toISOString()}};
 };
}
