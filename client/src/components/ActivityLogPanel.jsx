import { useEffect, useRef, useState } from 'react';
import { Activity, Pin, PinOff, X, ChevronRight, Lightbulb, Lock, Workflow, Power, ShieldAlert } from 'lucide-react';
import { useActivityLog } from '../lib/activityLog.js';

/**
 * Floating left-edge activity log. Shows live events.
 * Auto-shows when new events arrive, auto-hides after `AUTOHIDE_MS`.
 * Hover keeps it open. Click pin to lock open.
 */

const AUTOHIDE_MS = 6000;

export function ActivityLogPanel({ pinned, onTogglePin }) {
  const entries = useActivityLog();
  const [open, setOpen] = useState(pinned);
  const hoverRef = useRef(false);
  const timerRef = useRef(null);
  const lastSeenIdRef = useRef(0);

  // Open on new events, then auto-hide after delay
  useEffect(() => {
    if (entries.length === 0) return;
    const newest = entries[0];
    if (newest.id > lastSeenIdRef.current) {
      lastSeenIdRef.current = newest.id;
      if (!pinned) {
        setOpen(true);
        scheduleHide();
      }
    }
  }, [entries, pinned]);

  useEffect(() => {
    if (pinned) {
      setOpen(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else if (!hoverRef.current) {
      scheduleHide();
    }
  }, [pinned]);

  function scheduleHide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pinned || hoverRef.current) return;
    timerRef.current = setTimeout(() => {
      if (!hoverRef.current && !pinned) setOpen(false);
    }, AUTOHIDE_MS);
  }

  function onMouseEnter() {
    hoverRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  }
  function onMouseLeave() {
    hoverRef.current = false;
    scheduleHide();
  }

  return (
    <>
      {/* Always-visible thin tab on left edge — click to peek */}
      {!open && (
        <button
          onClick={() => { setOpen(true); scheduleHide(); }}
          aria-label="Åpne aktivitetslogg"
          className="fixed top-24 left-0 z-30 flex items-center gap-1 rounded-r-md bg-nx-panel/85 border border-l-0 border-nx-line/70 px-1.5 py-2 text-nx-cyan hover:bg-nx-cyan/15 transition-colors"
        >
          <Activity size={13} aria-hidden="true" />
          {entries.length > 0 && (
            <span className="font-mono text-[10px]">{entries.length}</span>
          )}
          <ChevronRight size={11} aria-hidden="true" />
        </button>
      )}

      {/* Sliding panel */}
      <aside
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        aria-label="Aktivitetslogg"
        aria-hidden={!open}
        className={[
          'fixed top-20 left-0 bottom-6 z-40 w-[300px] max-w-[80vw] panel transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        ].join(' ')}
      >
        <header className="flex items-center gap-2 px-3 py-2 border-b border-nx-line/60">
          <Activity size={14} className="text-nx-cyan" aria-hidden="true" />
          <h3 className="panel-title flex-1">Aktivitet</h3>
          <button
            onClick={onTogglePin}
            aria-pressed={pinned}
            aria-label={pinned ? 'Lås opp' : 'Lås åpen'}
            className={['p-1 rounded-md transition-colors', pinned ? 'text-nx-cyan' : 'text-nx-mute hover:text-nx-text'].join(' ')}
          >
            {pinned ? <Pin size={12} fill="currentColor" /> : <PinOff size={12} />}
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="Lukk"
            className="p-1 rounded-md text-nx-mute hover:text-nx-text"
          >
            <X size={12} />
          </button>
        </header>

        <ul className="overflow-y-auto h-[calc(100%-40px)] p-2 space-y-1.5">
          {entries.length === 0 && (
            <li className="text-xs text-nx-mute p-3">
              Ingen hendelser enda. Loggen viser sanntids endringer fra Homey og dine handlinger her i dashbordet.
            </li>
          )}
          {entries.map(e => (
            <LogEntry key={e.id} entry={e} />
          ))}
        </ul>
      </aside>
    </>
  );
}

function LogEntry({ entry }) {
  const Icon = pickIcon(entry);
  const tone = pickTone(entry);
  return (
    <li className={[
      'flex items-start gap-2 rounded-lg border bg-nx-panel/40 px-2 py-1.5',
      tone === 'red' ? 'border-nx-red/45' : tone === 'green' ? 'border-nx-green/35' : 'border-nx-line/45'
    ].join(' ')}>
      <span className={[
        'grid h-6 w-6 place-items-center rounded-md shrink-0',
        tone === 'red' ? 'bg-nx-red/15 text-nx-red' :
        tone === 'green' ? 'bg-nx-green/15 text-nx-green' :
        'bg-nx-cyan/10 text-nx-cyan'
      ].join(' ')}>
        <Icon size={12} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] leading-tight">{entry.text}</div>
        <div className="mt-0.5 text-[9px] text-nx-mute font-mono">
          {timeAgo(entry.ts)} · {entry.source || entry.type}
        </div>
      </div>
    </li>
  );
}

function pickIcon(e) {
  if (e.type === 'alarm') return ShieldAlert;
  if (e.type === 'security') return Lock;
  if (e.type === 'flow') return Workflow;
  if (e.type === 'on') return Lightbulb;
  if (e.type === 'off') return Power;
  return Activity;
}

function pickTone(e) {
  if (e.type === 'alarm') return 'red';
  if (e.type === 'on' || e.type === 'security') return 'green';
  return 'cyan';
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 5) return 'nå';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} t`;
  return `${Math.round(h / 24)} d`;
}
