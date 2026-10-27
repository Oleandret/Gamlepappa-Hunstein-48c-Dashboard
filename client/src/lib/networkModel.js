export const FRESH_MS = 5 * 60 * 1000;
export function networkAge(value, now=Date.now()) {
 const t=typeof value==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN;
 return Number.isFinite(t)&&t<=now+5000?Math.max(0,now-t):null;
}
export function deviceState(device, snapshot, now=Date.now()) {
 // Hjemmenett-monitoren gir bare «sett siste 15 min», ikke tidsstempel per enhet. Gjelder bare mens selve snapshotet er ferskt.
 if(device?.source==='hjemmenett'){const sa=networkAge(snapshot?.observed_at,now);if(sa===null)return 'unknown';if(sa>FRESH_MS)return 'stale';return device.status==='observed'?'observed':'stale';}
 const age=networkAge(device?.last_seen,now);
 const snapshotAge=networkAge(snapshot?.observed_at,now);
 const collectorAge=networkAge(snapshot?.collector?.last_seen,now);
 if(age===null||device?.status==='unknown'||!['neighbor-cache','deco'].includes(device?.source))return 'unknown';
 if(snapshotAge===null||snapshotAge>FRESH_MS||device?.status==='stale'||age>FRESH_MS||snapshot?.collector?.status!=='ok'||collectorAge===null||collectorAge>FRESH_MS)return 'stale';
 return device?.status==='observed'?'observed':'unknown';
}
export function observedLinks(snapshot, now=Date.now()) {
 const ids=new Set((snapshot?.devices||[]).map(d=>d.id));
 return (snapshot?.links||[]).filter(l=>ids.has(l.source_id)&&ids.has(l.target_id)&&l.source_id!==l.target_id&&l.source&&networkAge(l.observed_at,now)!==null&&networkAge(l.observed_at,now)<=FRESH_MS);
}
export function historyPoints(snapshot, now=Date.now()) {
 return (snapshot?.history||[]).filter(p=>networkAge(p.at,now)!==null&&Number.isInteger(p.observed_devices)&&p.observed_devices>=0).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
}
export const stateLabel={observed:'Nylig observert',stale:'Eldre observasjon',unknown:'Ukjent'};
export const sourceLabel={'neighbor-cache':'Lokalt adressehurtiglager',deco:'Deco',manual:'Manuell registrering',hjemmenett:'Hjemmenett-monitor'};
/** Hva «nylig» betyr for dette snapshotet, i minutter. */
export const recentMinutes=snapshot=>Number.isInteger(snapshot?.recent_minutes)&&snapshot.recent_minutes>0?snapshot.recent_minutes:5;

export function collectorReporting(snapshot, now=Date.now()) {
 const age=networkAge(snapshot?.collector?.last_seen,now), sourceAge=networkAge(snapshot?.observed_at,now);
 return snapshot?.collector?.status==='ok'&&age!==null&&age<=FRESH_MS&&sourceAge!==null&&sourceAge<=FRESH_MS;
}
