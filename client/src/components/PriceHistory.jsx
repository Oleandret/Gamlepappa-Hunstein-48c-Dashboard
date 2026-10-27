import {BarSeriesChart,historyTime} from './HistoryCharts.jsx';
import {useEffect,useMemo,useState}from 'react';import {apiFetch}from '../lib/api.js';import {osloDate}from '../lib/savingsModel.js';

const shiftDate=(date,days)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const hhmm=t=>new Date(t).toLocaleTimeString('nb-NO',{timeZone:'Europe/Oslo',hour:'2-digit',minute:'2-digit'});
const kr=v=>v.toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2});
/** Grønn → gul → rød etter hvor prisen ligger mellom dagens laveste og høyeste. */
function priceColor(v,min,max){const f=max>min?(v-min)/(max-min):0.5;const c=f<0.5?[[61,220,132],[255,191,105]]:[[255,191,105],[255,92,122]];const t=f<0.5?f*2:(f-0.5)*2;const [a,b]=c;return `rgb(${a.map((x,i)=>Math.round(x+(b[i]-x)*t)).join(',')})`;}

export function PriceHistory(){
 const [date,setDate]=useState(()=>osloDate()),[data,setData]=useState(null),[error,setError]=useState(false);
 useEffect(()=>{let alive=true,timer;const controller=new AbortController();async function load(){try{const r=await apiFetch(`/api/prices?date=${encodeURIComponent(date)}`,{signal:controller.signal});if(!r.ok)throw Error();const d=await r.json();if(alive){setData(d);setError(false);}}catch(e){if(alive&&e.name!=='AbortError')setError(true);}finally{if(alive)timer=setTimeout(load,300000);}}setData(null);load();return()=>{alive=false;controller.abort();clearTimeout(timer);};},[date]);
 const intervals=data?.available?data.record.intervals:[];
 const stats=useMemo(()=>{if(!intervals.length)return null;const vals=intervals.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),avg=vals.reduce((a,b)=>a+b,0)/vals.length;const now=Date.now(),current=intervals.find(p=>p.start<=now&&now<p.end)||null;const cheapest=intervals.reduce((a,b)=>b.value<a.value?b:a),dearest=intervals.reduce((a,b)=>b.value>a.value?b:a);return {min,max,avg,current,cheapest,dearest};},[intervals]);
 const today=osloDate();
 return <section className="history-block">
  <header className="history-head"><div><h2 className="chart-title">Spotpris · NO2</h2><p className="chart-unit">NOK/kWh uten mva, nettleie, avgifter og strømstøtte · publiserte priser, ikke prognose</p></div>
   <div className="date-stepper"><button type="button" onClick={()=>setDate(d=>shiftDate(d,-1))} aria-label="Forrige dag">‹</button><input type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)} min="2021-12-01" aria-label="Dato"/><button type="button" onClick={()=>setDate(d=>shiftDate(d,1))} aria-label="Neste dag">›</button>{date!==today&&<button type="button" className="secondary" onClick={()=>setDate(today)}>I dag</button>}</div></header>
  {error?<p className="chart-empty">Prisarkivet kunne ikke leses.</p>:!data?<div className="chart-empty">Laster priser…</div>:!data.available?<p className="chart-empty">Ingen priser lagret for denne datoen ennå. Morgendagen publiseres vanligvis rundt kl. 13.</p>:<>
   <BarSeriesChart title="Pris per time" unit="NOK/kWh" bars={intervals.map(p=>({at:p.start,value:p.value}))}
    colorFor={b=>priceColor(b.value,stats.min,stats.max)} average={stats.avg} highlightAt={stats.current?.start??null}
    summary={[...(stats.current?[['Nå',kr(stats.current.value)]]:[]),['Billigst',`${kr(stats.cheapest.value)} · ${hhmm(stats.cheapest.start)}`],['Dyrest',`${kr(stats.dearest.value)} · ${hhmm(stats.dearest.start)}`]]}
    note={`Hentet ${historyTime(data.record.fetchedAt)} · ${data.record.complete?'hele døgnet dekket':'ufullstendig dekning'}. Grønt er billig og rødt dyrt i forhold til resten av dagen. Stiplet linje er dagens snitt.`}/>
   <details className="price-table"><summary>Vis alle priser som tabell</summary><table><thead><tr><th>Intervall</th><th>Spotpris</th></tr></thead><tbody>{intervals.map(p=><tr key={p.start}><td>{hhmm(p.start)}–{hhmm(p.end)}</td><td>{p.value.toLocaleString('nb-NO',{maximumFractionDigits:5})}</td></tr>)}</tbody></table></details>
  </>}
  <p className="history-note">Kilde: <a href="https://www.hvakosterstrommen.no/strompris-api" target="_blank" rel="noreferrer">Hva koster strømmen</a>. Arkivet fylles av serveren hver time, også når nettleseren er lukket.</p>
 </section>;
}
