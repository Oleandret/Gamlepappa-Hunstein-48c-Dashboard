import { useCallback, useEffect, useState } from 'react';
import { Bot, Play, Pause, Trash2, RefreshCw, Loader, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Activity, Sparkles, Clock } from 'lucide-react';
import { api } from '../../lib/api.js';

/**
 * AI-flows: brukerens kompilerte automatiseringer som server-en faktisk
 * kjører. Hver flow har en av/på-toggle, run-historikk og slett-knapp.
 */
export function AutoFlowsView() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [runs, setRuns] = useState({});  // flowId → runs[]
  const [error, setError] = useState(null);

  const reload = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.events.autoFlows(signal);
      setFlows(result?.flows || []);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    reload(ctrl.signal);
    return () => ctrl.abort();
  }, [reload]);

  const toggleEnabled = async (flow) => {
    try {
      await api.events.updateAutoFlow(flow.id, { enabled: !flow.enabled });
      setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, enabled: !flow.enabled } : f));
    } catch (err) {
      setError(err);
    }
  };

  const deleteFlow = async (flow) => {
    if (!confirm(`Slette automatiseringen "${flow.title}"?`)) return;
    try {
      await api.events.deleteAutoFlow(flow.id);
      setFlows(prev => prev.filter(f => f.id !== flow.id));
    } catch (err) {
      setError(err);
    }
  };

  const toggleExpanded = async (flow) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(flow.id)) next.delete(flow.id);
      else next.add(flow.id);
      return next;
    });
    if (!runs[flow.id]) {
      try {
        const res = await api.events.autoFlowRuns(flow.id);
        setRuns(prev => ({ ...prev, [flow.id]: res?.runs || [] }));
      } catch (err) {
        console.warn('Failed to load runs:', err.message);
      }
    }
  };

  const enabledCount = flows.filter(f => f.enabled).length;
  const totalRuns = flows.reduce((s, f) => s + (f.run_count || 0), 0);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 panel p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="panel-title flex items-center gap-2">
              <Bot size={14} className="text-nx-cyan" /> AI-flows
            </p>
            <h1 className="text-xl font-semibold mt-1">
              {enabledCount} aktive · {flows.length - enabledCount} pauset · {totalRuns.toLocaleString('no-NO')} kjøringer totalt
            </h1>
            <p className="text-xs text-nx-mute mt-1 leading-relaxed max-w-2xl">
              Automatiseringer kompilert fra AI-forslag. Hver flow har en trigger (typisk en device-state-endring)
              som serveren lytter etter, og en eller flere handlinger som utføres når triggeren matcher.
              Du kan skru hver flow av/på og se historikk over kjøringer.
            </p>
          </div>
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

        {flows.length === 0 && !loading && (
          <div className="mt-4 rounded-lg border border-nx-line/60 bg-nx-panel/30 p-6 text-center">
            <Sparkles size={28} className="mx-auto text-nx-cyan mb-2" />
            <p className="text-sm">Ingen AI-flows ennå.</p>
            <p className="text-xs text-nx-mute mt-2 max-w-md mx-auto leading-relaxed">
              Gå til <strong>Innsikt</strong>-fanen, generer AI-forslag, og klikk <strong>Lag og aktiver</strong> på de du vil at serveren skal kjøre.
            </p>
          </div>
        )}
      </div>

      {flows.length > 0 && (
        <div className="col-span-12 space-y-2">
          {flows.map(flow => (
            <FlowCard
              key={flow.id}
              flow={flow}
              expanded={expanded.has(flow.id)}
              runs={runs[flow.id] || []}
              onToggleEnabled={() => toggleEnabled(flow)}
              onToggleExpanded={() => toggleExpanded(flow)}
              onDelete={() => deleteFlow(flow)}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="col-span-12 panel p-3 border border-nx-red/40 bg-nx-red/10 text-xs text-nx-red">
          Feil: {error.message}
        </div>
      )}
    </div>
  );
}

function FlowCard({ flow, expanded, runs, onToggleEnabled, onToggleExpanded, onDelete }) {
  const triggerDesc = describeTrigger(flow.trigger);
  const actionsDesc = Array.isArray(flow.actions)
    ? flow.actions.map(describeAction).join(' + ')
    : '—';
  const status = flow.last_run_ok === false
    ? 'error'
    : flow.last_run_ok === true
    ? 'ok'
    : 'idle';
  const cardColor = flow.enabled
    ? (status === 'error' ? 'border-nx-red/40' : 'border-nx-cyan/30')
    : 'border-nx-line/40 opacity-70';

  return (
    <div className={`panel border ${cardColor}`}>
      <div className="p-3 flex items-start gap-3">
        <button
          type="button"
          onClick={onToggleEnabled}
          aria-pressed={flow.enabled}
          className={[
            'shrink-0 grid h-9 w-9 place-items-center rounded-full transition-colors',
            flow.enabled
              ? 'bg-nx-cyan/15 text-nx-cyan border border-nx-cyan/55 shadow-glow-soft'
              : 'bg-nx-panel/40 text-nx-mute border border-nx-line/60 hover:text-nx-text'
          ].join(' ')}
          title={flow.enabled ? 'Skru av' : 'Skru på'}
        >
          {flow.enabled ? <Play size={14} fill="currentColor" /> : <Pause size={14} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">{flow.title}</h3>
            {flow.enabled ? (
              <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-nx-cyan">AKTIV</span>
            ) : (
              <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-nx-mute">PAUSET</span>
            )}
            {status === 'error' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-nx-red">
                <AlertCircle size={10} /> Siste kjøring feilet
              </span>
            )}
          </div>
          {flow.description && (
            <p className="text-xs text-nx-mute mt-0.5 truncate">{flow.description}</p>
          )}
          <div className="mt-1.5 text-[11px] grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="rounded border border-nx-line/40 bg-nx-bg/40 px-2 py-1">
              <span className="text-[9px] uppercase tracking-[0.18em] text-nx-mute font-mono mr-1.5">Når</span>
              <span className="text-nx-cyan">{triggerDesc}</span>
            </div>
            <div className="rounded border border-nx-line/40 bg-nx-bg/40 px-2 py-1">
              <span className="text-[9px] uppercase tracking-[0.18em] text-nx-mute font-mono mr-1.5">Gjør</span>
              <span className="text-nx-cyan">{actionsDesc}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0 text-[10px] font-mono text-nx-mute">
          <span className="tabular-nums">{flow.run_count || 0} runs</span>
          {flow.last_run_at && (
            <span className="text-nx-mute" title={new Date(flow.last_run_at).toLocaleString('no-NO')}>
              Sist: {formatRelativeTime(new Date(flow.last_run_at).getTime())}
            </span>
          )}
          <div className="flex items-center gap-1 mt-1">
            <button
              type="button"
              onClick={onToggleExpanded}
              className="text-nx-mute hover:text-nx-cyan p-1"
              aria-label="Vis historikk"
              title="Vis run-historikk"
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-nx-mute hover:text-nx-red p-1"
              aria-label="Slett"
              title="Slett denne flowen"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-nx-line/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute mb-1.5 flex items-center gap-1.5">
            <Clock size={11} /> Run-historikk (siste 50)
          </p>
          {runs.length === 0 ? (
            <p className="text-xs text-nx-mute italic">Ingen kjøringer ennå.</p>
          ) : (
            <ul className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
              {runs.map(r => (
                <li key={r.id} className="flex items-center gap-2 text-[11px] border border-nx-line/30 rounded px-2 py-1">
                  <span className={r.ok ? 'text-nx-green' : 'text-nx-red'}>
                    {r.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                  </span>
                  <span className="font-mono text-nx-mute tabular-nums w-12">
                    {r.duration_ms ? `${r.duration_ms}ms` : '—'}
                  </span>
                  <span className="text-nx-text flex-1 truncate">
                    {describeRun(r)}
                  </span>
                  <span className="font-mono text-[10px] text-nx-mute">
                    {new Date(r.run_at).toLocaleString('no-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function describeTrigger(t) {
  if (!t) return '—';
  if (t.type === 'device_change') {
    const cond = t.condition === 'becomes_true' ? 'slås på'
              : t.condition === 'becomes_false' ? 'slås av'
              : t.condition === 'equals' ? `= ${formatJsonVal(t.value)}`
              : 'endres';
    return `${t.deviceId?.slice(0, 8)}… · ${t.capability} ${cond}`;
  }
  if (t.type === 'time') {
    return `kl ${String(t.hour).padStart(2, '0')}:${String(t.minute || 0).padStart(2, '0')}`;
  }
  return JSON.stringify(t).slice(0, 60);
}

function describeAction(a) {
  if (!a) return '—';
  if (a.type === 'set_capability') {
    return `${a.deviceId?.slice(0, 8)}… ${a.capability}=${formatJsonVal(a.value)}`;
  }
  if (a.type === 'run_flow') {
    return `kjør flow ${a.flowId}`;
  }
  return a.type;
}

function describeRun(r) {
  const event = r.trigger_event || {};
  const actions = Array.isArray(r.actions_result) ? r.actions_result : [];
  const errors = actions.filter(x => !x.ok).map(x => x.error);
  if (errors.length > 0) return `Feil: ${errors.join(', ')}`;
  return `Trigger: ${event.capability || '?'} → ${actions.length} actions OK`;
}

function formatJsonVal(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function formatRelativeTime(ts) {
  const diff = Date.now() - Number(ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}t`;
  return `${Math.floor(h / 24)}d`;
}
