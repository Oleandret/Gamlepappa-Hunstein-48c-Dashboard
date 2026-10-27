import {useEffect,useMemo,useRef,useState} from 'react';
import {Radio,Search,Clock,RefreshCw,ShieldCheck,Sparkles,AlertTriangle,Lightbulb,CheckCircle2,X} from 'lucide-react';
import {ResponsiveContainer,AreaChart,Area,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid} from 'recharts';
import {apiFetch} from '../lib/api.js';
import {collectorReporting,deviceState,observedLinks,historyPoints,stateLabel,sourceLabel,recentMinutes} from '../lib/networkModel.js';
import {NET_CATEGORIES,NET_CATEGORY} from '../lib/networkDevices3d.js';

const time=t=>t&&Number.isFinite(Date.parse(t))?new Date(t).toLocaleString('nb-NO',{timeZone:'Europe/Oslo'}):'Ukjent';
const color={observed:'#3ddc84',stale:'#ffbf69',unknown:'#9aa9bf'};
const eventNames={'first_in_snapshot_window':'Først sett i historikkvindu','observed':'Observert','stale':'Observasjon foreldet','unknown':'Status ukjent','new-device':'Ny enhet observert','address-changed':'Adresse endret','returned':'Observert igjen'};
const LEVEL={advarsel:{Icon:AlertTriangle,cls:'text-nx-amber',border:'#ffbf6955'},tips:{Icon:Lightbulb,cls:'text-nx-cyan',border:'#22e6ff40'},ok:{Icon:CheckCircle2,cls:'text-nx-green',border:'#3ddc8440'}};
const SORTS={status:'Status',name:'Navn',data:'Data 24 t',room:'Rom'};
const collator=new Intl.Collator('nb',{sensitivity:'base',numeric:true});
const stateOrder={observed:0,stale:1,unknown:2};

function Badge({state}){return <span className="text-[11px] rounded-full px-2 py-0.5 border whitespace-nowrap" style={{color:color[state],borderColor:color[state]+'55',background:color[state]+'0d'}}>{stateLabel[state]}</span>;}
function Empty({children}){return <p className="rounded-xl border border-dashed border-nx-line p-6 text-sm text-nx-mute">{children}</p>;}
function Kpi({Icon,label,value,tone}){return <div className="rounded-2xl border border-nx-line bg-black/15 p-4"><Icon size={18} className={tone||'text-nx-cyan'} style={{marginBottom:12}}/><p className="text-xl font-semibold break-words">{value}</p><p className="text-xs text-nx-mute mt-1">{label}</p></div>;}

function ConnectionMap({devices,links}) {
 const ids=[...new Set(links.flatMap(l=>[l.source_id,l.target_id]))].slice(0,24);
 const points=Object.fromEntries(ids.map((id,i)=>[id,{x:240+170*Math.cos(i/ids.length*Math.PI*2),y:145+105*Math.sin(i/ids.length*Math.PI*2)}]));
 return <><svg viewBox="0 0 480 300" className="w-full max-h-72 mb-4" role="img" aria-label="Skjematisk kart over dokumenterte forbindelser"><title>Observerte forbindelser. Plasseringene er skjematiske, ikke geografiske.</title>{links.filter(l=>points[l.source_id]&&points[l.target_id]).map((l,i)=><line key={i} x1={points[l.source_id].x} y1={points[l.source_id].y} x2={points[l.target_id].x} y2={points[l.target_id].y} stroke="#22e6ff" strokeOpacity=".25" strokeWidth="2"/>)}{ids.map(id=>{const d=devices.find(d=>d.id===id),p=points[id];return <g key={id}><circle cx={p.x} cy={p.y} r="20" fill="#15243a" stroke={color[d.state]}/><circle cx={p.x} cy={p.y} r="5" fill={color[d.state]}/><text x={p.x} y={p.y+34} textAnchor="middle" fill="#cbd5e1" fontSize="10">{d.label.slice(0,20)}</text></g>;})}</svg><p className="text-xs text-nx-mute mb-3">Skjematisk plassering, ikke rom eller fysisk avstand.</p></>;
}

/** Hva én enhet har brukt nettet til (hjemmenett-monitoren). Bare for administrator. */
function DeviceActivity({id}){
 const [a,setA]=useState(null),[err,setErr]=useState('');
 useEffect(()=>{const c=new AbortController();setA(null);setErr('');apiFetch(`/api/network/devices/${encodeURIComponent(id)}/activity`,{signal:c.signal}).then(async r=>{if(r.status===403)throw Error('Tjenestebruk vises bare for administrator.');if(!r.ok)throw Error('Aktiviteten kunne ikke leses.');setA(await r.json());}).catch(e=>{if(e.name!=='AbortError')setErr(e.message);});return()=>c.abort();},[id]);
 if(err)return <p className="text-xs text-nx-mute mt-4">{err}</p>;
 if(!a)return <p className="text-xs text-nx-mute mt-4">Henter aktivitet…</p>;
 if(!a.connected||!a.found)return <p className="text-xs text-nx-mute mt-4">Ingen aktivitetsdata for enheten.</p>;
 const max=Math.max(1,...a.services.map(s=>s.lookups||0));
 return <div className="grid lg:grid-cols-2 gap-5 mt-5">
  <div><h4 className="text-xs uppercase tracking-[.16em] text-nx-mute mb-3">Mest brukte tjenester · 7 døgn</h4>{!a.services.length?<p className="text-sm text-nx-mute">Ingen tjenester registrert.</p>:<ul className="space-y-1.5">{a.services.map(s=><li key={s.service} className="text-sm"><div className="flex justify-between gap-3"><span className="truncate">{s.service}{s.category&&<span className="text-nx-mute text-xs"> · {s.category}</span>}</span><span className="font-mono text-xs text-nx-mute">{s.lookups??''}</span></div><div className="h-1.5 rounded-full bg-nx-line/40 mt-1"><div className="h-full rounded-full bg-nx-cyan/70" style={{width:`${Math.max(3,((s.lookups||0)/max)*100)}%`}}/></div></li>)}</ul>}
   {a.background.length>0&&<p className="text-xs text-nx-mute mt-3">I bakgrunnen: {a.background.map(s=>s.service).join(', ')}.</p>}</div>
  <div><h4 className="text-xs uppercase tracking-[.16em] text-nx-mute mb-3">Data per time · siste døgn</h4>{a.data24h&&<p className="text-sm mb-2">Lastet ned <strong>{a.data24h.downloaded}</strong> · sendt <strong>{a.data24h.sent}</strong></p>}{a.hourly.filter(h=>h.bytes).length<2?<p className="text-sm text-nx-mute">For lite trafikk til en graf.</p>:<div className="h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={a.hourly.map(h=>({...h,mb:h.bytes?h.bytes/1e6:0}))} margin={{top:4,right:4,left:0,bottom:0}}><CartesianGrid vertical={false} stroke="#253247" strokeDasharray="2 6"/><XAxis dataKey="hour" tick={{fill:'#9aa9bf',fontSize:10}} tickLine={false} axisLine={false} minTickGap={16}/><YAxis tick={{fill:'#9aa9bf',fontSize:10}} tickLine={false} axisLine={false} width={40} tickFormatter={v=>`${Math.round(v)}`}/><Tooltip contentStyle={{background:'#101827',border:'1px solid #253247',borderRadius:12,fontSize:12}} formatter={(_v,_n,p)=>[p.payload.data,'Data']}/><Bar dataKey="mb" fill="#5aa9ff" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div>}<p className="text-[11px] text-nx-mute mt-2">MB per time. Tjenester er oppslag enheten gjør, ikke innhold eller fullstendig historikk. Enkeltoppslag med klokkeslett vises ikke.</p></div>
 </div>;
}

export function NetworkObservatory(){
 const [result,setResult]=useState(null),[overview,setOverview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[cats,setCats]=useState(()=>new Set(NET_CATEGORIES.map(c=>c.id))),[sort,setSort]=useState('status'),[selected,setSelected]=useState(null),[now,setNow]=useState(Date.now());
 useEffect(()=>{const c=new AbortController();load(c.signal);const timer=setInterval(()=>setNow(Date.now()),30000);return()=>{c.abort();clearInterval(timer);};},[]);
 async function load(signal){setBusy(true);setError('');try{const [r,o]=await Promise.all([apiFetch('/api/network/v1/snapshot',{signal}),apiFetch('/api/network/overview',{signal}).catch(()=>null)]);if(!r.ok)throw Error('Innsamlede nettverksdata kunne ikke leses.');setResult(await r.json());setOverview(o?.ok?await o.json():null);setNow(Date.now());}catch(e){if(e.name!=='AbortError'){setError(e.message);setResult(null);}}finally{if(!signal?.aborted)setBusy(false);}}
 const s=result?.snapshot,fromMonitor=s?.source==='hjemmenett-monitor'&&s?.recent_minutes,minutes=recentMinutes(s);
 const devices=useMemo(()=>(s?.devices||[]).map(d=>({...d,category:d.category||'other',state:deviceState(d,s,now)})),[s,now]);
 const counts=useMemo(()=>{const c={};for(const d of devices)c[d.category]=(c[d.category]||0)+1;return c;},[devices]);
 const visible=useMemo(()=>devices.filter(d=>(filter==='all'||d.state===filter)&&cats.has(d.category)&&[d.label,d.ip,d.mac,d.room,d.manufacturer].some(v=>String(v||'').toLowerCase().includes(query.toLowerCase())))
  .sort((a,b)=>sort==='name'?collator.compare(a.label,b.label):sort==='data'?(b.dataBytes??-1)-(a.dataBytes??-1):sort==='room'?collator.compare(a.room||'~',b.room||'~')||collator.compare(a.label,b.label):(stateOrder[a.state]-stateOrder[b.state])||collator.compare(a.label,b.label)),[devices,filter,cats,query,sort]);
 const groups=useMemo(()=>NET_CATEGORIES.map(c=>({...c,items:visible.filter(d=>d.category===c.id)})).filter(g=>g.items.length),[visible]);
 const links=observedLinks(s,now),history=historyPoints(s,now),detail=devices.find(d=>d.id===selected);
 const recent=devices.filter(d=>d.state==='observed').length;
 const ov=overview?.connected?overview:null;
 const topMax=Math.max(1,...(ov?.topData||[]).map(d=>d.bytes||0));
 const detailRef=useRef(null);
 useEffect(()=>{if(selected)detailRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[selected]);
 const toggleCat=id=>setCats(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});

 return <div className="space-y-5">
 <section className="panel p-5 sm:p-7 relative overflow-hidden" style={{background:'radial-gradient(ellipse at top right, #22e6ff13, transparent 65%), #101827'}}>
  <div className="flex justify-between gap-4 items-start"><div><p className="text-xs uppercase tracking-[.25em] text-nx-cyan">Nettverk · observatorium</p><h2 className="text-2xl sm:text-3xl font-semibold mt-3">Hjemmenettet, i ett blikk</h2><p className="text-nx-mute text-sm mt-3 max-w-2xl">Tekniske observasjoner, historikk og kilder. Ingen gjetting om hvem som er hjemme. Nylig betyr {fromMonitor?`sett på hjemmenettet siste ${minutes} minutter`:'siste fem minutter'}.</p></div><button className="chip flex gap-2 items-center shrink-0" onClick={()=>load()} disabled={busy} aria-label="Oppdater nettverksobservasjoner"><RefreshCw size={16} className={busy?'animate-spin':''}/><span className="hidden sm:inline">Oppdater</span></button></div>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
   <Kpi Icon={Radio} label="Nylig observert" value={s?`${recent} / ${devices.length}`:'—'}/>
   <Kpi Icon={Sparkles} label="Nye, ukjente enheter" value={ov?ov.newDevices.length:'—'} tone={ov?.newDevices.length?'text-nx-amber':undefined}/>
   <Kpi Icon={AlertTriangle} label="Advarsler i nettverket" value={ov?ov.findings.filter(f=>f.level==='advarsel').length:'—'} tone={ov?.findings.some(f=>f.level==='advarsel')?'text-nx-amber':undefined}/>
   <Kpi Icon={ShieldCheck} label="Innsamler" value={!s?'Ikke koblet':collectorReporting(s,now)?'Rapporterer':'Ukjent / eldre'}/>
  </div>
  <p className="text-xs text-nx-mute mt-4 flex gap-2 items-center"><Clock size={13}/> Kilde: {time(s?.observed_at)}{ov?.fetchedAt?` · innsikt ${time(ov.fetchedAt)}`:''}</p>
 </section>
 {error&&<p role="alert" className="panel p-4 text-nx-amber">{error} Ingen eldre tall presenteres som live.</p>}
 {!s&&<Empty>{busy?'Henter observasjoner…':result?.reason==='expired'?'Snapshot er utløpt og vises ikke. Ny innsamling er nødvendig.':result?.reason==='demo-isolation'?'Demomodus leser ikke lokale nettverkslogger.':result?.reason==='unavailable'?'Snapshot er utilgjengelig eller ugyldig. Kandidatlisten nedenfor er bevart, men er ikke live nettverksdata.':'Lokal innsamler er ikke koblet til denne visningen ennå. Kandidatlisten nedenfor er ikke en måling.'}</Empty>}
 {s&&<>
 {ov&&<div className="grid lg:grid-cols-2 gap-5">
  <section className="panel p-5"><h3 className="panel-title mb-4">Nettverkshelse · siste {ov.periodHours} t</h3>{!ov.findings.length?<Empty>Ingen funn.</Empty>:<ul className="space-y-2.5">{ov.findings.map((f,i)=>{const L=LEVEL[f.level];return <li key={i} className="rounded-xl border p-3" style={{borderColor:L.border}}><div className="flex gap-2.5 items-start"><L.Icon size={16} className={`${L.cls} shrink-0 mt-0.5`}/><div className="min-w-0"><p className="text-sm font-medium">{f.title}</p>{f.text&&<p className="text-xs text-nx-mute mt-1">{f.text}</p>}{f.devices.length>0&&<p className="text-xs mt-1.5 text-nx-text/80">{f.devices.slice(0,8).join(', ')}{f.devices.length>8?` + ${f.devices.length-8} til`:''}</p>}</div></div></li>;})}</ul>}</section>
  <section className="panel p-5"><h3 className="panel-title mb-4">Mest data · siste døgn</h3>{!ov.topData.length?<Empty>Ingen trafikkmåling ennå.</Empty>:<ul className="space-y-2">{ov.topData.slice(0,10).map(d=><li key={d.id}><button className="w-full text-left" onClick={()=>setSelected(d.id)}><div className="flex justify-between gap-3 text-sm"><span className="truncate">{d.name}{d.room&&<span className="text-xs text-nx-mute"> · {d.room}</span>}</span><span className="font-mono text-xs">{d.amount}</span></div><div className="h-1.5 rounded-full bg-nx-line/40 mt-1"><div className="h-full rounded-full" style={{width:`${Math.max(2,((d.bytes||0)/topMax)*100)}%`,background:'linear-gradient(90deg,#22e6ff,#7d5cff)'}}/></div></button></li>)}</ul>}</section>
 </div>}

 {detail&&<section ref={detailRef} className="panel p-5 scroll-mt-4" aria-label="Enhetsdetaljer" style={{borderColor:`${NET_CATEGORY[detail.category]?.color||"#22e6ff"}55`}}><div className="flex justify-between gap-3 items-start"><div><p className="text-xs uppercase tracking-[.16em]" style={{color:NET_CATEGORY[detail.category]?.color}}>{NET_CATEGORY[detail.category]?.label||'Enhet'}</p><h3 className="font-semibold text-lg break-all mt-1">{detail.label}</h3></div><div className="flex gap-2 items-center"><Badge state={detail.state}/><button className="chip" onClick={()=>setSelected(null)} aria-label="Lukk detaljer"><X size={14}/></button></div></div>
  <dl className="grid grid-cols-2 lg:grid-cols-6 gap-4 mt-5 text-sm">{[['Rom',detail.room],['IP',detail.ip],['MAC',detail.mac],['Data 24 t',detail.dataLabel],['Sist observert',detail.last_seen?time(detail.last_seen):detail.seen_text],['Kilde',sourceLabel[detail.source]]].map(([k,v])=><div key={k}><dt className="text-xs text-nx-mute">{k}</dt><dd className="mt-1 break-all">{v||'Ukjent'}</dd></div>)}</dl>
  {detail.source==='hjemmenett'&&<DeviceActivity id={detail.id}/>}
  <p className="text-xs text-nx-mute mt-5">{detail.source==='hjemmenett'?`«Nylig observert» betyr sett i trafikken siste ${minutes} minutter. En enhet i dvale kan mangle en stund.`:'En enhet i adressehurtiglageret kan ha forlatt nettet.'} Ingen personidentitet eller fysisk tilstedeværelse er utledet.</p></section>}
 <section className="panel p-5">
  <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between"><h3 className="panel-title">Enheter <span className="text-nx-mute">{visible.length} / {devices.length}</span></h3>
   <div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 border border-nx-line rounded-lg px-3"><Search size={14}/><input aria-label="Søk etter enhet, rom, IP eller MAC" placeholder="Søk enhet, rom, IP, MAC…" className="bg-transparent p-2 w-48 text-sm outline-none" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <select aria-label="Filtrer observasjonsstatus" value={filter} onChange={e=>setFilter(e.target.value)} className="bg-nx-bg border border-nx-line rounded-lg p-2 text-sm"><option value="all">Alle statuser</option>{Object.entries(stateLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    <select aria-label="Sorter" value={sort} onChange={e=>setSort(e.target.value)} className="bg-nx-bg border border-nx-line rounded-lg p-2 text-sm">{Object.entries(SORTS).map(([k,v])=><option key={k} value={k}>Sorter: {v}</option>)}</select></div></div>
  <div className="flex flex-wrap gap-1.5 mt-3">{NET_CATEGORIES.filter(c=>counts[c.id]).map(c=>{const on=cats.has(c.id);return <button key={c.id} onClick={()=>toggleCat(c.id)} aria-pressed={on} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs" style={on?{borderColor:`${c.color}88`,color:c.color,background:`${c.color}14`}:{borderColor:'#2a3a55',color:'#7c8aa8'}}><span className="h-1.5 w-1.5 rounded-full" style={{background:on?c.color:'#3a4a65'}}/>{c.label} <span className="opacity-70">{counts[c.id]}</span></button>;})}</div>
  <div className="mt-4 space-y-4">{groups.map(g=><div key={g.id}>
   <p className="text-[11px] uppercase tracking-[.18em] mb-1.5" style={{color:g.color}}>{g.label} · {g.items.length}</p>
   <div className="overflow-x-auto rounded-xl border border-nx-line/70"><table className="w-full text-sm min-w-[600px] table-fixed"><colgroup><col style={{width:28}}/><col style={{width:"32%"}}/><col style={{width:"20%"}}/><col style={{width:"16%"}}/><col style={{width:"12%"}}/><col/></colgroup><tbody>{g.items.map(d=><tr key={d.id} onClick={()=>setSelected(d.id)} className={`cursor-pointer border-b border-nx-line/40 last:border-0 hover:bg-nx-cyan/5 ${selected===d.id?'bg-nx-cyan/10':''}`}>
    <td className="py-2 pl-3 w-6"><span className="block h-2 w-2 rounded-full" style={{background:color[d.state],boxShadow:d.state==='observed'?`0 0 6px ${color.observed}`:'none'}} title={stateLabel[d.state]}/></td>
    <td className="py-2 pr-3 truncate"><button className="text-left hover:text-nx-cyan" onClick={()=>setSelected(d.id)}>{d.label}</button></td>
    <td className="py-2 pr-3 text-nx-mute text-xs truncate">{d.room||'—'}</td>
    <td className="py-2 pr-3 font-mono text-xs text-nx-mute">{d.ip||'—'}</td>
    <td className="py-2 pr-3 font-mono text-xs text-right">{d.dataLabel||'—'}</td>
    <td className="py-2 pr-3 text-xs text-nx-mute text-right whitespace-nowrap">{d.seen_text||(d.last_seen?time(d.last_seen):'')}</td></tr>)}</tbody></table></div></div>)}
   {!visible.length&&<Empty>Ingen enheter passer filteret.</Empty>}</div>
 </section>


 {ov?.newDevices.length>0&&<section className="panel p-5"><h3 className="panel-title mb-3">Nye, ukjente enheter</h3><p className="text-xs text-nx-mute mb-3">Sett i trafikken, men ikke registrert i hjemmenett-portalen. Gi dem navn og type der.</p><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{ov.newDevices.map(d=><div key={d.id} className="rounded-xl border border-nx-amber/30 p-3 text-sm"><p className="font-mono">{d.id}</p><p className="text-xs text-nx-mute mt-1">{d.ip||'IP ukjent'}{d.lastSeen?` · sist sett ${d.lastSeen}`:''}</p></div>)}</div></section>}

 {(links.length>0||history.length>=2||!fromMonitor)&&<div className="grid lg:grid-cols-2 gap-5"><section className="panel p-5"><h3 className="panel-title mb-4">Observerte forbindelser</h3>{!links.length?<Empty>Ingen dokumenterte forbindelser fra siste fem minutter. Vi tegner ikke et antatt mesh-kart.</Empty>:<div><ConnectionMap devices={devices} links={links}/><div className="space-y-2 max-h-80 overflow-auto">{links.map((l,i)=>{const a=devices.find(d=>d.id===l.source_id),b=devices.find(d=>d.id===l.target_id);return <div key={i} className="rounded-xl border border-nx-line p-3"><div className="flex gap-3 items-center text-sm"><button className="text-left flex-1 break-words" onClick={()=>setSelected(a.id)}>{a.label}</button><span className="text-nx-cyan">↔</span><button className="text-left flex-1 break-words" onClick={()=>setSelected(b.id)}>{b.label}</button></div><p className="text-xs text-nx-mute mt-2">{l.source} · {time(l.observed_at)}</p></div>;})}</div></div>}</section>
 <section className="panel p-5 min-w-0"><h3 className="panel-title mb-4">Observasjoner over tid</h3>{history.length<2?<Empty>Minst to historiske målinger trengs for en graf.</Empty>:<><div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history}><defs><linearGradient id="networkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22e6ff" stopOpacity={.3}/><stop offset="100%" stopColor="#22e6ff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#253247" strokeDasharray="3 3"/><XAxis dataKey="at" tickFormatter={t=>new Date(t).toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Oslo'})} tick={{fill:'#9aa9bf',fontSize:10}}/><YAxis allowDecimals={false} tick={{fill:'#9aa9bf',fontSize:10}} width={30}/><Tooltip labelFormatter={time} contentStyle={{background:'#101827',border:'1px solid #253247',borderRadius:12}}/><Area type="stepAfter" dataKey="observed_devices" name="Observerte enheter" stroke="#22e6ff" fill="url(#networkFill)" connectNulls={false}/></AreaChart></ResponsiveContainer></div><p className="text-xs text-nx-mute">Antall i lagrede målinger.</p></>}</section></div>}
 {s.events?.length>0&&<section className="panel p-5"><h3 className="panel-title mb-4">Hendelseslinje</h3><ol className="space-y-0 max-h-80 overflow-auto">{[...s.events].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).map((e,i)=><li key={e.id||i} className="border-l border-nx-cyan/30 pl-5 pb-5 ml-2"><p className="text-sm">{eventNames[e.type]||'Teknisk hendelse'} · {devices.find(d=>d.id===e.device_id)?.label||'Ukjent enhet'}</p><p className="text-xs text-nx-mute mt-1">{time(e.at)}</p></li>)}</ol></section>}
 </>}
 </div>;
}
