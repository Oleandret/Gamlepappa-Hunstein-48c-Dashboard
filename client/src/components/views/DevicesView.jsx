import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DeviceCard } from '../DeviceCard.jsx';
import { groupByClass, classLabel } from '../../lib/deviceUtils.js';

export function DevicesView({ devices, zones, onSet, favorites }) {
  const [query, setQuery] = useState('');
  const [activeClass, setActiveClass] = useState('all');

  const groups = useMemo(() => groupByClass(Object.values(devices)), [devices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter(g => activeClass === 'all' || g.cls === activeClass)
      .map(g => ({
        ...g,
        devices: q
          ? g.devices.filter(d =>
              d.name.toLowerCase().includes(q) ||
              (zones?.[d.zone]?.name || '').toLowerCase().includes(q))
          : g.devices
      }))
      .filter(g => g.devices.length > 0);
  }, [groups, query, activeClass, zones]);

  const totalShown = filtered.reduce((s, g) => s + g.devices.length, 0);
  const totalAll = Object.keys(devices).length;

  return (
    <div>
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="panel-title">Enheter</h2>
          <p className="mt-1 text-xl font-semibold">
            {totalShown} <span className="text-nx-mute text-sm font-normal">av {totalAll}</span>
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nx-mute" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Søk enhet eller rom..."
            aria-label="Søk enheter"
            className="bg-nx-panel/60 border border-nx-line/70 rounded-xl pl-9 pr-3 py-2 text-sm w-full text-nx-text placeholder:text-nx-mute focus:outline-none focus:border-nx-cyan/60"
          />
        </div>
      </header>

      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter etter type">
        <ClassChip active={activeClass === 'all'} count={totalAll} label="Alle" onClick={() => setActiveClass('all')} />
        {groups.map(g => (
          <ClassChip
            key={g.cls}
            active={activeClass === g.cls}
            count={g.devices.length}
            label={g.label}
            onClick={() => setActiveClass(g.cls)}
          />
        ))}
      </div>

      <div className="mt-5 space-y-6">
        {filtered.map(g => (
          <section key={g.cls}>
            <h3 className="panel-title flex items-center gap-2">
              <span>{g.label}</span>
              <span className="text-nx-cyan font-mono">{g.devices.length}</span>
            </h3>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.devices.map(d => (
                <DeviceCard
                  key={d.id}
                  device={d}
                  zoneName={zones?.[d.zone]?.name}
                  onSet={onSet}
                  isFavorite={favorites?.isFavorite(d.id)}
                  onToggleFavorite={favorites?.toggle}
                />
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-nx-mute py-8 text-center">Ingen enheter matcher.</p>
        )}
      </div>
    </div>
  );
}

function ClassChip({ active, count, label, onClick }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
        active
          ? 'border-nx-cyan/55 bg-nx-cyan/15 text-nx-cyan'
          : 'border-nx-line/60 text-nx-mute hover:text-nx-text'
      ].join(' ')}
    >
      <span>{label}</span>
      <span className={['font-mono', active ? 'text-nx-cyan' : 'text-nx-mute'].join(' ')}>{count}</span>
    </button>
  );
}
