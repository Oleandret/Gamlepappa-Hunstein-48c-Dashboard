import { useMemo, useState } from 'react';
import { Lock, Unlock, DoorOpen, Activity, ShieldAlert, Power, Hand, RefreshCw, Camera, Flame, Droplets, Filter } from 'lucide-react';
import { useActivityLog } from '../lib/activityLog.js';

/**
 * Aktivitetslogg på Sikkerhets-fanen. Viser:
 *  - Bevegelses-events (alarm_motion)
 *  - Dør/vindu-events (alarm_contact)
 *  - Lås-events (locked / unlocked)
 *  - Røyk/vann-alarmer
 *  - Manuelle bryter-trykk (av/på) markert med "manuell" eller "sync" som source
 *
 * Filtre over listen lar brukeren snevre inn til én kategori.
 */

const FILTERS = [
  { id: 'all',      label: 'Alt',         match: () => true },
  { id: 'motion',   label: 'Bevegelse',   match: (e) => /bevegelse|motion/i.test(e.text) || e.type === 'motion' },
  { id: 'doors',    label: 'Dører/lås',   match: (e) => /låst|låst opp|dør|kontakt|contact/i.test(e.text) || e.type === 'security' },
  { id: 'alarms',   label: 'Alarmer',     match: (e) => e.type === 'alarm' },
  { id: 'manual',   label: 'Manuelt',     match: (e) => e.source === 'manuell' },
  { id: 'sync',     label: 'Auto/Homey',  match: (e) => e.source === 'sync' }
];

function iconFor(entry) {
  if (entry.type === 'alarm' && /røyk|smoke/i.test(entry.text)) return Flame;
  if (entry.type === 'alarm' && /lekkasje|water/i.test(entry.text)) return Droplets;
  if (entry.type === 'alarm' && /bevegelse|motion/i.test(entry.text)) return Activity;
  if (entry.type === 'alarm') return ShieldAlert;
  if (/låst opp|unlock/i.test(entry.text)) return Unlock;
  if (/låst/i.test(entry.text)) return Lock;
  if (/dør|kontakt|contact/i.test(entry.text)) return DoorOpen;
  if (entry.type === 'on') return Power;
  if (entry.type === 'off') return Power;
  if (entry.type === 'flow') return RefreshCw;
  if (entry.source === 'manuell') return Hand;
  return Activity;
}

function colorFor(entry) {
  if (entry.type === 'alarm') return 'text-nx-red';
  if (entry.type === 'security' || /låst/i.test(entry.text)) return 'text-nx-amber';
  if (entry.type === 'on') return 'text-nx-green';
  if (entry.type === 'off') return 'text-nx-mute';
  return 'text-nx-cyan';
}

export function SecurityActivityLog() {
  const log = useActivityLog();
  const [filter, setFilter] = useState('all');

  const active = FILTERS.find(f => f.id === filter) || FILTERS[0];
  const filtered = useMemo(
    () => log.filter(active.match),
    [log, active]
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="panel-title flex items-center gap-2">
            <ShieldAlert size={14} className="text-nx-cyan" aria-hidden="true" />
            Aktivitetslogg
          </p>
          <p className="text-[10px] text-nx-mute font-mono mt-0.5">
            Siste {log.length} hendelser · oppdaterer automatisk
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Filter size={12} className="text-nx-mute mr-1" aria-hidden="true" />
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={[
                'px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-[0.16em] border transition-colors',
                filter === f.id
                  ? 'border-nx-cyan/55 bg-nx-cyan/15 text-nx-cyan'
                  : 'border-nx-line/60 text-nx-mute hover:text-nx-text hover:border-nx-cyan/40'
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-nx-mute italic py-6 text-center">
          Ingen hendelser i denne kategorien ennå.
        </p>
      ) : (
        <ul className="divide-y divide-nx-line/30 border border-nx-line/40 rounded-lg overflow-hidden max-h-[480px] overflow-y-auto">
          {filtered.map(e => <LogRow key={e.id} entry={e} />)}
        </ul>
      )}
    </div>
  );
}

function LogRow({ entry }) {
  const Icon = iconFor(entry);
  const color = colorFor(entry);
  return (
    <li className="flex items-center gap-2 px-2 py-1.5 hover:bg-nx-panel/40">
      <Icon size={12} className={`shrink-0 ${color}`} aria-hidden="true" />
      <span className="text-xs text-nx-text flex-1 truncate" title={entry.text}>
        {entry.text}
      </span>
      <span className={`font-mono text-[9px] uppercase tracking-[0.18em] shrink-0 ${color}`}>
        {entry.source || entry.type}
      </span>
      <span className="font-mono text-[10px] text-nx-mute tabular-nums shrink-0 w-14 text-right">
        {formatTime(entry.ts)}
      </span>
    </li>
  );
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = Date.now();
  const diffMin = Math.floor((now - ts) / 60000);
  if (diffMin < 1) return 'nå';
  if (diffMin < 60) return `${diffMin}m`;
  return d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
}
