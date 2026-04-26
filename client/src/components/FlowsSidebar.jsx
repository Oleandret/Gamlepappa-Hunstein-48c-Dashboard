import { useMemo, useState } from 'react';
import { Pin, PinOff, Bed, Sofa, Film, Workflow, Play } from 'lucide-react';

/**
 * Auto-collapsing right-side sidebar med flows gruppert per rom.
 * Speilbildet av venstre Sidebar — kollapser til ikon-only og utvider på hover.
 *
 * Roms-kategoriene matcher mot flow-navn (regex), så du må ikke knytte flows
 * til soner i Homey for at det skal fungere — så lenge flow-navnet inneholder
 * romnavnet vil det dukke opp her.
 */
const ROOM_GROUPS = [
  { id: 'soverom', label: 'Soverom', Icon: Bed,  match: /soverom|hovedsoverom|hybel|ylva|andrea|vendela/i },
  { id: 'stue',    label: 'Stue',    Icon: Sofa, match: /(?<!tv-)stue|kjøkken|hovedetasjen/i },
  { id: 'kino',    label: 'Kino',    Icon: Film, match: /kino|tv-stue|tv\b|home\s*cinema/i }
];

export function FlowsSidebar({ flows, onRun, pinned, onTogglePin }) {
  const [hovered, setHovered] = useState(false);
  const expanded = pinned || hovered;

  const flowList = useMemo(() => Object.values(flows || {}), [flows]);

  const grouped = useMemo(() => {
    return ROOM_GROUPS.map(group => ({
      ...group,
      flows: flowList
        .filter(f => f.enabled !== false && group.match.test(f.name || ''))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }));
  }, [flowList]);

  const totalCount = grouped.reduce((sum, g) => sum + g.flows.length, 0);

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: expanded ? 256 : 56 }}
      className="shrink-0 border-l border-nx-line/60 bg-nx-bg/80 backdrop-blur-md py-6 transition-[width] duration-200 ease-out overflow-hidden relative z-30"
      aria-label="Rom-flows"
    >
      {/* Header med pin-knapp */}
      <div className="px-3 flex items-center gap-2 h-10">
        <div className={['transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'].join(' ')}>
          <div className="font-display font-semibold tracking-wide text-sm flex items-center gap-1.5">
            <Workflow size={14} className="text-nx-cyan" />
            ROM-FLOWS
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-nx-mute">{totalCount} totalt</div>
        </div>
        <button
          onClick={onTogglePin}
          aria-label={pinned ? 'Lås opp flows-sidebar' : 'Lås flows-sidebar åpen'}
          aria-pressed={pinned}
          className={[
            'ml-auto p-1 rounded-md transition-all',
            expanded ? 'opacity-100' : 'opacity-0 pointer-events-none',
            pinned ? 'text-nx-cyan' : 'text-nx-mute hover:text-nx-text'
          ].join(' ')}
        >
          {pinned ? <Pin size={13} fill="currentColor" /> : <PinOff size={13} />}
        </button>
      </div>

      {/* Kollapset state: bare ikoner per kategori */}
      {!expanded && (
        <div className="mt-8 px-2 space-y-1.5">
          {grouped.map(g => {
            const Icon = g.Icon;
            const has = g.flows.length > 0;
            return (
              <div
                key={g.id}
                className={[
                  'flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl',
                  has ? 'text-nx-cyan' : 'text-nx-mute opacity-50'
                ].join(' ')}
                title={`${g.label}: ${g.flows.length} flow(s)`}
              >
                <Icon size={18} aria-hidden="true" />
                {has && (
                  <span className="text-[9px] font-mono tabular-nums">{g.flows.length}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Utvidet state: kategorier med flow-knapper */}
      {expanded && (
        <div className="mt-6 px-2 space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto">
          {grouped.map(group => (
            <RoomGroup key={group.id} group={group} onRun={onRun} />
          ))}
          {totalCount === 0 && (
            <p className="px-2 text-xs text-nx-mute italic leading-relaxed">
              Ingen flows funnet med rom-navn i tittelen ennå. Tips: gi flows i Homey navn som inneholder "Soverom", "Stue" eller "Kino".
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

function RoomGroup({ group, onRun }) {
  const Icon = group.Icon;
  return (
    <div>
      <div className="flex items-center gap-2 px-2 mb-1.5">
        <Icon size={14} className="text-nx-cyan shrink-0" aria-hidden="true" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-nx-mute">{group.label}</span>
        <span className="ml-auto font-mono text-[10px] text-nx-mute tabular-nums">{group.flows.length}</span>
      </div>
      {group.flows.length === 0 ? (
        <p className="px-2 text-[10px] text-nx-mute italic">Ingen flows</p>
      ) : (
        <ul className="space-y-1">
          {group.flows.map(f => (
            <li key={f.id}>
              <button
                onClick={() => onRun(f.id)}
                className="group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs text-nx-mute hover:text-nx-cyan hover:bg-nx-cyan/10 transition-colors"
                title={`Kjør "${f.name}"`}
              >
                <Play size={11} className="shrink-0 text-nx-mute group-hover:text-nx-cyan" aria-hidden="true" />
                <span className="truncate flex-1">{f.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
