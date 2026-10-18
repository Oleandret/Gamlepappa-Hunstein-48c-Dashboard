import { capValue } from './validation.js';
import { powerObservation } from './energySummary.js';
export function roomOverview(devices, zones, quality = 'live', updatedAt = null) {
  return Object.values(zones || {}).map(zone => {
    const members = Object.values(devices || {}).filter(d => d.zone === zone.id);
    const readings = cap => members.filter(d=>d.available !== false && Number.isFinite(capValue(d,cap))).map(d=>({deviceId:d.id,name:d.name,value:capValue(d,cap)}));
    return {id:zone.id,name:zone.name,quality,updatedAt,devices:members.length,
      lightsOn:members.filter(d=>d.class==='light' && capValue(d,'onoff')===true).length,
      offline:members.filter(d=>d.available===false).map(d=>({id:d.id,name:d.name})),
      temperature:readings('measure_temperature'), humidity:readings('measure_humidity'), power:readings('measure_power'),
      alarms:members.flatMap(d=>['alarm_smoke','alarm_water','alarm_battery'].filter(cap=>capValue(d,cap)===true).map(cap=>({deviceId:d.id,name:d.name,capability:cap}))) };
  });
}
export function houseBrief(rooms, quality) {
  if (quality !== 'live') return [{severity:'warning',text:'Status er ikke fersk. Huset kan ikke vurderes nå.'}];
  const items=rooms.flatMap(r=>[
    ...r.offline.map(d=>({severity:'warning',text:`${d.name} i ${r.name} er utilgjengelig`,deviceId:d.id})),
    ...r.alarms.map(d=>({severity:'warning',text:`${d.name}: ${d.capability}`,deviceId:d.deviceId})),
    ...r.temperature.filter(t=>t.value<5 || t.value>30).map(t=>({severity:'info',text:`${t.name} rapporterer ${t.value} °C`,deviceId:t.deviceId}))
  ]);
  return items.length ? items : [{severity:'info',text:'Ingen avvik i de tilgjengelige avlesningene. Dette er ikke en bekreftelse på at alle systemer er trygge.'}];
}
export function energyDetective(devices, now=Date.now()) {
  const measured=Object.values(devices || {}).flatMap(d=>{
    const result=powerObservation(d,now);
    return result.watts===null?[]:[{deviceId:d.id,name:d.name,watts:result.watts,basis:'measured',sourceAt:result.sourceAt}];
  }).sort((a,b)=>b.watts-a.watts);
  return {measured,estimated:[],note:'Effekt med kildetid innen 15 minutter og kjent W/kW-enhet. Eldre eller utilgjengelige målinger utelates. Målerne kan overlappe og summeres ikke til husforbruk.'};
}

export function learnedRoutines(events) {
  const groups=new Map();
  for (const e of events) {
    if (e.kind!=='transition' || e.capability!=='onoff' || e.value!==true || e.prev_value==null) continue;
    const parts=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(e.ts)).map(x=>[x.type,x.value]));
    const key=`${e.device_id}:${parts.hour}`;
    const g=groups.get(key) || {deviceId:e.device_id,name:e.device_name,hour:Number(parts.hour),dates:new Set(),eventIds:[]};
    g.dates.add(`${parts.year}-${parts.month}-${parts.day}`);g.eventIds.push(e.id);groups.set(key,g);
  }
  return [...groups.values()].filter(g=>g.dates.size>=3).map(g=>({deviceId:g.deviceId,name:g.name,hour:g.hour,observedDays:g.dates.size,eventIds:g.eventIds.slice(0,20),enabled:false,
    suggestion:`Vurder en rutine for ${g.name} rundt kl. ${g.hour}. Observert på ${g.dates.size} ulike dager.`,
    limitation:'Tidspunkt er tidspunktet for avlesning, ikke nødvendigvis hendelsen. Forslaget utfører ingen handling.'})).sort((a,b)=>b.observedDays-a.observedDays).slice(0,20);
}
export function matches(trigger,event) {
  if (event.prev_value == null || trigger?.type!=='device_change' || trigger.deviceId!==event.device_id || trigger.capability!==event.capability) return false;
  if (trigger.condition==='changes') return JSON.stringify(event.value)!==JSON.stringify(event.prev_value);
  if (trigger.condition==='becomes_true') return event.value===true && event.prev_value!==true;
  if (trigger.condition==='becomes_false') return event.value===false && event.prev_value!==false;
  return trigger.condition==='equals' && JSON.stringify(trigger.value)===JSON.stringify(event.value);
}
export function simulate(flow,events) {
  let last=-Infinity;const matchesOut=[];
  for (const e of [...events].sort((a,b)=>Date.parse(a.ts)-Date.parse(b.ts))) {
    const ts=Date.parse(e.ts);
    if (matches(flow.trigger,e) && ts-last>=Math.max(1,flow.min_interval_seconds || 5)*1000) {last=ts;matchesOut.push({eventId:e.id,at:e.ts,actions:flow.actions});}
  }
  return {dryRun:true,executed:0,matches:matchesOut,count:matchesOut.length,
    limitation:'Simulering av observerte hendelser. Polling kan ha mistet korte hendelser. Handlingene simulerer ikke nye sensorhendelser eller fysiske konsekvenser.'};
}
export function safeSceneActions(actions, devices) {
  if (!Array.isArray(actions) || !actions.length || actions.length>20) throw new Error('Velg 1–20 lys');
  for(const a of actions) {
    const d=devices[a.deviceId];
    if(d?.class!=='light' || !['onoff','dim'].includes(a.capability)) throw new Error('Stemninger støtter bare lys: av/på og dimming');
  }
  const keys=actions.map(a=>`${a.deviceId}:${a.capability}`);
  if(new Set(keys).size!==keys.length) throw new Error('Samme lys/capability er valgt flere ganger');
  return actions;
}
