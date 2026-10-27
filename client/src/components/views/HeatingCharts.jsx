import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { SeriesChart, historyTime } from '../HistoryCharts.jsx';

/**
 * «Grafer» under Varmestyring: historikk for alle temperaturmålere, både
 * varmepumpens (myUplink, 30 dager) og romfølerne i Homey (hendelsesloggen).
 */
const PERIODS = [[1, 'Siste døgn'], [7, 'Siste uke'], [30, 'Siste 30 dager'], [365, 'Siste år']];
const tickFor = days => days <= 1
  ? t => new Date(t).toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' })
  : t => new Date(t).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'short' });

function Section({ title, intro, part, days, bucketMinutes, filter }) {
  if (!part) return null;
  const series = part.series.filter(s => `${s.name} ${s.zone || ''} ${s.id}`.toLocaleLowerCase('nb-NO').includes(filter));
  return (
    <section className="heating-panel">
      <h2>{title} <span className="heating-count">{series.length}</span></h2>
      <p>{intro}</p>
      {!part.available
        ? <p className="heating-empty">{part.reason || 'Historikken er ikke tilgjengelig.'}</p>
        : !series.length
          ? <p className="heating-empty">{part.series.length ? 'Ingen målere passer søket.' : 'Ingen lagrede temperaturmålinger i perioden.'}</p>
          : <div className="heating-chart-grid">
              {series.map(s => (
                <SeriesChart key={s.id} title={s.name} subtitle={s.zone || undefined} points={s.points} unit={s.unit}
                  gapMs={bucketMinutes * 60000 * 3} tickFormat={tickFor(days)} />
              ))}
            </div>}
    </section>
  );
}

export function HeatingCharts() {
  const [days, setDays] = useState(7), [data, setData] = useState(null), [error, setError] = useState(''), [search, setSearch] = useState('');
  useEffect(() => {
    const c = new AbortController();
    setData(null); setError('');
    apiFetch(`/api/history/temperatures?days=${days}`, { signal: c.signal })
      .then(async r => { if (!r.ok) throw Error('Temperaturhistorikken kunne ikke leses'); setData(await r.json()); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => c.abort();
  }, [days]);
  const filter = search.toLocaleLowerCase('nb-NO');
  const bucket = data?.bucketMinutes;
  return (
    <div>
      <div className="heating-filters">
        <label>Periode<select value={days} onChange={e => setDays(Number(e.target.value))}>{PERIODS.map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select></label>
        <label>Søk etter måler eller rom<input value={search} onChange={e => setSearch(e.target.value)} placeholder="F.eks. tur, varmtvann, stue" /></label>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Laster temperaturhistorikk…</p>}
      {data && <>
        <p>Hvert punkt er snittet av målingene per {bucket === 1440 ? 'døgn' : bucket === 60 ? 'time' : bucket > 60 ? `${bucket / 60} timer` : `${bucket} minutter`}. Tomme perioder vises som brudd i linja, ikke som null. {data.note}</p>
        <Section title="Varmepumpe" days={days} bucketMinutes={bucket} filter={filter} part={data.heatpump}
          intro={`Temperaturer fra NIBE via myUplink. Loggen beholdes i ${data.heatpump?.retentionDays || 30} dager${data.heatpump?.startedAt ? ` og starter ${historyTime(data.heatpump.startedAt)}` : ''}.`} />
        <Section title="Romfølere" days={days} bucketMinutes={bucket} filter={filter} part={data.rooms}
          intro="Alle temperaturfølere i Homey, også utendørs, fra dashboardets hendelseslogg. Historikken finnes fra loggen ble startet." />
      </>}
    </div>
  );
}
