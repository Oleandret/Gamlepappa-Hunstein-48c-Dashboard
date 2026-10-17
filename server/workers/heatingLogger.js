import path from 'node:path';
import {createHeatingHistory} from '../lib/heatingHistory.js';
import {myuplinkConfig,myuplinkOAuth} from '../lib/myuplinkOAuth.js';
import {connectedRead} from '../routes/heating.js';
const INTERVAL=15*60*1000;
let timer, running=false, stopped=true;
export const heatingLogStatus={enabled:false,intervalMs:INTERVAL,retentionDays:30,maxBytes:64*1024*1024,last:null,error:null};
export function startHeatingLogger() {
  if(!stopped)return;
  const cfg=myuplinkConfig();if(!cfg)return;
  stopped=false;heatingLogStatus.enabled=true;
  const history=createHeatingHistory({dir:path.join(path.dirname(cfg.file),'../heating-history')});
  async function tick() {
    if(stopped||running)return;running=true;
    try {
      const before=await myuplinkOAuth.record();
      if(before?.deviceId) {
        const sample=await connectedRead(),after=await myuplinkOAuth.record();
        if(after?.deviceId===before.deviceId&&after?.systemId===before.systemId)heatingLogStatus.last=await history.append(sample,{deviceId:before.deviceId,systemId:before.systemId});
      }
      heatingLogStatus.error=null;
    }catch{heatingLogStatus.error='Historikk kunne ikke lagres; kontroller disk og tilgang';console.warn('[heating-history] read or storage unavailable');}
    finally{running=false;if(!stopped){timer=setTimeout(tick,INTERVAL);timer.unref();}}
  }
  timer=setTimeout(tick,20000);timer.unref();
}
export function stopHeatingLogger(){stopped=true;heatingLogStatus.enabled=false;clearTimeout(timer);}
