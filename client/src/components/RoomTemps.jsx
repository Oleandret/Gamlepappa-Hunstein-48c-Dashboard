/**
 * Show measured indoor temperatures per room.
 * Bar position is computed dynamically from the actual min/max range so a
 * 12°C garage and a 22°C bathroom both render proportionally.
 */
export function RoomTemps({ devices, zones }) {
  const items = Object.values(devices)
    .map(d => {
      const t = d.capabilities?.measure_temperature ?? d.capabilitiesObj?.measure_temperature?.value;
      if (typeof t !== 'number' || !Number.isFinite(t)) return null;
      const target = d.capabilities?.target_temperature ?? d.capabilitiesObj?.target_temperature?.value;
      const zone = zones?.[d.zone];
      return { id: d.id, name: zone?.name || d.name, temp: t, target };
    })
    .filter(Boolean)
    .slice(0, 5);

  // Dynamic range so the bar covers the actual data span (with a small margin)
  const temps = items.map(i => i.temp);
  const min = temps.length ? Math.min(...temps) - 1 : 14;
  const max = temps.length ? Math.max(...temps) + 1 : 30;
  const range = max - min || 1;

  return (
    <div>
      <p className="panel-title">Romtemperatur</p>
      <ul className="mt-3 space-y-2.5">
        {items.map(it => {
          const pct = Math.max(0, Math.min(100, ((it.temp - min) / range) * 100));
          return (
            <li key={it.id} className="flex items-center gap-3">
              <span className="w-20 text-xs text-nx-mute truncate">{it.name}</span>
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
              <span className="w-12 text-right text-xs font-mono text-nx-text">
                {it.temp.toFixed(1)}°
              </span>
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="text-sm text-nx-mute">Ingen temperaturmålinger tilgjengelig.</li>
        )}
      </ul>
    </div>
  );
}
