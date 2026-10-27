import { useEffect, useMemo, useState } from 'react';
import { Activity, Lightbulb, Lock, Workflow, Thermometer, Footprints, DoorOpen, Siren } from 'lucide-react';
import { apiFetch } from '../lib/api.js';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'nå';
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} t`;
  const d = Math.round(h / 24);
  return `${d} d`;
}

const osloDay = ts => new Date(ts).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo' });
const clock = ts => new Date(ts).toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' });
function dayLabel(ts) {
  const today = osloDay(Date.now()), yesterday = osloDay(Date.now() - 86400000), d = osloDay(ts);
  if (d === today) return 'I dag';
  if (d === yesterday) return 'I går';
  return new Date(ts).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', weekday: 'long', day: 'numeric', month: 'long', year: new Date(ts).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

const ICONS = {
  motion: Footprints,
  door: DoorOpen,
  alarm: Siren,
  flow: Workflow,
  light: Lightbulb,
  thermo: Thermometer,
  security: Lock,
  default: Activity
};

const PERIODS = [[1, 'Døgn'], [7, 'Uke'], [30, '30 d'], [90, '90 d'], [365, 'År'], [3650, 'Alt']];
const DEFAULT_DAYS = 7;

/**
 * Aktivitet: sensorhendelser nyeste først. Standard er siste uke fra
 * forsidens polling; andre perioder og «Vis eldre» hentes her.
 */
export function ActivityFeed({ activity }) {
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [own, setOwn] = useState(null);           // første side for valgt periode (når ikke standard)
  const [older, setOlder] = useState([]);         // eldre sider hentet med «Vis eldre»
  const [more, setMore] = useState({ hasMore: true, loading: false, source: null });

  useEffect(() => {
    setOlder([]); setMore(m => ({ ...m, hasMore: true }));
    if (days === DEFAULT_DAYS) { setOwn(null); return; }
    const c = new AbortController();
    setOwn(null);
    apiFetch(`/api/homey/activity?days=${days}`, { signal: c.signal }).then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setOwn(d.activity || []); setMore({ hasMore: d.hasMore, loading: false, source: d.source }); } }).catch(() => {});
    return () => c.abort();
  }, [days]);

  const first = days === DEFAULT_DAYS ? (activity || []) : (own || []);
  const list = useMemo(() => {
    const seen = new Set();
    return [...first, ...older].filter(ev => { const k = ev.id || `${ev.ts}:${ev.text}`; if (seen.has(k)) return false; seen.add(k); return true; });
  }, [first, older]);

  async function loadOlder() {
    const oldest = list.at(-1)?.ts;
    if (!oldest) return;
    setMore(m => ({ ...m, loading: true }));
    try {
      const r = await apiFetch(`/api/homey/activity?days=${days}&before=${oldest}&limit=100`);
      const d = r.ok ? await r.json() : null;
      setOlder(o => [...o, ...(d?.activity || [])]);
      setMore({ hasMore: !!d?.hasMore, loading: false, source: d?.source || null });
    } catch { setMore(m => ({ ...m, loading: false })); }
  }

  let lastDay = null;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="panel-title">Aktivitet</p>
        <select aria-label="Periode for aktivitet" value={days} onChange={e => setDays(Number(e.target.value))}
          className="rounded border border-nx-line/60 bg-nx-bg px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-nx-mute">
          {PERIODS.map(([d, l]) => <option key={d} value={d}>{l}</option>)}
        </select>
      </div>
      <ul className="mt-3 space-y-2 max-h-96 overflow-y-auto pr-1">
        {list.map((ev, i) => {
          const Icon = ICONS[ev.type] || ICONS.default;
          const tone = ev.type === 'alarm' && ev.active ? 'bg-nx-red/15 text-nx-red' : ev.type === 'door' && ev.active ? 'bg-nx-amber/15 text-nx-amber' : 'bg-nx-cyan/10 text-nx-cyan';
          const day = dayLabel(ev.ts), header = day !== lastDay;
          lastDay = day;
          return (
            <li key={ev.id || i}>
              {header && <p className="sticky top-0 z-10 bg-nx-bg/90 backdrop-blur px-1 py-1 text-[10px] uppercase tracking-[0.16em] text-nx-mute font-mono">{day}</p>}
              <div className="flex items-start gap-2.5 rounded-lg border border-nx-line/40 bg-nx-panel/40 px-2.5 py-2">
                <div className={`grid h-7 w-7 place-items-center rounded-md shrink-0 ${tone}`}>
                  <Icon size={14}/>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm leading-tight truncate" title={ev.text}>{ev.text}</div>
                  <div className="mt-0.5 text-[11px] text-nx-mute font-mono" title={ev.timeSource === 'observert' ? 'Tidspunktet dashboardet så endringen' : 'Sensorens tidspunkt'}>
                    {clock(ev.ts)} · {timeAgo(ev.ts) === 'nå' ? 'nå' : `${timeAgo(ev.ts)} siden`}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="text-sm text-nx-mute">{days !== DEFAULT_DAYS && own === null ? 'Henter …' : 'Ingen sensorhendelser i perioden.'}</li>
        )}
        {list.length > 0 && more.hasMore && (
          <li><button type="button" onClick={loadOlder} disabled={more.loading} className="w-full rounded-lg border border-nx-line/60 py-1.5 text-xs text-nx-mute hover:text-nx-cyan hover:border-nx-cyan/40">{more.loading ? 'Henter …' : 'Vis eldre'}</button></li>
        )}
      </ul>
      {more.source === 'logg' && <p className="mt-2 text-[10px] text-nx-mute">Uten database beholdes bare 7 dager.</p>}
    </div>
  );
}
