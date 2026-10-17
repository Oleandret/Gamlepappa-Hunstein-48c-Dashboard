import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { normalizeHeatingPoints } from '../../lib/heatingModel.js';
import './heating.css';
import { HeatingConnection } from './HeatingConnection.jsx';
const labels = { measured: 'Nylig kildetid', stale: 'Eldre kildetid / cache', missing: 'Mangler', 'unknown-time': 'Ukjent kildetid' };
const time = value => value == null ? 'Ukjent' : new Date(value).toLocaleString('nb-NO', { timeZone: 'Europe/Oslo' });
const display = value => value == null ? '—' : typeof value === 'boolean' ? (value ? 'Ja' : 'Nei') : typeof value === 'number' ? value.toLocaleString('nb-NO', { maximumFractionDigits: 3 }) : value;
export default function HeatingView() {
  const [data, setData] = useState(null), [error, setError] = useState(false), [clock, setClock] = useState(Date.now());
  const [connectionVersion,setConnectionVersion]=useState(0);
  const [search, setSearch] = useState(''), [category, setCategory] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let alive = true, timer;
    async function load() {
      try {
        const response = await apiFetch('/api/heating', { signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const result = await response.json();
        if (alive) { setData(result); setClock(Date.now()); setError(false); }
      } catch (e) { if (alive && e.name !== 'AbortError') setError(true); }
      finally { if (alive) timer = setTimeout(load, 60000); }
    }
    load(); const tick = setInterval(() => setClock(Date.now()), 10000);
    return () => { alive = false; controller.abort(); clearTimeout(timer); clearInterval(tick); };
  }, [connectionVersion]);
  const normalized = useMemo(() => normalizeHeatingPoints(data?.points, { fetchedAt: data?.fetchedAt, now: clock }), [data, clock]);
  const categories = [...new Set(normalized.points.map(p => p.category).filter(Boolean))].sort();
  const rows = normalized.points.filter(p => (!category || category === p.category) && `${p.name || ''} ${p.id}`.toLocaleLowerCase('nb-NO').includes(search.toLocaleLowerCase('nb-NO')));
  const sourceFresh = !error && data?.status === 'ok' && normalized.fetchedAt != null && clock - normalized.fetchedAt <= 900000 && clock >= normalized.fetchedAt;
  const alarmsFresh = sourceFresh && data?.alarms?.available && data.alarms.fetchedAt != null && clock - data.alarms.fetchedAt <= 900000;
  return <section className="heating" aria-labelledby="heating-title">
    <header className="heating-head"><div><p className="heating-eyebrow">VARMEPUMPE · HUNSTEIN</p><h1 id="heating-title">Varmestyring</h1><p>NIBE F1255-12 R EM</p></div><span className="heating-badge">Kun lesing</span></header>
    <div className="heating-status" role="status"><h2>{error ? 'Varmedata er utilgjengelig' : !data ? 'Henter tilkoblingsstatus…' : data.status === 'not_connected' ? 'myUplink er ikke tilkoblet' : sourceFresh ? 'Varmedata tilgjengelig' : 'Kilden er foreldet eller utilgjengelig'}</h2><p>{error ? 'Eventuelle tidligere målinger vises som foreldet.' : data?.reason}</p>{data?.status === 'not_connected' && <p>Lesetilgang og riktig enhet må godkjennes før tilkobling. Ingen innstillinger på varmepumpen endres her.</p>}</div>
    <HeatingConnection connection={data?.connection} onChange={()=>setConnectionVersion(v=>v+1)} />
    <div className="heating-cards"><article><h2>Målepunkter</h2><strong>{data?.points == null ? '—' : normalized.points.length}</strong><p>Faktiske punkter fra myUplink</p></article><article><h2>Aktive systemvarsler</h2><strong>{alarmsFresh ? data.alarms.count : 'Ukjent'}</strong><p>{alarmsFresh ? 'Hele myUplink-systemet, ikke bare varmepumpen' : 'Ingen bekreftet, fersk varselstatus'}</p></article><article><h2>Sist hentet</h2><strong className="heating-date">{time(normalized.fetchedAt)}</strong><p>Hentetid er forskjellig fra måletid · Europe/Oslo</p></article></div>
    <article className="heating-panel"><h2>Temperaturer og driftsdata</h2><p>Varme, varmtvann og kompressor vises med navn og kategorier fra kilden når disse er tilgjengelige.</p><div className="heating-filters"><label>Søk etter navn eller ID<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk i målepunkter" /></label><label>Kategori<select aria-label="Kategori" value={category} onChange={e => setCategory(e.target.value)}><option value="">Alle kategorier</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label></div>
    <p>Kildetid og hentetid er forskjellige. Eldre kildetid kan være siste verdiendring, særlig for innstillinger; den beviser ikke databrudd.</p>
    {rows.length ? <div className="heating-table"><table><thead><tr><th>Målepunkt</th><th>Verdi</th><th>Kategori</th><th>Kildens tidspunkt</th><th>Datakvalitet</th></tr></thead><tbody>{rows.map((p,i) => <tr key={`${p.id}-${i}`}><td>{p.name || 'Uten navn'}<small>ID {p.id}</small></td><td>{p.invalidSentinel?'Ugyldig kildeverdi':p.enumLabel||`${display(p.value)} ${p.unit||''}`}{p.enumLabel&&<small>Kode {display(p.value)} · enhet fra API tolkes ikke som fysisk måling</small>}</td><td>{p.category || 'Ukjent'}</td><td>{time(p.measuredAt)}</td><td>{labels[p.quality === 'measured' && !sourceFresh ? 'stale' : p.quality]}</td></tr>)}</tbody></table></div> : <p className="heating-empty">{normalized.points.length ? 'Ingen målepunkter passer søket.' : 'Ingen målinger tilgjengelig ennå. Manglende data vises aldri som null forbruk.'}</p>}
    {(normalized.skipped > 0 || normalized.truncated) && <p>Ugyldige punkter utelatt: {normalized.skipped}. {normalized.truncated && 'Visningen er begrenset til 1000 punkter.'}</p>}</article>
    <aside className="heating-panel"><h2>Hva tallene kan fortelle</h2><p>EM gjelder avgitt varmeenergi. Det er ikke det samme som strømforbruk. COP og besparelser krever verifiserte, sammenlignbare målinger av både tilført strøm og avgitt varme.</p><p>Serveren har separat historikklogging. AI-optimalisering og fysisk styring er ikke aktivert i denne visningen. Ingen temperaturgrenser eller parameter-ID-er er gjettet.</p></aside>
  </section>;
}
