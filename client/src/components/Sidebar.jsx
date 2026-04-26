import { SECTIONS } from '../lib/sections.js';

export function Sidebar({ section, onSection, deviceCount = 0, flowCount = 0 }) {
  return (
    <aside className="w-20 lg:w-56 shrink-0 border-r border-nx-line/60 bg-nx-bg/70 backdrop-blur-md py-6">
      <div className="px-4 lg:px-5 flex items-center gap-2.5">
        <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-nx-cyan to-nx-purple grid place-items-center shadow-glow-cyan">
          <span className="font-display text-nx-bg font-bold text-lg">N</span>
        </div>
        <div className="hidden lg:block leading-tight">
          <div className="font-display font-semibold tracking-wide">NEXORA</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-nx-mute">Smart Home</div>
        </div>
      </div>

      <nav className="mt-8 px-2 lg:px-3 space-y-1" aria-label="Hoved-navigasjon">
        {SECTIONS.map(({ id, label, Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              onClick={() => onSection(id)}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
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
              <Icon size={18} aria-hidden="true" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-10 mx-3 hidden lg:block panel p-3" aria-label="System-status">
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
