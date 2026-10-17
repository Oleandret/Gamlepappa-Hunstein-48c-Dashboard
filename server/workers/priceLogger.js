import path from 'node:path';
import {getNamespace,configPath} from '../lib/configStore.js';
import {createPriceArchive,normalizePrices,priceUrl,localDate} from '../lib/spotPrices.js';
export function createPriceLogger({binding,archive,fetchImpl=fetch,now=Date.now}) {
 const state={enabled:false,reason:'Prisområde må bekreftes for Hunstein',last:null,retryAt:0,failures:0};let pending;
 async function run(){
  if(pending)return pending;
  if(now()<state.retryAt)return state;
  pending=(async()=>{
   const b=await binding();
   if(b?.site!=='hunstein'||!/^NO[1-5]$/.test(b.area)||!b.deviceId||!b.evidence||!b.verifiedAt){state.enabled=false;return state;}
   state.enabled=true;state.reason=null;
   // Three dates per hour: today, published tomorrow, one bounded historical day.
   const anchor=Date.parse(`${localDate(now())}T12:00:00Z`);
   const backDay=1+Math.floor(now()/3600000)%7;
   for(const offset of [0,1,-backDay]) {
    const date=localDate(anchor+offset*86400000);
    try {
     const r=await fetchImpl(priceUrl(date,b.area),{signal:AbortSignal.timeout(15000),redirect:'error',headers:{Accept:'application/json'}});
     if(r.status===404){state.last={date,status:'not-published-or-missing',at:now()};continue;}
     if(!r.ok){const e=Error('Price source unavailable');const retry=r.headers.get('retry-after');e.retryMs=/^\d+$/.test(retry||'')?Number(retry)*1000:Math.max(0,Date.parse(retry)-now());throw e;}
     const text=await r.text();if(text.length>131072)throw Error('Oversized price response');
     const data=normalizePrices(JSON.parse(text),{date,area:b.area,fetchedAt:now()});
     const saved=await archive.save(data);state.last={date,status:data.complete?'complete':'incomplete',at:now(),...saved};
    }catch(e){state.failures++;state.reason='Priskilden eller lagringen er utilgjengelig';state.retryAt=now()+Math.max(Math.min(24*3600000,3600000*2**Math.min(state.failures-1,5)),Math.min(7*86400000,e.retryMs||0));return state;}
   }
   state.failures=0;state.retryAt=now()+3600000;return state;
  })().finally(()=>{pending=null;});return pending;
 }
 return {run,state};
}
const logger=createPriceLogger({binding:()=>getNamespace('_verifiedPriceArea'),archive:createPriceArchive({dir:path.join(path.dirname(configPath()),'spot-prices')})});
export const priceLogStatus=logger.state;
let timer,stopped=true;
export function startPriceLogger(){if(!stopped)return;stopped=false;const tick=async()=>{try{await logger.run();}catch{priceLogStatus.reason='Prisoppsett kunne ikke leses';}if(!stopped){timer=setTimeout(tick,3600000);timer.unref();}};timer=setTimeout(tick,30000);timer.unref();}
export function stopPriceLogger(){stopped=true;clearTimeout(timer);}
