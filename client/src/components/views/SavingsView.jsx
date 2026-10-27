import {HistoryCharts} from '../HistoryCharts.jsx';
import {PriceHistory} from '../PriceHistory.jsx';
import {HUNSTEIN_MAIN_ID} from '../../lib/hunsteinMeter.js';
import {HunsteinEnergy} from '../HunsteinEnergy.jsx';
import {ActionPlan} from '../ActionPlan.jsx';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { inventory, siteRows, overview, recommendations, appendSample, meterHistory, intervalCost, simulate, validatePlan } from '../../lib/savingsModel.js';
import './savings.css';
const labels={measured:'Målt',missing:'Mangler',stale:'Foreldet / ukjent tid',demo:'Demo',live:'Tilgjengelig'};
const number=(n,d=1)=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('nb-NO',{maximumFractionDigits:d}):'—';
const time=n=>n?new Date(n).toLocaleString('nb-NO',{timeZone:'Europe/Oslo'}):'Ukjent tidspunkt';
const initialPlan={deviceId:'',minutes:30,reason:'',comfort:'',nonCritical:false};
export function SavingsView(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[clock,setClock]=useState(Date.now());
  const [mainId,setMain]=useState(HUNSTEIN_MAIN_ID),[subIds,setSubs]=useState([]),[room,setRoom]=useState('');
  const [siteId,setSite]=useState('hunstein'),[assignments,setAssignments]=useState({[HUNSTEIN_MAIN_ID]:'hunstein'}),[cumulative,setCumulative]=useState(false);
  const [samples,setSamples]=useState([]),[plan,setPlan]=useState(initialPlan),[result,setResult]=useState(null);
  const [status,setStatus]=useState('Kladd'),[log,setLog]=useState([]),[confirmed,setConfirmed]=useState(false);
  const addLog=message=>setLog(old=>[{at:Date.now(),message},...old].slice(0,100));
  useEffect(()=>{
    let alive=true, timer; const controller=new AbortController();
    async function load(){
      try {const response=await apiFetch('/api/savings',{signal:controller.signal}); if(!response.ok)throw new Error('Data kunne ikke hentes'); const next=await response.json();if(alive){setData(next);setError('');}}
      catch(e){if(alive&&e.name!=='AbortError')setError('Kilden er utilgjengelig. Tidligere målinger brukes ikke som ferske data.');}
      finally {if(alive)timer=setTimeout(load,60_000);}
    }
    load();const tick=setInterval(()=>setClock(Date.now()),10000);
    return()=>{alive=false;controller.abort();clearTimeout(timer);clearInterval(tick);};
  },[]);
  const quality=error?'stale':data?.devices?.quality;
  const rows=useMemo(()=>inventory(data?.devices?.value||{},data?.zones?.value||{},quality,clock),[data,quality,clock]);
  const scopedRows=useMemo(()=>siteRows(rows,siteId,assignments),[rows,siteId,assignments]);
  const summary=useMemo(()=>overview(scopedRows,mainId,subIds),[scopedRows,mainId,subIds]);
  const advice=useMemo(()=>recommendations(scopedRows,summary),[scopedRows,summary]);
  useEffect(()=>{setSamples(old=>cumulative?appendSample(old,scopedRows.find(r=>r.id===mainId)):old);},[scopedRows,mainId,cumulative]);
  const history=cumulative?meterHistory(samples,mainId):[], cost=intervalCost(history,[]);
  useEffect(()=>{
    if(status==='Aktiv forhåndsvisning'&&validatePlan(plan,scopedRows).length){setStatus('Pauset — datagrunnlaget er ikke lenger gyldig');setConfirmed(false);setResult(null);addLog('Forhåndsvisning automatisk pauset fordi ferske data eller enhetsgrunnlag mangler.');}
  },[scopedRows,plan,status]);
  const changePlan=patch=>{setPlan(p=>({...p,...patch}));setResult(null);setConfirmed(false);setStatus('Kladd');};
  const runSimulation=()=>{const r=simulate(plan,scopedRows);setResult(r);setStatus(r.ok?'Simulert':'Krever avklaring');addLog(r.ok?'Simulering beregnet lokalt. Ingen kommando sendt.':'Simulering stoppet: nødvendige opplysninger mangler.');};
  const activatePreview=()=>{const fresh=simulate(plan,scopedRows);if(!confirmed||!fresh.ok){setResult(fresh);setStatus('Krever ny simulering');return;}setResult(fresh);setStatus('Aktiv forhåndsvisning');addLog('Bruker aktiverte lokal forhåndsvisning. Fysisk kjøring er ikke implementert.');};
  const shown=rows.filter(r=>!room||r.room===room).sort((a,b)=>(b.power.value??-Infinity)-(a.power.value??-Infinity));
  return <div className="savings">
    <header className="saving-hero"><div><p className="saving-eyebrow">GAMLEPAPPA / ENERGIINNSIKT</p><h1>Strømsparing</h1><p>Forstå forbruket. Prøv tiltak. Behold kontrollen.</p></div><span className="saving-badge">Kun innsikt og simulering</span></header>
    <div className="saving-notice" role="status">{quality==='demo'?'DEMO — alle kildedata er testdata. Ingen bekreftet husmåling.':error||'Lesetilgang · oppdateres tidligst hvert minutt · Europe/Oslo'}<br/>Ingen fysisk automasjon kan aktiveres fra denne fanen.</div>
    <ActionPlan rows={rows} devices={data?.devices?.value||{}} zones={data?.zones?.value||{}} siteId={siteId}/>
    {siteId==='hunstein'&&<><HistoryCharts/><PriceHistory/></>}
    {siteId==='hunstein'&&<section className="saving-card"><HunsteinEnergy devices={data?.devices?.value} quality={quality}/></section>}
    <section className="saving-metrics" aria-label="Forbruksoversikt">
      <Metric title="Valgt anlegg akkurat nå" value={summary.total===null?'—':number(summary.total/1000,2)} unit="kW" note={summary.total===null?'Velg en fersk, bekreftet hovedmåler':'Målt hovedmåler · ikke summert med undermålere'}/>
      <Metric title="Valgte undermålere" value={number(summary.subtotal)} unit="W" note={`${summary.selected} med ferske målinger · ufullstendig dekning`}/>
      <Metric title="Observert energi" value={history.some(i=>i.kwh!==null)?number(history.reduce((s,i)=>s+(i.kwh??0),0),3):'—'} unit="kWh" note="Målerdifferanser i denne åpne økten · ikke døgnsum"/>
      <Metric title="Dokumentert kostnad" value={number(cost.cost,2)} unit="kr" note="Mangler verifiserte priser for måleintervallene"/>
    </section>
    <div className="saving-grid">
      <section className="saving-card"><h2>01 / Måleroppsett</h2><label>Anlegg<select value={siteId} onChange={e=>{setSite(e.target.value);setMain('');setSubs([]);setCumulative(false);changePlan(initialPlan);}}><option value="hunstein">Hunstein 48C</option><option value="halsaneset">Halsaneset</option></select></label><p>Tilordne hver måler til riktig anlegg i tabellen nedenfor. Ukjent tilhørighet utelates. Oppsettet lagres bare i denne åpne fanen.</p><label>Bekreftet hovedmåler<select value={mainId} onChange={e=>{setMain(e.target.value);setCumulative(false);setSubs(ids=>ids.filter(id=>id!==e.target.value));}}><option value="">Ikke identifisert</option>{scopedRows.filter(r=>r.power.value!==null||r.meter.value!==null).map(r=><option key={r.id} value={r.id}>{r.name} · {r.room}</option>)}</select></label><p>Velg bare måleren som dekker hele huset. Pulse Hunstein 48C er bekreftet av eier og koblet med stabil ID. Andre enheter blir ikke automatisk hovedmåler.</p><details><summary>Velg uavhengige undermålere ({subIds.length})</summary><p>Velg kun målere som ikke overlapper hverandre. Hovedmåleren er utelatt.</p>{scopedRows.filter(r=>r.id!==mainId&&r.power.value!==null).map(r=><label className="saving-check" key={r.id}><input type="checkbox" checked={subIds.includes(r.id)} onChange={e=>setSubs(ids=>e.target.checked?[...ids,r.id]:ids.filter(id=>id!==r.id))}/>{r.name}</label>)}</details>{summary.inconsistent&&<p role="alert" className="saving-warning">Undermåling overstiger hovedmåling. Kontroller overlapp og tidspunkt.</p>}<p>Ufordelt effekt: <strong>{number(summary.residual)} W</strong>. Differansen kan skyldes umålte laster eller usamtidige målinger.</p></section>
      <section className="saving-card"><h2>02 / Datadekning</h2><div className="saving-coverage"><strong>{summary.measured} / {scopedRows.length}</strong><span>tilordnede enheter med fersk effektmåling</span></div><p>{summary.stale} foreldet · {summary.missing} uten effektdata. Dette er enhetsdekning, ikke prosent av husets energiforbruk.</p><dl><dt>Siste vellykkede enhetslesing</dt><dd>{time(data?.devices?.updatedAt)}</dd><dt>Sanntidsrapport fra Homey</dt><dd>{labels[data?.live?.quality]||'Mangler'} · format ikke kartlagt</dd><dt>Dagsrapport {data?.date||''}</dt><dd>{labels[data?.day?.quality]||'Mangler'} · format ikke kartlagt</dd><dt>Kildestatus</dt><dd>{data?.devices?.reason||'Ingen kildefeil rapportert'}{data?.devices?.retryAt?` · neste leseforsøk tidligst ${time(data.devices.retryAt)}`:''}</dd></dl><p>Rapporttall brukes først når enheter og målerhierarki er verifisert. Målt, estimert, manglende og foreldet vises hver for seg.</p></section>
    </div>
    <section className="saving-card"><div className="saving-section-head"><h2>03 / Enheter og rom</h2><label>Rom<select value={room} onChange={e=>setRoom(e.target.value)}><option value="">Alle rom</option>{[...new Set(rows.map(r=>r.room))].sort().map(r=><option key={r}>{r}</option>)}</select></label></div>
      {summary.rooms.length>0&&<div className="saving-room-grid">{summary.rooms.map(r=><div key={r.room}><strong>{r.room}</strong><p>{r.count?`${number(r.watts)} W`:'Ingen ferske målinger'}</p><small>Valgte undermålere</small></div>)}</div>}
      <div className="saving-table"><table><thead><tr><th>Enhet / rom</th><th>Bekreftet anlegg</th><th>Effekt</th><th>Målerstand</th><th>Kvalitet / tidspunkt</th></tr></thead><tbody>{shown.map(r=><tr key={r.id}><td>{r.name}{r.id===mainId?' · Hovedmåler':''}<small>{r.room}</small></td><td><select aria-label={`Anlegg for ${r.name}`} value={assignments[r.id]||''} onChange={e=>{setAssignments(a=>({...a,[r.id]:e.target.value}));setMain('');setSubs([]);setCumulative(false);changePlan(initialPlan);}}><option value="">Ukjent / ikke bekreftet</option><option value="hunstein">Hunstein 48C</option><option value="halsaneset">Halsaneset</option></select></td><td>{number(r.power.value)} W</td><td>{number(r.meter.value,3)} kWh<small>{labels[r.meter.quality]} · målerperiode ikke verifisert</small></td><td><span className={`saving-quality ${r.power.quality}`}>{labels[r.power.quality]}</span><small>{time(r.power.at)}</small></td></tr>)}</tbody></table></div>{!rows.length&&<p>Ingen enhetsdata tilgjengelig. Manglende målinger er ikke nullforbruk.</p>}
    </section>
    <div className="saving-grid">
      <section className="saving-card"><h2>04 / Historikk og pris</h2><label className="saving-check"><input type="checkbox" disabled={!mainId||mainId===HUNSTEIN_MAIN_ID} checked={cumulative} onChange={e=>{setCumulative(e.target.checked);setSamples([]);}}/>Jeg har kontrollert at hovedmåleren rapporterer kumulativ import i kWh.</label><p>Pulse Hunstein rapporterer siden midnatt og skal ikke behandles som en livstidsmåler. Historikken starter når du velger en annen, bekreftet kumulativ hovedmåler og får to forskjellige, ferske målerstander. Den lagres bare i minnet og slettes når fanen lukkes. Ingen tilbakeskrevet døgnkurve.</p>{history.length?<ul>{history.slice(-8).map(i=><li key={i.end}>{time(i.start)} → {time(i.end)}<br/><strong>{number(i.kwh,3)} kWh</strong> · {i.reason||'Målt differanse'}</li>)}</ul>:<div className="saving-empty">Venter på to gyldige målerstander</div>}<p>Strømpris, nettleie og avgifter: <strong>mangler verifisert kilde</strong>. Negative priser støttes i beregningsmodellen, men ingen priser eller besparelser er oppdiktet.</p></section>
      <section className="saving-card"><h2>05 / Analyse og anbefalinger</h2><span className="saving-badge">Regelbasert · ikke AI-generert</span><p>AI er ikke koblet til denne fanen. Anbefalinger bygger på datakvalitet og observerte målinger.</p>{advice.map(a=><article className="saving-advice" key={a.title}><h3>{a.title}</h3><p>{a.body}</p></article>)}{!advice.length&&<p>Ingen anbefalinger uten tilstrekkelig datagrunnlag.</p>}</section>
    </div>
    <section className="saving-card"><h2>06 / Prøv en automasjon</h2><p>Lag et lokalt utkast for å slå av ett ikke-kritisk lys i en avgrenset periode. Varme, frostvern, varmtvann, stikkontakter og ukjente enheter kan ikke velges. Ingen sikkerhetsgrenser gjettes.</p><div className="saving-form">
      <label>Lys<select aria-label="Lys" value={plan.deviceId} onChange={e=>changePlan({deviceId:e.target.value})}><option value="">Velg identifisert lys</option>{scopedRows.filter(r=>r.canPlan).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label>Varighet (minutter)<input type="number" min="1" max="120" value={Number.isFinite(plan.minutes)?plan.minutes:''} onChange={e=>changePlan({minutes:e.target.value===''?NaN:Number(e.target.value)})}/></label>
      <label>Begrunnelse<input maxLength="500" value={plan.reason} placeholder="For eksempel: rommet står tomt" onChange={e=>changePlan({reason:e.target.value})}/></label>
      <label>Egne komfort- og sikkerhetsgrenser<input maxLength="500" value={plan.comfort} placeholder="Når skal lyset fortsatt være på?" onChange={e=>changePlan({comfort:e.target.value})}/></label>
    </div><label className="saving-check"><input type="checkbox" checked={plan.nonCritical} onChange={e=>changePlan({nonCritical:e.target.checked})}/>Jeg har bekreftet at lyset ikke er kritisk, nødlys eller nødvendig for trygg ferdsel.</label>
      <div className="saving-actions"><button onClick={runSimulation}>Simuler tiltak</button><button className="secondary" onClick={()=>{setStatus('Pauset');setConfirmed(false);addLog('Lokal forhåndsvisning pauset.');}}>Pause forhåndsvisning</button><button className="danger" onClick={()=>{setStatus('Stoppet');setResult(null);setConfirmed(false);addLog('Lokal forhåndsvisning stoppet. Stopper ikke andre systemer eller eksisterende Homey-flows.');}}>Stopp lokal forhåndsvisning</button></div>
      <p role="status">Status: <strong>{status}</strong></p>{result&&!result.ok&&<ul role="alert">{result.errors.map(e=><li key={e}>{e}</li>)}</ul>}{result?.ok&&<div className="saving-notice"><strong>Estimert scenario: {number(result.estimatedKwh,3)} kWh</strong><p>{result.note}</p><label className="saving-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Jeg vil aktivere bare denne lokale forhåndsvisningen.</label><button disabled={!confirmed} onClick={activatePreview}>Aktiver forhåndsvisning</button></div>}<p>Fysisk aktivering: sperret. Denne stoppknappen er ikke et nødstopp for huset. Utkast og logg lagres kun mens fanen er åpen.</p>
      <details><summary>Simuleringslogg ({log.length})</summary>{log.length?<ol>{log.map((l,i)=><li key={i}>{time(l.at)} — {l.message}</li>)}</ol>:<p>Ingen hendelser ennå.</p>}</details>
    </section>
  </div>;
}
function Metric({title,value,unit,note}){return <div className="saving-card saving-metric"><h2>{title}</h2><div><strong>{value}</strong><span>{unit}</span></div><p>{note}</p></div>;}
