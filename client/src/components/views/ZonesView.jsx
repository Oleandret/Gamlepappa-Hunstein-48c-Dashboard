import { useMemo, useState } from 'react';
import { ChevronLeft, Home as HomeIcon } from 'lucide-react';
import { DeviceCard } from '../DeviceCard.jsx';
import { groupByZone, classLabel } from '../../lib/deviceUtils.js';

export function ZonesView({ devices, zones, onSet, favorites }) {
  const [openZone, setOpenZone] = useState(null);
  const groups = useMemo(
    () => groupByZone(Object.values(devices), zones).filter(g => g.devices.length > 0),
    [devices, zones]
  );

  if (openZone) {
    const group = groups.find(g => g.zone.id === openZone);
    if (!group) { setOpenZone(null); return null; }
    return (
      <ZoneDetail
        group={group}
        onBack={() => setOpenZone(null)}
        onSet={onSet}
        favorites={favorites}
      />
    );
  }

  return (
    <div>
      <h2 className="panel-title">Rom · {groups.length} aktive</h2>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {groups.map(g => {
          const classes = countClasses(g.devices);
          const onCount = g.devices.filter(d => d.capabilities?.onoff).length;
          return (
            <button
              key={g.zone.id}
              onClick={() => setOpenZone(g.zone.id)}
              className="panel p-4 text-left hover:border-nx-cyan/50 transition-colors group"
              aria-label={`Åpne ${g.zone.name} (${g.devices.length} enheter)`}
            >
              <div className="flex items-center justify-between">
                <HomeIcon size={16} className="text-nx-cyan group-hover:scale-110 transition-transform" aria-hidden="true" />
                <span className="font-mono text-xl text-nx-text">{g.devices.length}</span>
              </div>
              <div className="mt-3 text-base font-semibold leading-tight">{g.zone.name}</div>
              <div className="mt-1 text-[11px] text-nx-mute font-mono uppercase tracking-[0.14em] truncate">
                {classes.slice(0, 3).map(c => `${c.count} ${classLabel(c.cls).toLowerCase()}`).join(' · ') || '—'}
              </div>
              {onCount > 0 && (
                <div className="mt-2 text-[10px] text-nx-cyan font-mono">
                  {onCount} aktiv{onCount !== 1 ? 'e' : ''}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ZoneDetail({ group, onBack, onSet, favorites }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="btn text-xs"
        aria-label="Tilbake til alle rom"
      >
        <ChevronLeft size={14} aria-hidden="true" /> ALLE ROM
      </button>
      <h2 className="mt-3 text-xl font-semibold">{group.zone.name}</h2>
      <p className="text-xs text-nx-mute font-mono mt-1">
        {group.devices.length} enheter
      </p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {group.devices.map(d => (
          <DeviceCard
            key={d.id}
            device={d}
            zoneName={group.zone.name}
            onSet={onSet}
            isFavorite={favorites?.isFavorite(d.id)}
            onToggleFavorite={favorites?.toggle}
          />
        ))}
      </div>
    </div>
  );
}

function countClasses(devices) {
  const m = {};
  for (const d of devices) m[d.class] = (m[d.class] || 0) + 1;
  return Object.entries(m).map(([cls, count]) => ({ cls, count })).sort((a, b) => b.count - a.count);
}
