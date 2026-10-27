import {useEffect,useId,useMemo,useState}from 'react';import {ResponsiveContainer,AreaChart,Area,BarChart,Bar,Cell,ReferenceLine,XAxis,YAxis,Tooltip,CartesianGrid}from 'recharts';import {apiFetch}from '../lib/api.js';import {pulseSeries,withGaps,hourlyEnergy,timeTicks}from '../lib/historySeries.js';
export const historyTime=t=>t?new Date(t).toLocaleString('nb-NO',{timeZone:'Europe/Oslo'}):'Ukjent';
const displayNumber=v=>Number(v).toLocaleString('nb-NO',{maximumFractionDigits:3});
const clockTick=t=>new Date(t).toLocaleTimeString('nb-NO',{timeZone:'Europe/Oslo',hour:'2-digit',minute:'2-digit'});
const axis={tickLine:false,axisLine:false,tick:{fill:'#8ea3ba',fontSize:11}};
const tooltipStyle={contentStyle:{background:'#172536',border:'1px solid #40546c',borderRadius:12,color:'#e6eef7',fontSize:12,boxShadow:'0 8px 24px #0006'},labelStyle:{color:'#9eb2c8',marginBottom:4},cursor:{stroke:'#5b7189',strokeDasharray:'3 3'}};
function Summary({items}){return <div className="chart-summary">{items.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;}

/** Tidsserie som område med fargefyll. Hull over gapMs brytes; linja mellom punkter er ikke en kontinuerlig måling. */
export function SeriesChart({title,subtitle,points=[],unit='',gapMs=1800000,tickFormat=clockTick,color='#7ce2c4'}) {
 const id=useId().replace(/:/g,'');
 const values=points.filter(p=>Number.isFinite(p.value)&&Number.isFinite(p.at)),data=withGaps(points,gapMs);
 const latest=values.at(-1),low=values.length?Math.min(...values.map(p=>p.value)):null,high=values.length?Math.max(...values.map(p=>p.value)):null;
 const ticks=values.length>1?timeTicks(values[0].at,latest.at):undefined;
 return <section className="panel chart-card min-w-0" aria-label={title}>
  <header className="chart-head"><div><h3 className="chart-title">{title}</h3><p className="chart-unit">{subtitle?`${subtitle} · `:''}{unit}</p></div>{latest&&<Summary items={[['Siste',displayNumber(latest.value)],['Lavest',displayNumber(low)],['Høyest',displayNumber(high)]]}/>}</header>
  {values.length<2?<div className="chart-empty">{values.length===1?'Ett registrert punkt. Grafen vises når minst to punkter finnes.':'Ingen brukbare punkter i valgt periode. Manglende data er ikke null.'}</div>:<div className="chart-canvas"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{top:10,right:8,left:0,bottom:0}}>
   <defs><linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35}/><stop offset="100%" stopColor={color} stopOpacity={0.02}/></linearGradient></defs>
   <CartesianGrid vertical={false} stroke="#26364a" strokeDasharray="2 6"/>
   <XAxis dataKey="at" type="number" scale="time" domain={['dataMin','dataMax']} ticks={ticks} minTickGap={40} tickFormatter={tickFormat} {...axis}/>
   <YAxis domain={['auto','auto']} width={48} tickFormatter={displayNumber} {...axis}/>
   <Tooltip {...tooltipStyle} labelFormatter={historyTime} formatter={v=>[v==null?'Ukjent':`${displayNumber(v)} ${unit}`,title]}/>
   <Area dataKey="value" type="monotone" stroke={color} strokeWidth={2} fill={`url(#fill-${id})`} dot={values.length<30?{r:2.5,strokeWidth:0,fill:color}:false} activeDot={{r:5,stroke:'#0f1b28',strokeWidth:2,fill:color}} connectNulls={false} isAnimationActive={false}/>
  </AreaChart></ResponsiveContainer></div>}
  <p className="chart-note">{values.length} punkter{values.length>0?` · ${historyTime(values[0].at)} – ${historyTime(latest.at)}`:''}</p>
 </section>;
}

/** Søyler per intervall (f.eks. kWh per time eller spotpris per time). colorFor gir farge per søyle. */
export function BarSeriesChart({title,subtitle,bars=[],unit='',tickFormat=clockTick,colorFor=()=> '#7ce2c4',average=null,highlightAt=null,summary,note}) {
 const values=bars.filter(b=>Number.isFinite(b.value));
 const ticks=values.length>1?timeTicks(values[0].at,values.at(-1).at):undefined;
 return <section className="panel chart-card min-w-0" aria-label={title}>
  <header className="chart-head"><div><h3 className="chart-title">{title}</h3><p className="chart-unit">{subtitle?`${subtitle} · `:''}{unit}</p></div>{summary&&<Summary items={summary}/>}</header>
  {!values.length?<div className="chart-empty">Ingen brukbare verdier i valgt periode. Manglende data er ikke null.</div>:<div className="chart-canvas"><ResponsiveContainer width="100%" height="100%"><BarChart data={values} margin={{top:10,right:8,left:0,bottom:0}} barCategoryGap="18%">
   <CartesianGrid vertical={false} stroke="#26364a" strokeDasharray="2 6"/>
   <XAxis dataKey="at" type="number" scale="time" domain={[values[0].at-1800000,values.at(-1).at+1800000]} ticks={ticks} minTickGap={40} tickFormatter={tickFormat} {...axis}/>
   <YAxis width={48} tickFormatter={displayNumber} {...axis}/>
   <Tooltip {...tooltipStyle} cursor={{fill:'#ffffff0d'}} labelFormatter={historyTime} formatter={v=>[`${displayNumber(v)} ${unit}`,title]}/>
   {Number.isFinite(average)&&<ReferenceLine y={average} stroke="#9eb2c8" strokeDasharray="4 4" label={{value:`snitt ${displayNumber(average)}`,position:'insideTopRight',fill:'#9eb2c8',fontSize:11}}/>}
   <Bar dataKey="value" radius={[4,4,0,0]} isAnimationActive={false}>{values.map(b=><Cell key={b.at} fill={colorFor(b)} fillOpacity={highlightAt===null||b.at===highlightAt?1:0.75} stroke={b.at===highlightAt?'#f8fafc':'none'} strokeWidth={b.at===highlightAt?1.5:0}/>)}</Bar>
  </BarChart></ResponsiveContainer></div>}
  {note&&<p className="chart-note">{note}</p>}
 </section>;
}

const PERIODS=[[1,'Siste time'],[24,'Døgn'],[168,'Uke']];
const tickForHours=h=>h>24?t=>new Date(t).toLocaleDateString('nb-NO',{timeZone:'Europe/Oslo',weekday:'short',day:'numeric'}):clockTick;
export function PeriodPicker({value,onChange,options=PERIODS}){return <div className="period-picker" role="group" aria-label="Tidsrom">{options.map(([v,l])=><button key={v} type="button" aria-pressed={value===v} onClick={()=>onChange(v)}>{l}</button>)}</div>;}

export function HistoryCharts({kind='pulse',parameter='40008'}){
 const [hours,setHours]=useState(24),[data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();setData(null);setError('');apiFetch(`/api/history/${kind}?hours=${hours}&parameter=${parameter}`,{signal:c.signal}).then(async r=>{if(!r.ok)throw Error('Historikken kunne ikke leses');const d=await r.json();if(d.available===false)throw Error('Ingen historikkilde tilgjengelig. Manglende data er ikke null forbruk.');setData(d);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[hours,kind,parameter]);
 const p=useMemo(()=>pulseSeries(data?.series),[data]);
 const perHour=useMemo(()=>hourlyEnergy(p.energy),[p]);
 const total=perHour.reduce((s,b)=>s+b.value,0),peak=p.power.length?Math.max(...p.power.map(x=>x.value)):null;
 const tick=tickForHours(hours);
 return <section className="history-block">
  <header className="history-head"><div><h2 className="chart-title">{kind==='pulse'?'Strømforbruk · Pulse Hunstein':'Varmehistorikk'}</h2><p className="chart-unit">Tilgjengelig fra {historyTime(data?.startedAt)} · sist lagret {historyTime(data?.lastSuccessfulAt)}</p></div><PeriodPicker value={hours} onChange={setHours}/></header>
  {error&&<p role="alert" className="chart-empty">{error}</p>}
  {!data&&!error&&<div className="chart-empty">Laster historikk…</div>}
  {data&&(kind==='pulse'?<>
   <div className="history-grid">
    <SeriesChart title="Effekt" subtitle={peak===null?undefined:`høyeste registrerte ${displayNumber(peak)} kW`} points={p.power} unit="kW" tickFormat={tick} color="#7ce2c4"/>
    <BarSeriesChart title="Energi per time" unit="kWh" bars={perHour} tickFormat={tick} colorFor={()=>'#5aa9ff'}
     summary={perHour.length?[['Sum',`${displayNumber(Math.round(total*100)/100)}`],['Timer',String(perHour.length)]]:null}
     note="Summen av gyldige økninger i døgnmåleren per time. Timer uten gyldige avlesninger mangler, og summen er derfor ikke nødvendigvis hele forbruket."/>
   </div>
   <p className="history-note">{data?.truncated?'Utvalget er avkortet. ':''}{data?.note} Spotkostnad og total strømregning beregnes ikke.</p>
  </>:<SeriesChart title={data?.series?.find(x=>x.name)?.name||'Varmehistorikk'} points={data?.series||[]} unit={data?.series?.find(x=>x.unit)?.unit||''} tickFormat={tick}/>)}
 </section>;
}
