import { memo } from 'react';
import { motion } from 'framer-motion';
import { Thermometer, Droplets } from 'lucide-react';

/**
 * Room overlay positions (% of image width / height).
 * Tune these in one place to match the actual rooms in /house.jpg.
 */
const ROOM_PINS = [
  { zone: 'Stue',     label: 'STUE',     xPct: 50, yPct: 52, labelDX: -8,  labelDY: -16 },
  { zone: 'Soverom',  label: 'SOVEROM',  xPct: 50, yPct: 28, labelDX: -22, labelDY: -16 },
  { zone: 'Kjøkken',  label: 'KJØKKEN',  xPct: 35, yPct: 48, labelDX: -22, labelDY: -16 },
  { zone: 'Bad',      label: 'BAD',      xPct: 42, yPct: 72, labelDX: 6,   labelDY: 12 },
  { zone: 'Kontor',   label: 'KONTOR',   xPct: 60, yPct: 28, labelDX: 6,   labelDY: -16 },
  { zone: 'Garasje',  label: 'GARASJE',  xPct: 72, yPct: 60, labelDX: 6,   labelDY: -16 }
];

function findTempForZone(zoneName, devices, zones) {
  const zone = Object.values(zones).find(z => (z.name || '').toLowerCase() === zoneName.toLowerCase());
  if (!zone) return null;
  const dev = Object.values(devices).find(d =>
    d.zone === zone.id && (
      d.capabilities?.measure_temperature != null ||
      d.capabilitiesObj?.measure_temperature?.value != null
    )
  );
  if (!dev) return null;
  const t = dev.capabilities?.measure_temperature ?? dev.capabilitiesObj?.measure_temperature?.value;
  return Number.isFinite(t) ? t : null;
}

export function HouseView({ devices, zones, weather }) {
  const outdoorTemp = Number.isFinite(weather?.now?.temp) ? `${Math.round(weather.now.temp)}°C` : '--';
  const humidity = Number.isFinite(weather?.now?.humidity) ? `${Math.round(weather.now.humidity)}%` : '--';

  const indoorTemps = Object.values(devices)
    .map(d => d.capabilities?.measure_temperature ?? d.capabilitiesObj?.measure_temperature?.value)
    .filter(t => Number.isFinite(t));
  const avg = indoorTemps.length
    ? (indoorTemps.reduce((a, b) => a + b, 0) / indoorTemps.length).toFixed(1)
    : '--';

  return (
    <div className="relative h-full p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="panel-title">Hjemmet</p>
          <h2 className="mt-1 text-lg font-semibold">Alt er normalt</h2>
        </div>
        <div className="flex items-center gap-4">
          <Stat icon={<Thermometer size={14} className="text-nx-cyan" aria-hidden="true" />} label="Innetemp" value={`${avg}°C`} />
          <Stat icon={<Droplets size={14} className="text-nx-cyan" aria-hidden="true" />} label="Luftfuktighet" value={humidity} />
          <Stat label="Luftkvalitet" value="God" tone="green" />
        </div>
      </div>

      <div className="relative mt-3 aspect-[16/9] w-full overflow-hidden rounded-xl border border-nx-line/60 bg-nx-bg">
        <img
          src="/house.jpg"
          alt="Hunstein 48c sett fra droneperspektiv"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-nx-bg/65 via-nx-bg/20 to-nx-bg/75" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(circle at 50% 35%, rgba(34,230,255,0.10), transparent 65%)'
        }} />

        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid bg-[size:32px_32px] opacity-25 mix-blend-screen" />

        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -inset-x-10 h-32 bg-gradient-to-b from-transparent via-nx-cyan/12 to-transparent animate-scan" />
        </div>

        <Brackets />

        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-3 left-3 chip text-xs"
        >
          <span className="text-nx-mute">UTE</span>
          <span className="font-mono text-nx-cyan">{outdoorTemp}</span>
        </motion.div>

        <div className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.22em] text-nx-mute">
          ◉ HUNSTEIN 48c
        </div>

        {ROOM_PINS.map(p => (
          <RoomPin
            key={p.zone}
            label={p.label}
            temp={findTempForZone(p.zone, devices, zones)}
            xPct={p.xPct}
            yPct={p.yPct}
            labelDX={p.labelDX ?? 0}
            labelDY={p.labelDY ?? -16}
          />
        ))}
      </div>
    </div>
  );
}

const RoomPin = memo(function RoomPin({ label, temp, xPct, yPct, labelDX, labelDY }) {
  const display = Number.isFinite(temp) ? `${temp.toFixed(1)}°C` : '—';
  return (
    <div
      className="absolute"
      style={{ left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%, -50%)' }}
      role="img"
      aria-label={`${label} temperatur ${display}`}
    >
      <span aria-hidden="true" className="absolute inset-0 -m-1 rounded-full border border-nx-cyan/60 animate-pulseGlow" />
      <span aria-hidden="true" className="relative block h-2.5 w-2.5 rounded-full bg-nx-cyan shadow-[0_0_12px_rgba(34,230,255,0.9)]" />
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${labelDX}%`,
          top: `${labelDY}px`,
          transform: 'translateY(-100%)'
        }}
        aria-hidden="true"
      >
        <div className="rounded-md border border-nx-cyan/45 bg-nx-bg/85 backdrop-blur-sm px-2 py-1 shadow-glow-soft">
          <div className="text-[8px] tracking-[0.18em] text-nx-mute font-mono leading-none">{label}</div>
          <div className="text-[12px] font-mono text-nx-cyan leading-tight">{display}</div>
        </div>
        <div className="absolute left-1/2 top-full h-3 w-px bg-nx-cyan/50" />
      </div>
    </div>
  );
});

function Brackets() {
  const cls = 'absolute h-5 w-5 border-nx-cyan/70';
  return (
    <div aria-hidden="true">
      <div className={`${cls} top-2 left-2 border-t-2 border-l-2`} />
      <div className={`${cls} top-2 right-2 border-t-2 border-r-2`} />
      <div className={`${cls} bottom-2 left-2 border-b-2 border-l-2`} />
      <div className={`${cls} bottom-2 right-2 border-b-2 border-r-2`} />
    </div>
  );
}

function Stat({ icon, label, value, tone }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-[0.18em] text-nx-mute flex items-center gap-1.5 justify-end">
        {icon}{label}
      </div>
      <div className={['font-mono text-base', tone === 'green' ? 'text-nx-green' : 'text-nx-text'].join(' ')}>{value}</div>
    </div>
  );
}
