// Observe existing Homey snapshots only; never creates a poll or device command.
// Logger bevegelse/tilstedeværelse og sensorhendelser (dør/vindu, røyk, vann, lås, garasjeport) for Aktivitet.
export const TRACKED_CAPS=/^(alarm_motion|alarm_presence|alarm_contact|alarm_smoke|alarm_water|alarm_co|locked|garagedoor_closed)(\.|$)/;
export const MOTION_CAPS=/^(alarm_motion|alarm_presence)(\.|$)/;
export function createMotionHistory({load,save,now=Date.now}) {
 let queue=Promise.resolve();
 function observe(devices){const task=queue.catch(()=>{}).then(async()=>{
  const t=now(),state=await load()||{startedAt:t,last:{},events:[]};let changed=false;
  for(const [id,d]of Object.entries(devices)){
   if(/tesla/i.test(`${d.name} ${d.driverUri}`))continue;
   const caps=d.capabilitiesObj||{};
   for(const [cap,p]of Object.entries(caps)){
    if(!TRACKED_CAPS.test(cap)||typeof p?.value!=='boolean')continue;
    const key=`${id}:${cap}`,at=typeof p.lastUpdated==='number'?p.lastUpdated:Date.parse(p.lastUpdated),sourceAt=Number.isFinite(at)?at:null,prev=state.last[key];
    // Out-of-order reports are ignored. Poll observation time is never called event time.
    if(prev?.sourceAt&&sourceAt&&sourceAt<prev.sourceAt)continue;
    if(prev&&prev.value===p.value){if(sourceAt&&sourceAt!==prev.sourceAt){state.last[key]={value:p.value,sourceAt};changed=true;}continue;}
    const row={id:key+':'+t,deviceId:id,name:String(d.name||id).slice(0,200),zone:d.zone||null,capability:cap,value:p.value,sourceAt,observedAt:t,kind:prev?'transition':'initial',site:'unverified'};
    state.last[key]={value:p.value,sourceAt};state.events.push(row);changed=true;
   }
  }
  const beforeRetention=state.events.length;
  state.events=state.events.filter(e=>e.observedAt>t-7*86400000).slice(-2000);if(state.events.length!==beforeRetention)changed=true;
  const activeIds=new Set(Object.keys(devices));for(const key of Object.keys(state.last))if(!activeIds.has(key.split(':')[0])){delete state.last[key];changed=true;}
  if(changed)await save(state);
 });queue=task;return task;}
 return {observe,read:async()=>{await queue.catch(()=>{});return await load()||{startedAt:null,events:[]};}};
}
