import { Bell, Search, Wifi } from 'lucide-react';
import { useNow, formatTime, formatDateLong } from '../lib/useNow.js';
import { SECTIONS } from '../lib/sections.js';
import { AIConnection } from './AIConnection.jsx';

export function TopBar({ section, onSection, system }) {
  const now = useNow(1000);
  const isLive = system?.demo === false;

  return (
    <div className="dashboard-topbar flex items-center justify-between gap-4 flex-wrap">
      <label className="mobile-section-picker">Åpne fane<select value={section} onChange={e=>onSection(e.target.value)} aria-label="Velg fane">{SECTIONS.map(({id,label})=><option key={id} value={id}>{label}</option>)}</select></label>
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
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-nx-mute">
          <Wifi size={14} className={isLive ? 'text-nx-green' : 'text-nx-amber'} aria-hidden="true" />
          <span className="capitalize">{formatDateLong(now)}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="font-mono text-xl tracking-wider text-nx-text leading-none" aria-label="Klokke">
            {formatTime(now)}
          </div>
          <AIConnection />
        </div>
      </div>
    </div>
  );
}
