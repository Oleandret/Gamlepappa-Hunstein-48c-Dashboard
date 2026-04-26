import { Bell, Search, Wifi } from 'lucide-react';
import { useNow, formatTime, formatDateLong } from '../lib/useNow.js';
import { SECTIONS } from '../lib/sections.js';

export function TopBar({ section, onSection, system }) {
  const now = useNow(1000);
  const isLive = system?.demo === false;

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <nav
        className="flex flex-wrap gap-1 text-[12px] uppercase tracking-[0.18em] font-mono"
        aria-label="Seksjons-navigasjon"
      >
        {SECTIONS.map(({ id, label }) => {
          const active = section === id;
          return (
            <button
              key={id}
              onClick={() => onSection(id)}
              aria-current={active ? 'page' : undefined}
              className={[
                'px-3 py-1.5 rounded-md transition-colors',
                active
                  ? 'text-nx-cyan bg-nx-cyan/10 shadow-glow-soft'
                  : 'text-nx-mute hover:text-nx-text'
              ].join(' ')}
            >
              {label.toLowerCase()}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 ml-auto">
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-mute" aria-hidden="true" />
          <input
            type="search"
            aria-label="Søk enheter, rom, flows"
            placeholder="Søk enheter, rom, flows..."
            className="bg-nx-panel/60 border border-nx-line/70 rounded-xl pl-9 pr-3 py-2 text-sm text-nx-text placeholder:text-nx-mute focus:outline-none focus:border-nx-cyan/60 w-64"
          />
        </div>
        <button className="btn" aria-label="Varsler (3 ulest)">
          <Bell size={14} aria-hidden="true" /> 3
        </button>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-nx-mute">
          <Wifi size={14} className={isLive ? 'text-nx-green' : 'text-nx-amber'} aria-hidden="true" />
          <span className="capitalize">{formatDateLong(now)}</span>
        </div>
        <div className="font-mono text-xl tracking-wider text-nx-text" aria-label="Klokke">
          {formatTime(now)}
        </div>
      </div>
    </div>
  );
}
