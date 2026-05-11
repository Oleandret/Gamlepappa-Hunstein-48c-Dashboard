import { useCallback, useEffect, useState } from 'react';
import { Activity, Database, RefreshCw, AlertCircle, CheckCircle2, Clock, Layers, Filter, Loader, Sparkles, ListChecks, Check, X, Pause, Cpu, Brain, HardDrive, Wifi, ServerCog } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAiModels, AVAILABLE_MODELS } from '../../lib/useAiModels.js';

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
  const [patterns, setPatterns] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ kind: '', sinceMinutes: 1440 }); // 24h default

  const reload = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const [st, sum, ev, pats, sugs] = await Promise.all([
        api.events.status(signal),
        api.events.summary(signal).catch(() => null),
        api.events.recent({ ...filter, limit: 200 }, signal).catch(() => ({ events: [] })),
        api.events.patterns(signal).catch(() => ({ patterns: [] })),
        api.events.suggestions(undefined, signal).catch(() => ({ suggestions: [] }))
      ]);
      setStatus(st);
      setSummary(sum && !sum._disabled ? sum : null);
      setEvents(ev?.events || []);
      setPatterns(pats?.patterns || []);
      setSuggestions(sugs?.suggestions || []);
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
      setTimeout(() => reload(), 600);
    } catch (err) {
      setError(err);
    } finally {
      setPolling(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { result } = await api.events.analyze();
      if (result?.error) setError(new Error(result.error));
      setTimeout(() => reload(), 300);
    } catch (err) {
      setError(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { result } = await api.events.generateSuggestions();
      if (result?.error) setError(new Error(result.error));
      setTimeout(() => reload(), 300);
    } catch (err) {
      setError(err);
    } finally {
      setGenerating(false);
    }
  };

  const setSuggestionStatus = async (id, status) => {
    try {
      await api.events.updateSuggestionStatus(id, status);
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    } catch (err) {
      setError(err);
    }
  };

  const aiModels = useAiModels();
  const [compilingId, setCompilingId] = useState(null);
  const compileSuggestion = async (id) => {
    setCompilingId(id);
    setError(null);
    try {
      const result = await api.events.compileSuggestion(id);
      if (result?.flowId) {
        setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'accepted' } : s));
        alert(`Auto-flow opprettet (id ${result.flowId})! Gå til "AI-flows"-fanen for å skru den på.`);
      } else if (result?.error) {
        setError(new Error(result.error));
      }
    } catch (err) {
      setError(err);
    } finally {
      setCompilingId(null);
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
            <h1 className="text-xl font-semibold mt-1">Device-event-historikk og AI-forslag</h1>
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
              {polling ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
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

        <SystemHealthBanner status={status} />
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

      {/* AI-forslag — øverst, viktigst */}
      <div className="col-span-12 panel p-4 border-nx-cyan/30">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <p className="panel-title flex items-center gap-2">
              <Sparkles size={14} className="text-nx-cyan" /> AI-forslag til automatiseringer
            </p>
            <p className="text-[10px] text-nx-mute font-mono mt-0.5">
              {status?.llm
                ? 'GPT analyserer mønstre og foreslår nye flows'
                : 'Sett OPENAI_API_KEY på serveren for å aktivere'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={aiModels.config.suggestions}
              onChange={(e) => aiModels.set('suggestions', e.target.value)}
              className="bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-[11px] text-nx-cyan font-mono"
              title="Velg AI-modell for forslags-generering"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
              {!AVAILABLE_MODELS.find(m => m.id === aiModels.config.suggestions) && (
                <option value={aiModels.config.suggestions}>{aiModels.config.suggestions}</option>
              )}
            </select>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!dbEnabled || !status?.llm || generating}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-[0.16em] transition-colors border',
                (dbEnabled && status?.llm)
                  ? 'border-nx-cyan/55 bg-nx-cyan/15 text-nx-cyan hover:bg-nx-cyan/25'
                  : 'border-nx-line/40 text-nx-mute opacity-50 cursor-not-allowed'
              ].join(' ')}
              title={!status?.llm ? 'OPENAI_API_KEY må settes på serveren' : 'Generer nye forslag med GPT'}
            >
              {generating ? <Loader size={12} className="animate-spin" /> : <Brain size={12} />}
              Generer forslag
            </button>
          </div>
        </div>
        <SuggestionList
          suggestions={suggestions}
          onStatus={setSuggestionStatus}
          onCompile={compileSuggestion}
          compiling={compilingId}
        />
      </div>

      {/* Patterns — under */}
      <div className="col-span-12 panel p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <p className="panel-title flex items-center gap-2">
              <ListChecks size={14} className="text-nx-cyan" /> Observerte mønstre
            </p>
            <p className="text-[10px] text-nx-mute font-mono mt-0.5">
              SQL-detektor finner co-occurrence og tidsbaserte mønstre i siste 30 dager
            </p>
          </div>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!dbEnabled || analyzing}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-[0.16em] transition-colors border',
              dbEnabled
                ? 'border-nx-cyan/55 bg-nx-cyan/10 text-nx-cyan hover:bg-nx-cyan/25'
                : 'border-nx-line/40 text-nx-mute opacity-50 cursor-not-allowed'
            ].join(' ')}
          >
            {analyzing ? <Loader size={12} className="animate-spin" /> : <Cpu size={12} />}
            Analyser nå
          </button>
        </div>
        <PatternList patterns={patterns} />
      </div>

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

function SystemHealthBanner({ status }) {
  if (!status) {
    return (
      <div className="mt-4 rounded-lg border border-nx-line/60 bg-nx-panel/30 p-3 text-xs text-nx-mute font-mono">
        Laster status...
      </div>
    );
  }

  const db = status.db;
  const pollerOk = status.poller?.running === true && status.poller?.lastPollResult?.ok !== false;
  const storage = status.storage || {};
  const storageOk = storage.writable === true;
  const llm = status.llm;
  const homey = status.homey || status.demo;
  const dbInfo = status.database || {};

  // Samlet helse
  const allCritical = db && pollerOk && storageOk && homey;
  const headerTone = allCritical ? 'green' : (db || storageOk) ? 'amber' : 'red';

  return (
    <div className="mt-4 space-y-2">
      {/* Samlet status-header */}
      <div className={[
        'rounded-lg border px-3 py-2 flex items-center gap-2 text-sm',
        headerTone === 'green' ? 'border-nx-green/45 bg-nx-green/10 text-nx-green'
          : headerTone === 'amber' ? 'border-nx-amber/45 bg-nx-amber/10 text-nx-amber'
          : 'border-nx-red/45 bg-nx-red/10 text-nx-red'
      ].join(' ')}>
        {headerTone === 'green'
          ? <CheckCircle2 size={18} />
          : <AlertCircle size={18} />}
        <span className="font-semibold">
          {headerTone === 'green'
            ? 'Systemet er online og logger data'
            : headerTone === 'amber'
            ? 'Systemet er delvis konfigurert — se detaljer under'
            : 'Systemet er ikke klart for innsikt'}
        </span>
        {llm
          ? <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em]"><Sparkles size={11}/> AI klar</span>
          : <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] text-nx-mute">AI ikke konfigurert</span>
        }
      </div>

      {/* Komponent-grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <HealthCard
          Icon={Wifi}
          label="Homey-tilkobling"
          ok={homey}
          okText={status.demo ? 'Demo-data' : 'Tilkoblet (PAT satt)'}
          failText="PAT mangler"
          tone={status.demo ? 'amber' : 'green'}
        />
        <HealthCard
          Icon={Database}
          label="Postgres-database"
          ok={db}
          okText={dbInfo.timescale ? 'Tilkoblet · TimescaleDB' : 'Tilkoblet'}
          failText="DATABASE_URL ikke satt"
          tone="green"
          extra={db && dbInfo.events
            ? `${(dbInfo.events.total_events || 0).toLocaleString('no-NO')} events lagret`
            : null}
        />
        <HealthCard
          Icon={HardDrive}
          label="Disk-lagring"
          ok={storageOk}
          okText={storage.freeBytes != null
            ? `Skrivbar · ${formatBytes(storage.freeBytes)} ledig`
            : 'Skrivbar'}
          failText="Ikke skrivbar"
          tone="green"
          extra={storageOk
            ? (storage.fileSizeBytes != null
                ? `${storage.configPath} (${formatBytes(storage.fileSizeBytes)})`
                : storage.configPath)
            : (storage.hint || storage.error || storage.configPath)}
        />
        <HealthCard
          Icon={ServerCog}
          label="Device-poller"
          ok={pollerOk}
          okText={status.poller?.intervalMs
            ? `Aktiv · hvert ${Math.round(status.poller.intervalMs / 60000)} min`
            : 'Aktiv'}
          failText={status.db ? 'Stoppet' : 'Krever database'}
          tone="green"
          extra={status.poller?.lastPollAt
            ? `Sist: ${formatRelativeTime(status.poller.lastPollAt)} · ${status.poller.cachedDevices} enheter`
            : 'Ikke kjørt enda'}
        />
        <HealthCard
          Icon={Brain}
          label="AI (OpenAI)"
          ok={llm}
          okText="API-key satt · forslag tilgjengelig"
          failText="OPENAI_API_KEY mangler"
          tone="cyan"
        />
      </div>

      {/* Last-poll-info */}
      {status?.poller?.lastPollResult && (
        <p className="text-[10px] font-mono text-nx-mute mt-1">
          Siste poll: {status.poller.lastPollResult.ok
            ? `${status.poller.lastPollResult.transitions} transitions, ${status.poller.lastPollResult.snapshots} snapshots, ${status.poller.lastPollResult.durationMs}ms`
            : `feilet — ${status.poller.lastPollResult.error}`}
          {dbInfo.events?.oldest_ts && ` · Eldste event: ${new Date(dbInfo.events.oldest_ts).toLocaleString('no-NO')}`}
          {dbInfo.patterns?.active > 0 && ` · ${dbInfo.patterns.active} aktive mønstre`}
          {dbInfo.suggestions?.pending > 0 && ` · ${dbInfo.suggestions.pending} ulest forslag`}
        </p>
      )}
    </div>
  );
}

function HealthCard({ Icon, label, ok, okText, failText, extra, tone = 'green' }) {
  const colorClasses = ok
    ? (tone === 'cyan'
        ? 'border-nx-cyan/45 bg-nx-cyan/10 text-nx-cyan'
        : 'border-nx-green/45 bg-nx-green/10 text-nx-green')
    : 'border-nx-amber/45 bg-nx-amber/10 text-nx-amber';
  return (
    <div className={`rounded-lg border p-2.5 ${colorClasses}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-nx-mute">
        <Icon size={11} aria-hidden="true" /> {label}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {ok
          ? <CheckCircle2 size={13} className="shrink-0" />
          : <AlertCircle size={13} className="shrink-0" />}
        <span className="text-xs font-semibold truncate">{ok ? okText : failText}</span>
      </div>
      {extra && (
        <p
          className={`mt-0.5 text-[10px] font-mono ${ok ? 'text-nx-mute' : 'text-nx-amber/80'} leading-snug`}
          title={extra}
        >
          {extra}
        </p>
      )}
    </div>
  );
}

function formatBytes(b) {
  if (!Number.isFinite(b)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let n = b;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
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

function SuggestionList({ suggestions, onStatus, onCompile, compiling }) {
  // Skill mellom pending (vises store) og besluttede (vises som kompakt liste)
  const pending = suggestions.filter(s => s.status === 'pending');
  const reviewed = suggestions.filter(s => s.status !== 'pending');

  if (suggestions.length === 0) {
    return (
      <p className="text-xs text-nx-mute italic py-4 text-center">
        Ingen forslag ennå. Klikk <strong>Generer forslag</strong> over når du har minst en ukes data.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {pending.map(s => <SuggestionCard key={s.id} s={s} onStatus={onStatus} onCompile={onCompile} compiling={compiling === s.id} />)}
      </ul>
      {reviewed.length > 0 && (
        <details className="mt-3">
          <summary className="text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute cursor-pointer hover:text-nx-cyan">
            Tidligere vurderte ({reviewed.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {reviewed.map(s => (
              <li key={s.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded border border-nx-line/30 opacity-70">
                <span className={`font-mono text-[10px] uppercase tracking-[0.16em] w-16 ${
                  s.status === 'accepted' ? 'text-nx-green' :
                  s.status === 'rejected' ? 'text-nx-red' : 'text-nx-mute'
                }`}>{s.status}</span>
                <span className="truncate flex-1">{s.title}</span>
                <button
                  onClick={() => onStatus(s.id, 'pending')}
                  className="text-[10px] text-nx-mute hover:text-nx-cyan"
                  title="Marker som ulest"
                >gjenopprett</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function SuggestionCard({ s, onStatus, onCompile, compiling }) {
  const conf = s.confidence || 'medium';
  const confClass = conf === 'high' ? 'text-nx-green' : conf === 'low' ? 'text-nx-mute' : 'text-nx-amber';
  return (
    <li className="rounded-xl border border-nx-cyan/30 bg-nx-panel/40 p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap">
        <h3 className="text-sm font-semibold flex-1 min-w-0">{s.title}</h3>
        <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${confClass}`}>
          {conf}
        </span>
      </div>
      <p className="text-xs text-nx-text mb-2 leading-relaxed">{s.description}</p>
      {(s.trigger_text || s.action_text) && (
        <div className="text-[11px] grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
          {s.trigger_text && (
            <div className="rounded border border-nx-line/40 bg-nx-bg/40 p-2">
              <div className="text-[9px] uppercase tracking-[0.18em] text-nx-mute font-mono mb-0.5">Trigger</div>
              <div className="text-nx-cyan">{s.trigger_text}</div>
            </div>
          )}
          {s.action_text && (
            <div className="rounded border border-nx-line/40 bg-nx-bg/40 p-2">
              <div className="text-[9px] uppercase tracking-[0.18em] text-nx-mute font-mono mb-0.5">Handling</div>
              <div className="text-nx-cyan">{s.action_text}</div>
            </div>
          )}
        </div>
      )}
      {s.why && (
        <p className="text-[10px] text-nx-mute italic mb-2 leading-relaxed">
          Hvorfor: {s.why}
        </p>
      )}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <button
          onClick={() => onCompile?.(s.id)}
          disabled={compiling}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-[0.16em] bg-nx-cyan/15 text-nx-cyan hover:bg-nx-cyan/25 shadow-glow-soft disabled:opacity-50 disabled:cursor-wait"
          title="Kompiler til auto-flow som serveren kjører"
        >
          {compiling ? <Loader size={11} className="animate-spin" /> : <Sparkles size={11} />}
          Lag og aktiver
        </button>
        <button
          onClick={() => onStatus(s.id, 'accepted')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-[0.16em] bg-nx-green/15 text-nx-green hover:bg-nx-green/25"
        >
          <Check size={11} /> Akseptert
        </button>
        <button
          onClick={() => onStatus(s.id, 'later')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-[0.16em] border border-nx-line/60 text-nx-mute hover:text-nx-text"
        >
          <Pause size={11} /> Senere
        </button>
        <button
          onClick={() => onStatus(s.id, 'rejected')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-[0.16em] border border-nx-line/60 text-nx-mute hover:text-nx-red"
        >
          <X size={11} /> Nei takk
        </button>
        <span className="ml-auto text-[9px] font-mono text-nx-mute">
          {s.model || ''}
        </span>
      </div>
    </li>
  );
}

function PatternList({ patterns }) {
  if (patterns.length === 0) {
    return (
      <p className="text-xs text-nx-mute italic py-4 text-center">
        Ingen mønstre ennå. Klikk <strong>Analyser nå</strong> over (best resultat etter 7-14 dagers data).
      </p>
    );
  }
  return (
    <ul className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
      {patterns.map(p => (
        <li key={p.id} className="rounded-md border border-nx-line/40 bg-nx-panel/30 px-2 py-1.5 text-xs">
          <div className="flex items-start gap-2">
            <span className={[
              'font-mono text-[9px] uppercase tracking-[0.16em] w-24 shrink-0 mt-0.5',
              p.kind === 'co_occurrence' ? 'text-nx-cyan' : 'text-nx-purple'
            ].join(' ')}>
              {p.kind === 'co_occurrence' ? 'co-occur' : 'tidsbasert'}
            </span>
            <span className="flex-1 text-nx-text leading-snug">{p.description}</span>
            <span className="font-mono text-[10px] text-nx-mute tabular-nums shrink-0">
              skår {(p.score || 0).toFixed(2)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
