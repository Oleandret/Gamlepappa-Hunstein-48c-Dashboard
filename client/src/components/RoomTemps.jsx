export function RoomTemps({ devices, zones }) {
  const items = Object.values(devices)
    .filter(d => {
      const t = d.capabilities?.measure_temperature ?? d.capabilitiesObj?.measure_temperature?.value;
      return typeof t === 'number';
    })
    .map(d => {
      const t = d.capabilities?.measure_temperature ?? d.capabilitiesObj?.measure_temperature?.value;
      const target = d.capabilities?.target_temperature ?? d.capabilitiesObj?.target_temperature?.value;
      const zone = zones?.[d.zone];
      return {
        id: d.id,
        name: zone?.name || d.name,
        temp: t,
        target,
        // Position for the gradient bar
        pct: Math.max(0, Math.min(100, ((t - 15) / 15) * 100))
      };
    })
    .slice(0, 5);

  return (
    <div>
      <p className="panel-title">Romtemperatur</p>
      <ul className="mt-3 space-y-2.5">
        {items.map(it => (
          <li key={it.id} className="flex items-center gap-3">
            <span className="w-20 text-xs text-nx-mute truncate">{it.name}</span>
            <div className="relative flex-1 h-1.5 rounded-full bg-nx-panel/60 overflow-hidden border border-nx-line/40">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${it.pct}%`,
                  background: 'linear-gradient(90deg,#3ddc84,#22e6ff,#7d5cff)'
                }}
              />
              <div
                className="absolute -top-1 h-3.5 w-1 rounded-sm bg-nx-text shadow-[0_0_8px_rgba(34,230,255,0.7)]"
                style={{ left: `calc(${it.pct}% - 2px)` }}
              />
            </div>
            <span className="w-12 text-right text-xs font-mono text-nx-text">
              {it.temp.toFixed(1)}°
            </span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-nx-mute">Ingen temperaturmålinger tilgjengelig.</li>
        )}
      </ul>
    </div>
  );
}
