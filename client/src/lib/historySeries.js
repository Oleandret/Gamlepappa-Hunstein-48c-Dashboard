const oslo=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
export function pulseSeries(rows=[]){const power=[],energy=[];let previous=null;for(const r of rows){const at=Date.parse(r.ts),v=r.value;if(!Number.isFinite(at)||typeof v!=='number'||!Number.isFinite(v))continue;if(r.capability==='measure_power')power.push({at,value:v/1000,source:r.time_source});if(r.capability==='meter_power'){const dt=previous?at-previous.at:0;const valid=previous&&dt>0&&dt<=1800000&&oslo(at)===oslo(previous.at)&&v>=previous.value&&r.time_source==='device'&&previous.source==='device';energy.push({at,value:valid?v-previous.value:null,minutes:valid?dt/60000:null});previous={at,value:v,source:r.time_source};}}return {power,energy};}
export function withGaps(points,gapMs=1800000){const out=[];for(const p of points){const last=out.at(-1);if(last&&p.at-last.at>gapMs)out.push({at:last.at+1,value:null});out.push(p);}return out;}
/** Registrert energi summert per time (bare gyldige økninger). Timer uten gyldig avlesning utelates. */
export function hourlyEnergy(energy=[]){const hours=new Map();for(const p of energy){if(!Number.isFinite(p.value))continue;const h=Math.floor(p.at/3600000)*3600000;hours.set(h,(hours.get(h)||0)+p.value);}return [...hours].sort((a,b)=>a[0]-b[0]).map(([at,value])=>({at,value:Math.round(value*1000)/1000}));}
/** Pene tidsakse-merker: runde timer/døgn i lokal tid, høyst `target` merker over perioden. */
export function timeTicks(min,max,target=7){
 if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min)return undefined;
 const hourSteps=[1,2,3,4,6,12],daySteps=[1,2,7,14,30,61],span=(max-min)/3600000;
 const h=hourSteps.find(x=>span/x<=target),days=h?null:daySteps.find(x=>span/24/x<=target)||30;
 const d=new Date(min);
 if(h){d.setMinutes(0,0,0);d.setHours(d.getHours()-d.getHours()%h);}else d.setHours(0,0,0,0);
 const out=[];
 for(let guard=0;guard<500&&d.getTime()<=max;guard++){if(d.getTime()>=min)out.push(d.getTime());if(h)d.setHours(d.getHours()+h);else d.setDate(d.getDate()+days);}
 return out;
}
