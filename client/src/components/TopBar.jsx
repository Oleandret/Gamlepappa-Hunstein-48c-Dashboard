import { useNow, formatTime, formatDateLong } from '../lib/useNow.js';
import { SECTIONS } from '../lib/sections.js';
import { AIConnection } from './AIConnection.jsx';
const descriptions={oversikt:'Huset, hytta og det som trenger oppmerksomhet.',stromsparing:'Forstå forbruket. Vurder tiltak før du automatiserer.',varmestyring:'Temperaturer og drift, med kilden bak hvert tall.',historikk:'Se utviklingen i målingene dine.',rom:'Et tydelig overblikk, rom for rom.',enheter:'Finn enheten, målepunktet og kildetiden.', 'plantegning-hus':'Utforsk rom, plasseringer og enheter.', 'hus-3d':'Huset i tre dimensjoner.',huspuls:'Observasjoner, avvik og forslag du kan vurdere.'};
export function TopBar({section,onSection,system}){
 const now=useNow(1000),current=SECTIONS.find(s=>s.id===section);
 return <header className="dashboard-topbar">
  <div className="dashboard-heading"><div><p className="dashboard-eyebrow">GAMLEPAPPA <span> / Smarthus</span></p><p className="dashboard-title">{current?.label || 'Dashboard'}</p><p className="dashboard-description">{descriptions[section] || 'Dine enheter og tjenester, samlet på ett sted.'}</p></div><div className="dashboard-clock"><span>{formatDateLong(now)}</span><strong aria-label="Klokke">{formatTime(now)}</strong><AIConnection/></div></div>
  <div className="dashboard-navigation"><nav aria-label="Seksjons-navigasjon">{SECTIONS.map(({id,label})=><button key={id} onClick={()=>onSection(id)} aria-current={section===id?'page':undefined}>{label.toLowerCase()}</button>)}</nav><label className="section-picker"><span>Alle faner</span><select value={section} onChange={e=>onSection(e.target.value)} aria-label="Velg fane">{SECTIONS.map(({id,label})=><option key={id} value={id}>{label}</option>)}</select></label></div>
 </header>;
}
