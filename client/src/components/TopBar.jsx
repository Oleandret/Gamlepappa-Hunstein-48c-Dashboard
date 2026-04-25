import { Bell, Search, Wifi } from 'lucide-react';
import { useNow, formatTime, formatDateLong } from '../lib/useNow.js';

const TABS = ['oversikt', 'rom', 'automasjon', 'energi', 'sikkerhet', 'innstillinger'];

export function TopBar({ system }) {
  const now = useNow(1000);

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <nav className="flex flex-wrap gap-1 text-[12px] uppercase tracking-[0.18em] font-mono">
        {TABS.map((t, i) => (
          <button
            key={t}
            className={[
              'px-3 py-1.5 rounded-md transition-colors',
              i === 0
                ? 'text-nx-cyan bg-nx-cyan/10 shadow-glow-soft'
                : 'text-nx-mute hover:text-nx-text'
            ].join(' ')}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-3 ml-auto">
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-mute" />
          <input
            placeholder="Søk enheter, rom, flows..."
            className="bg-nx-panel/60 border border-nx-line/70 rounded-xl pl-9 pr-3 py-2 text-sm text-nx-text placeholder:text-nx-mute focus:outline-none focus:border-nx-cyan/60 w-64"
          />
        </div>
        <button className="btn">
          <Bell size={14} /> 3
        </button>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-nx-mute">
          <Wifi size={14} className="text-nx-green" />
          <span className="capitalize">{formatDateLong(now)}</span>
        </div>
        <div className="font-mono text-xl tracking-wider text-nx-text">
          {formatTime(now)}
        </div>
      </div>
    </div>
  );
}
