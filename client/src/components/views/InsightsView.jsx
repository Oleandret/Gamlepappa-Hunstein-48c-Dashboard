import { useCallback, useEffect, useState } from 'react';
import { Activity, Database, RefreshCw, AlertCircle, CheckCircle2, Clock, Layers, Filter, Loader } from 'lucide-react';
import { api } from '../../lib/api.js';

/**
 * Innsikt — admin-view for device-event-historikken.
 *
 * Viser:
 *  - Status om DB + poller er aktivert
 *  - Sammendrag siste 24t (top capabilities, top devices)
 *  - Tabell med siste rå events med filter
 *  - 'Poll nå'-knapp for å trigge en poll manuelt
 *
 * Lag 2 (heuristiske patterns) og lag 3 (LLM-forslag) kommer senere som
 * tilleggs-paneler her.
 */
export function InsightsView() {
  const [status, setStatus] = useState(null);
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ kind: '', sinceMinutes: 1440 }); // 24h default

  const reload = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const [st, sum, ev] = await Promise.all([
        api.events.status(signal),
        api.events.summary(signal).catch(() => null),
        api.events.recent({ ...filter, limit: 200 }, signal).catch(() => ({ events: [] }))
      ]);
      setStatus(st);
      setSummary(sum && !sum._disabled ? sum : null);
      setEvents(ev?.events || []);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const ctrl = new AbortController();
    reload(ctrl.signal);
    return () => ctrl.abort();
  }, [reload]);

  const handlePollNow = async () => {
    setPolling(true);
    try {
      await api.events.pollNow();
      // Vent 500ms før reload så DB er ferdig skrevet
      setTimeout(() => reload(), 600);
    } catch (err) {
      setError(err);
    } finally {
      setPolling(false);
    }
  };

  const dbEnabled = status?.db === true;
  const pollerRunning = status?.poller?.running === true;

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 panel p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="panel-title">Innsikt</p>
            <h1 className="text-xl font-semibold mt-1 flex items-center gap-2">
              {dbEnabled
                ? <CheckCircle2 size={20} className="text-nx-green" />
                : <AlertCircle size={20} className="text-nx-amber" />}
              Device-event-historikk
            </h1>
            <p className="text-xs text-nx-mute mt-1 leading-relaxed max-w-2xl">
              Server-side poller henter status fra alle Homey-enheter hvert 10. minutt og logger endringer i Postgres.
              Dette danner grunnlaget for AI-baserte forslag til nye automatiseringer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePollNow}
              disabled={!dbEnabled || polling}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-[0.16em] transition-colors border',
                dbEnabled
                  ? 'border-nx-cyan/55 bg-nx-cyan/10 text-nx-cyan hover:bg-nx-cyan/25'
                  : 'border-nx-line/40 text-nx-mute opacity-50 cursor-not-allowed'
              ].join(' ')}
            >
              {polling
                ? <Loader size={12} className="animate-spin" />
                : <RefreshCw size={12} />}
              Poll nå
            </button>
            <button
              type="button"
              onClick={() => reload()}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-[0.16em] border border-nx-line/60 text-nx-mute hover:text-nx-text"
            >
              {loading ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh
            </button>
          </div>
        </div>

        {!dbEnabled && (
          <div className="mt-4 rounded-lg border border-nx-amber/40 bg-nx-amber/10 p-3 text-xs text-nx-amber">
            <strong className="block mb-1">Database ikke konfigurert</strong>
            Sett <code className="font-mono">DATABASE_URL</code> som env-variabel på serveren. På Railway:
            legg til Postgres-add-on og koble til denne tjenesten — variabelen settes automatisk.
            Etter første deploy kjøres migrations idempotent på app-start.
          </div>
        )}

        {dbEnabled && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatTile
              Icon={Database}
              label="Database"
              value="Tilkoblet"
              tone="green"
            />
            <StatTile
              Icon={Activity}
              label="Poller"
              value={pollerRunning ? `Hvert ${Math.round((status.poller.intervalMs || 0) / 60000)} min` : 'Stoppet'}
              tone={pollerRunning ? 'green' : 'amber'}
            />
            <StatTile
              Icon={Layers}
              label="Cached enheter"
              value={status.poller?.cachedDevices || 0}
              tone="cyan"
            />
            <StatTile
              Icon={Clock}
              label="Siste poll"
              value={status.poller?.lastPollAt
                ? formatRelativeTime(status.poller.lastPollAt)
                : 'Aldri'}
              tone="cyan"
            />
          </div>
        )}

        {status?.poller?.lastPollResult && (
          <p className="mt-2 text-[10px] font-mono text-nx-mute">
            {status.poller.lastPollResult.ok
              ? `${status.poller.lastPollResult.transitions} transitions, ${status.poller.lastPollResult.snapshots} snapshots, ${status.poller.lastPollResult.durationMs}ms`
              : `Feil: ${status.poller.lastPollResult.error}`}
          </p>
        )}
      </div>

      {summary && (
        <>
          <div className="col-span-12 md:col-span-6 panel p-4">
            <p className="panel-title mb-2">Mest aktive capabilities (24t)</p>
            {summary.byCapability.length === 0
              ? <p className="text-xs text-nx-mute italic">Ingen events ennå.</p>
              : (
                <ul className="space-y-1.5">
                  {summary.byCapability.map(c => (
                    <li key={c.capability} className="flex items-center gap-2">
                      <span className="font-mono text-xs text-nx-cyan flex-1 truncate">{c.capability}</span>
                      <BarMini value={c.count} max={summary.byCapability[0].count} />
                      <span className="font-mono text-xs tabular-nums w-12 text-right text-nx-text">{c.count}</span>
                    </li>
                  ))}
                </ul>
              )
            }
          </div>
          <div className="col-span-12 md:col-span-6 panel p-4">
            <p className="panel-title mb-2">Mest aktive enheter (24t)</p>
            {summary.byDevice.length === 0
              ? <p className="text-xs text-nx-mute italic">Ingen events ennå.</p>
              : (
                <ul className="space-y-1.5">
                  {summary.byDevice.map(d => (
                    <li key={d.device_id} className="flex items-center gap-2">
                      <span className="text-xs text-nx-text flex-1 truncate">{d.device_name || d.device_id}</span>
                      {d.zone && <span className="text-[10px] font-mono text-nx-mute">{d.zone}</span>}
                      <BarMini value={d.count} max={summary.byDevice[0].count} />
                      <span className="font-mono text-xs tabular-nums w-12 text-right text-nx-text">{d.count}</span>
                    </li>
                  ))}
                </ul>
              )
            }
          </div>
        </>
      )}

      <div className="col-span-12 panel p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <p className="panel-title">Siste events ({events.length})</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={12} className="text-nx-mute" aria-hidden="true" />
            {[
              { value: '', label: 'Alle' },
              { value: 'transition', label: 'Transitions' },
              { value: 'snapshot', label: 'Snapshots' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(f => ({ ...f, kind: opt.value }))}
                aria-pressed={filter.kind === opt.value}
                className={[
                  'px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-[0.16em] border transition-colors',
                  filter.kind === opt.value
                    ? 'border-nx-cyan/55 bg-nx-cyan/15 text-nx-cyan'
                    : 'border-nx-line/60 text-nx-mute hover:text-nx-text'
                ].join(' ')}
              >{opt.label}</button>
            ))}
            <span className="text-[10px] text-nx-mute mx-2">·</span>
            {[
              { value: 60, label: '1t' },
              { value: 360, label: '6t' },
              { value: 1440, label: '24t' },
              { value: 10080, label: '7d' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(f => ({ ...f, sinceMinutes: opt.value }))}
                aria-pressed={filter.sinceMinutes === opt.value}
                className={[
                  'px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-[0.16em] border transition-colors',
                  filter.sinceMinutes === opt.value
                    ? 'border-nx-cyan/55 bg-nx-cyan/15 text-nx-cyan'
                    : 'border-nx-line/60 text-nx-mute hover:text-nx-text'
                ].join(' ')}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        {events.length === 0 ? (
          <p className="text-xs text-nx-mute italic py-6 text-center">
            {dbEnabled
              ? 'Ingen events i databasen ennå. Klikk "Poll nå" for å starte.'
              : 'Database ikke konfigurert.'}
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-nx-mute border-b border-nx-line/40">
                  <th className="py-1.5 pr-3">Tid</th>
                  <th className="py-1.5 pr-3">Type</th>
                  <th className="py-1.5 pr-3">Enhet</th>
                  <th className="py-1.5 pr-3">Rom</th>
                  <th className="py-1.5 pr-3">Capability</th>
                  <th className="py-1.5 pr-3">Fra</th>
                  <th className="py-1.5 pr-3">Til</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nx-line/30">
                {events.map(e => (
                  <tr key={e.id} className="hover:bg-nx-panel/40">
                    <td className="py-1 pr-3 text-nx-mute whitespace-nowrap">{formatTime(e.ts)}</td>
                    <td className="py-1 pr-3">
                      <span className={[
                        'rounded px-1 py-0.5 text-[9px] uppercase tracking-[0.16em]',
                        e.kind === 'snapshot' ? 'bg-nx-purple/15 text-nx-purple' : 'bg-nx-cyan/15 text-nx-cyan'
                      ].join(' ')}>
                        {e.kind}
                      </span>
                    </td>
                    <td className="py-1 pr-3 text-nx-text truncate max-w-[160px]" title={e.device_name}>{e.device_name || e.device_id}</td>
                    <td className="py-1 pr-3 text-nx-mute truncate max-w-[120px]">{e.zone || '—'}</td>
                    <td className="py-1 pr-3 text-nx-cyan">{e.capability}</td>
                    <td className="py-1 pr-3 text-nx-mute">{formatValue(e.prev_value)}</td>
                    <td className="py-1 pr-3 text-nx-text">{formatValue(e.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="col-span-12 panel p-3 border border-nx-red/40 bg-nx-red/10 text-xs text-nx-red">
          Feil: {error.message}
        </div>
      )}
    </div>
  );
}

function StatTile({ Icon, label, value, tone = 'cyan' }) {
  const colorClass = {
    green: 'text-nx-green',
    amber: 'text-nx-amber',
    cyan: 'text-nx-cyan',
    red: 'text-nx-red'
  }[tone] || 'text-nx-cyan';
  return (
    <div className="rounded-lg border border-nx-line/40 bg-nx-panel/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-nx-mute font-mono">
        <Icon size={11} aria-hidden="true" /> {label}
      </div>
      <div className={`mt-1 text-sm font-mono ${colorClass}`}>{value}</div>
    </div>
  );
}

function BarMini({ value, max }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="relative w-24 h-1.5 rounded-full bg-nx-panel/60 overflow-hidden">
      <div className="absolute inset-y-0 left-0 rounded-full bg-nx-cyan/60" style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = Date.now();
  const diffMin = Math.floor((now - d.getTime()) / 60000);
  if (diffMin < 1) return 'nå';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 60 * 24) return d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('no-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(ts) {
  const diff = Date.now() - Number(ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s siden`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  return `${h}t siden`;
}

function formatValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  if (typeof v === 'number') return v.toFixed(2).replace(/\.?0+$/, '');
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 24);
  return String(v).slice(0, 24);
}
