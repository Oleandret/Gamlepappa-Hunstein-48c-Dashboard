import { useMemo } from 'react';

/**
 * Romtemperaturer — gruppert per sone og gjennomsnitt av alle innendørs
 * temperatursensorer i rommet. Filtrerer bort kjøleskap/fryser, ute-sensorer
 * og termostater på vannvarmere så ikke ekstreme verdier skjevvrir bildet.
 */

const EXCLUDE_NAME_RE = /(kj.l|frys|fridge|freezer|ovn|oven|varmtvann|water heater|sauna|ute(?![ns])|outdoor|outside|grill|peis)/i;
const EXCLUDE_CLASS = new Set(['fridge', 'freezer']);

export function RoomTemps({ devices, zones }) {
  const groups = useMemo(() => {
    const all = Object.values(devices || {});
    const byZone = new Map();

    for (const d of all) {
      const t = d.capabilities?.measure_temperature ?? d.capabilitiesObj?.measure_temperature?.value;
      if (typeof t !== 'number' || !Number.isFinite(t)) continue;

      // Filtrer bort kjøl/frys/utendørs ut fra navn og klasse
      if (EXCLUDE_CLASS.has(d.class)) continue;
      if (EXCLUDE_NAME_RE.test(d.name || '')) continue;

      // Filtrer bort sensorer i ute/uteareal-soner
      const zone = zones?.[d.zone];
      const zoneName = zone?.name || '';
      if (/^ute$|utvendig|hage(?! .*innendørs)|garasje\b/i.test(zoneName) && zoneName !== 'Hage' /* hagen ok */) {
        // garasje OK å vise — kommenter ut hvis du vil utelukke
      }

      if (!zone) continue;
      if (!byZone.has(zone.id)) byZone.set(zone.id, { id: zone.id, name: zone.name || 'Rom', temps: [], targets: [] });
      const g = byZone.get(zone.id);
      g.temps.push(t);
      const target = d.capabilities?.target_temperature ?? d.capabilitiesObj?.target_temperature?.value;
      if (Number.isFinite(target)) g.targets.push(target);
    }

    const list = [...byZone.values()].map(g => ({
      id: g.id,
      name: g.name,
      temp: g.temps.reduce((a, b) => a + b, 0) / g.temps.length,
      target: g.targets.length ? g.targets.reduce((a, b) => a + b, 0) / g.targets.length : null,
      sensorCount: g.temps.length
    }));

    // Sorter alfabetisk og kapp til topp 6 så widgeten ikke blir for høy
    return list.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 6);
  }, [devices, zones]);

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
