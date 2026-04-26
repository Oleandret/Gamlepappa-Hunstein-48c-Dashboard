import { lazy, Suspense, useMemo } from 'react';
import { Zap, TrendingDown, TrendingUp } from 'lucide-react';
import { capValue } from '../../lib/deviceUtils.js';

const EnergyWidget = lazy(() =>
  import('../EnergyWidget.jsx').then(m => ({ default: m.EnergyWidget }))
);

export function EnergyView({ devices, zones, energy }) {
  const energyDevices = useMemo(() => {
    return Object.values(devices)
      .map(d => {
        const watts = capValue(d, 'measure_power');
        const kwh = capValue(d, 'meter_power');
        if (!Number.isFinite(watts) && !Number.isFinite(kwh)) return null;
        return {
          id: d.id,
          name: d.name,
          zone: zones?.[d.zone]?.name || '—',
          watts: Number.isFinite(watts) ? watts : null,
          kwh:   Number.isFinite(kwh) ? kwh : null,
          on: capValue(d, 'onoff')
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.watts || 0) - (a.watts || 0));
  }, [devices, zones]);

  const totalLive = energyDevices.reduce((s, d) => s + (d.watts || 0), 0);
  const byZone = useMemo(() => {
    const m = new Map();
    for (const d of energyDevices) {
      m.set(d.zone, (m.get(d.zone) || 0) + (d.watts || 0));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [energyDevices]);

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel p-4 lg:col-span-2">
          <Suspense fallback={<div className="h-40 grid place-items-center text-nx-mute font-mono text-xs">LASTER GRAF...</div>}>
            <EnergyWidget energy={energy} />
          </Suspense>
        </div>
        <div className="panel p-4">
          <p className="panel-title">Sanntid</p>
          <div className="mt-2 flex items-baseline gap-2">
            <Zap size={20} className="text-nx-cyan" aria-hidden="true" />
            <span className="font-mono text-3xl">{Math.round(totalLive).toLocaleString('no-NO')}</span>
            <span className="text-nx-mute text-sm">W totalt</span>
          </div>
          <p className="mt-1 text-xs text-nx-mute">
            Summen er fra {energyDevices.length} enheter med strøm-måling.
          </p>
          {energy?.today && (
            <div className="mt-4">
              <p className="panel-title">I dag</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl">{energy.today.kwh}</span>
                <span className="text-xs text-nx-mute">kWh</span>
                <Trend value={energy.today.trend} />
              </div>
            </div>
          )}
        </div>
      </header>

      <section>
        <h3 className="panel-title">Per rom (sanntid)</h3>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {byZone.map(([zone, watts]) => (
            <div key={zone} className="panel p-3 flex items-center justify-between">
              <span className="text-sm truncate">{zone}</span>
              <span className="font-mono text-sm text-nx-cyan">{Math.round(watts).toLocaleString('no-NO')} W</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="panel-title">Per enhet ({energyDevices.length})</h3>
        <div className="mt-2 panel p-2">
          <ul className="divide-y divide-nx-line/40 max-h-[480px] overflow-y-auto">
            {energyDevices.map(d => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                <span className={[
                  'h-1.5 w-1.5 rounded-full shrink-0',
                  d.on ? 'bg-nx-cyan animate-pulseGlow' : 'bg-nx-mute/40'
                ].join(' ')} aria-hidden="true" />
                <span className="text-sm flex-1 truncate" title={d.name}>{d.name}</span>
                <span className="text-[11px] text-nx-mute font-mono">{d.zone}</span>
                <span className="font-mono text-sm w-20 text-right text-nx-cyan">
                  {Number.isFinite(d.watts) ? `${Math.round(d.watts).toLocaleString('no-NO')} W` : '—'}
                </span>
                <span className="font-mono text-xs w-20 text-right text-nx-mute">
                  {Number.isFinite(d.kwh) ? `${d.kwh.toFixed(1)} kWh` : ''}
                </span>
              </li>
            ))}
            {energyDevices.length === 0 && (
              <li className="text-sm text-nx-mute p-4 text-center">Ingen enheter med energi-måling.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Trend({ value = 0 }) {
  const down = value <= 0;
  const Icon = down ? TrendingDown : TrendingUp;
  return (
    <span className={['flex items-center gap-1 text-xs font-mono', down ? 'text-nx-green' : 'text-nx-amber'].join(' ')}>
      <Icon size={12} aria-hidden="true" /> {Math.abs(value)}%
    </span>
  );
}
