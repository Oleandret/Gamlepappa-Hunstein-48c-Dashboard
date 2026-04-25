import { Cloud, CloudRain, CloudSnow, Moon, Sun, CloudSun } from 'lucide-react';

function pickIcon(symbol = '') {
  const s = symbol.toLowerCase();
  if (s.includes('clearsky') && s.includes('night')) return Moon;
  if (s.includes('clearsky')) return Sun;
  if (s.includes('partlycloudy')) return CloudSun;
  if (s.includes('snow')) return CloudSnow;
  if (s.includes('rain') || s.includes('sleet') || s.includes('shower')) return CloudRain;
  return Cloud;
}

export function WeatherWidget({ weather }) {
  if (!weather) return (
    <div>
      <p className="panel-title">Vær</p>
      <p className="mt-2 text-sm text-nx-mute">Henter værdata...</p>
    </div>
  );
  const Icon = pickIcon(weather.now?.symbol);

  return (
    <div>
      <p className="panel-title">Vær</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-nx-panel/60 border border-nx-line/70">
          <Icon size={26} className="text-nx-cyan" />
          <div className="absolute inset-0 rounded-2xl shadow-glow-soft pointer-events-none"/>
        </div>
        <div>
          <div className="font-mono text-3xl">{Math.round(weather.now?.temp ?? 0)}°</div>
          <div className="text-xs text-nx-mute">
            {weather.place} · Luftfuktighet {Math.round(weather.now?.humidity ?? 0)}%
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-1.5">
        {(weather.forecast || []).slice(0, 5).map((d, i) => {
          const I = pickIcon(d.symbol);
          return (
            <div key={i} className="rounded-lg border border-nx-line/60 bg-nx-panel/50 p-2 text-center">
              <div className="text-[10px] uppercase tracking-[0.18em] text-nx-mute">{d.day}</div>
              <I size={16} className="mx-auto my-1 text-nx-cyan" />
              <div className="text-xs font-mono">{d.tempMax}°<span className="text-nx-mute">/{d.tempMin}°</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
