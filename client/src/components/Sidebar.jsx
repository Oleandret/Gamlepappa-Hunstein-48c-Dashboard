import { useState } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { SECTIONS } from '../lib/sections.js';

/**
 * Auto-collapsing sidebar — icon-only by default, expands on hover.
 * Click the pin icon to keep it open permanently (saved in localStorage).
 */
export function Sidebar({ section, onSection, deviceCount = 0, flowCount = 0, pinned, onTogglePin }) {
  const [hovered, setHovered] = useState(false);
  const expanded = pinned || hovered;

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: expanded ? 224 : 64 }}
      className="shrink-0 border-r border-nx-line/60 bg-nx-bg/80 backdrop-blur-md py-6 transition-[width] duration-200 ease-out overflow-hidden relative z-30"
      aria-label="Hoved-navigasjon"
    >
      {/* Logo + pin */}
      <div className="px-3 flex items-center gap-2.5 h-10">
        <div className="relative h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-nx-cyan to-nx-purple grid place-items-center shadow-glow-cyan">
          <span className="font-display text-nx-bg font-bold text-lg">G</span>
        </div>
        <div className={['leading-tight transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'].join(' ')}>
          <div className="font-display font-semibold tracking-wide text-sm">GAMLEPAPPA</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-nx-mute">Smarthus</div>
        </div>
        <button
          onClick={onTogglePin}
          aria-label={pinned ? 'Lås opp sidebar (auto-skjul)' : 'Lås sidebar åpen'}
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

      <nav className="mt-8 px-2 space-y-1">
        {SECTIONS.map(({ id, label, Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              onClick={() => onSection(id)}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              title={!expanded ? label : undefined}
              className={[
                'group relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-nx-cyan/10 text-nx-cyan shadow-glow-soft'
                  : 'text-nx-mute hover:text-nx-text hover:bg-nx-panel/60'
              ].join(' ')}
            >
              {active && (
                <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-nx-cyan shadow-glow-cyan" />
              )}
              <Icon size={18} aria-hidden="true" className="shrink-0" />
              <span className={['truncate transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0'].join(' ')}>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className={[
        'mt-10 mx-3 panel p-3 transition-opacity duration-150',
        expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
      ].join(' ')} aria-label="System-status">
        <p className="panel-title">Status</p>
        <div className="mt-2 space-y-2 text-xs">
          <Stat label="Enheter" value={deviceCount || '—'} />
          <Stat label="Flows" value={flowCount || '—'} />
          <Stat label="Online" value={deviceCount ? 'OK' : '—'} tone="green" />
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-nx-mute">{label}</span>
      <span className={tone === 'green' ? 'text-nx-green font-mono' : 'text-nx-text font-mono'}>
        {value}
      </span>
    </div>
  );
}
