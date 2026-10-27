import { useMemo } from 'react';
import { indoorTemperatureGroups } from '../lib/roomTemps.js';

/**
 * Romtemperaturer — gjennomsnitt av innendørs temperaturfølere per sone.
 * Utvalget (uten ute-, garasje-, kjøl- og frysfølere) ligger i lib/roomTemps.js.
 */
export function RoomTemps({ devices, zones }) {
  const groups = useMemo(() => indoorTemperatureGroups(devices, zones), [devices, zones]);

  // Dynamisk skala basert på data, med litt margin
  const temps = groups.map(g => g.temp);
  const min = temps.length ? Math.floor(Math.min(...temps)) - 1 : 16;
  const max = temps.length ? Math.ceil(Math.max(...temps)) + 1 : 26;
  const range = max - min || 1;

  return (
    <div>
      <p className="panel-title">Romtemperatur</p>
      <ul className="mt-3 space-y-2">
        {groups.map(it => {
          const pct = Math.max(0, Math.min(100, ((it.temp - min) / range) * 100));
          return (
            <li key={it.id} className="flex items-center gap-2">
              <span className="w-24 text-xs text-nx-mute truncate" title={`${it.sensorCount} sensor${it.sensorCount === 1 ? '' : 'er'}`}>
                {it.name}
              </span>
              <div
                className="relative flex-1 h-1.5 rounded-full bg-nx-panel/60 overflow-hidden border border-nx-line/40"
                role="progressbar"
                aria-valuenow={Math.round(it.temp)}
                aria-valuemin={Math.round(min)}
                aria-valuemax={Math.round(max)}
                aria-label={`${it.name} temperatur`}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg,#3ddc84,#22e6ff,#7d5cff)'
                  }}
                />
                <div
                  className="absolute -top-1 h-3.5 w-1 rounded-sm bg-nx-text shadow-[0_0_8px_rgba(34,230,255,0.7)]"
                  style={{ left: `calc(${pct}% - 2px)` }}
                  aria-hidden="true"
                />
              </div>
              <span className="w-14 text-right text-xs font-mono text-nx-text tabular-nums">
                {it.temp.toFixed(1)}°
                {it.target != null && (
                  <span className="text-nx-mute text-[9px] ml-0.5">→{it.target.toFixed(0)}</span>
                )}
              </span>
            </li>
          );
        })}
        {groups.length === 0 && (
          <li className="text-sm text-nx-mute">Ingen temperaturmålinger tilgjengelig.</li>
        )}
      </ul>
    </div>
  );
}
