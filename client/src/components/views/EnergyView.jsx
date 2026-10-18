import {powerWatts,energyKwh,sourceAt} from '../../lib/measurements.js';
import {PriceHistory} from '../PriceHistory.jsx';
import {HunsteinEnergy} from '../HunsteinEnergy.jsx';
import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { capValue } from '../../lib/deviceUtils.js';

export function EnergyView({ devices, zones, energy, quality }) {
  const energyDevices = useMemo(() => {
    return Object.values(devices)
      .map(d => {
        const watts = powerWatts(d.capabilitiesObj?.measure_power || {value:capValue(d,'measure_power')});
        const kwh = energyKwh(d.capabilitiesObj?.meter_power || {value:capValue(d,'meter_power')});
        if (!Number.isFinite(watts) && !Number.isFinite(kwh)) return null;
        return {
          id: d.id,
          name: d.name,
          at:sourceAt(d.capabilitiesObj?.measure_power?.lastUpdated),available:d.available,
          zone: zones?.[d.zone]?.name || '—',
          watts: Number.isFinite(watts) ? watts : null,
          kwh:   Number.isFinite(kwh) ? kwh : null,
          on: capValue(d, 'onoff')
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.watts || 0) - (a.watts || 0));
  }, [devices, zones]);

  const byZone = useMemo(() => {
    const m = new Map();
    for (const d of energyDevices) {
      m.set(d.zone, (m.get(d.zone) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [energyDevices]);

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel p-4 lg:col-span-2">
          <HunsteinEnergy devices={devices} quality={quality} />
        </div>
        <div className="panel p-4">
          <p className="panel-title">Enhetsoversikt</p>
          <div className="mt-2 flex items-baseline gap-2">
            <Zap size={20} className="text-nx-cyan" aria-hidden="true" />
            <span className="font-mono text-3xl">{energyDevices.length}</span>
            <span className="text-nx-mute text-sm">målere</span>
          </div>
          <p className="mt-1 text-xs text-nx-mute">
            Ingen totalsum: listen kan inneholde hovedmålere, undermålere og ulike anlegg. Bruk Strømsparing for brukerbekreftet anlegg og måleroppsett.
          </p>

        </div>
      </header>
      <PriceHistory/>

      <section>
        <h3 className="panel-title">Målere per rom</h3>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {byZone.map(([zone, count]) => (
            <div key={zone} className="panel p-3 flex items-center justify-between">
              <span className="text-sm truncate">{zone}</span>
              <span className="font-mono text-sm text-nx-cyan">{count} målere</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="panel-title">Sist rapportert per enhet ({energyDevices.length})</h3>
        <div className="mt-2 panel p-2">
          <ul className="divide-y divide-nx-line/40 max-h-[480px] overflow-y-auto">
            {energyDevices.map(d => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                <span className={[
                  'h-1.5 w-1.5 rounded-full shrink-0',
                  d.on ? 'bg-nx-cyan animate-pulseGlow' : 'bg-nx-mute/40'
                ].join(' ')} aria-hidden="true" />
                <span className="text-sm flex-1 truncate" title={d.name}>{d.name}</span>
                <span className="text-[11px] text-nx-mute font-mono">{d.zone}<small className="block">{d.available===false?'Utilgjengelig':d.at?new Date(d.at).toLocaleString('nb-NO',{timeZone:'Europe/Oslo'}):'Kildetid mangler'}</small></span>
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
