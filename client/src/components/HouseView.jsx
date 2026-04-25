import { motion } from 'framer-motion';
import { Thermometer, Droplets } from 'lucide-react';

/**
 * Room overlay positions (% of image width / height).
 * Tune these in one place to match the actual rooms in /house.jpg.
 *
 *   xPct, yPct  → pin/dot location on the photo
 *   labelDX/DY  → offset (in % units) of the floating temp badge from the dot
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
    d.zone === zone.id && (d.capabilities?.measure_temperature != null
      || d.capabilitiesObj?.measure_temperature?.value != null)
  );
  if (!dev) return null;
  return dev.capabilities?.measure_temperature ?? dev.capabilitiesObj?.measure_temperature?.value;
}

export function HouseView({ devices, zones, weather }) {
  const outdoorTemp = weather?.now?.temp != null ? `${Math.round(weather.now.temp)}°C` : '--';
  const humidity = weather?.now?.humidity != null ? `${Math.round(weather.now.humidity)}%` : '--';

  const indoorTemps = Object.values(devices)
    .map(d => d.capabilities?.measure_temperature ?? d.capabilitiesObj?.measure_temperature?.value)
    .filter(t => typeof t === 'number');
  const avg = indoorTemps.length
    ? (indoorTemps.reduce((a,b)=>a+b,0)/indoorTemps.length).toFixed(1)
    : '--';

  return (
    <div className="relative h-full p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="panel-title">Hjemmet</p>
          <h2 className="mt-1 text-lg font-semibold">Alt er normalt</h2>
        </div>
        <div className="flex items-center gap-4">
          <Stat icon={<Thermometer size={14} className="text-nx-cyan" />} label="Innetemp" value={`${avg}°C`} />
          <Stat icon={<Droplets size={14} className="text-nx-cyan" />} label="Luftfuktighet" value={humidity} />
          <Stat label="Luftkvalitet" value="God" tone="green" />
        </div>
      </div>

      <div className="relative mt-3 aspect-[16/9] w-full overflow-hidden rounded-xl border border-nx-line/60 bg-nx-bg">
        {/* Actual drone photo */}
        <img
          src="/house.jpg"
          alt="Hunstein 48c sett fra droneperspektiv"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {/* Tonal overlay so neon text is legible */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-nx-bg/65 via-nx-bg/20 to-nx-bg/75" />
        <div className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(circle at 50% 35%, rgba(34,230,255,0.10), transparent 65%)'
        }} />

        {/* Tech grid overlay */}
        <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:32px_32px] opacity-25 mix-blend-screen" />

        {/* Animated scanline */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -inset-x-10 h-32 bg-gradient-to-b from-transparent via-nx-cyan/12 to-transparent animate-scan" />
        </div>

        {/* Corner brackets — sci-fi reticle */}
        <Brackets />

        {/* Outdoor temperature badge */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-3 left-3 chip text-xs"
        >
          <span className="text-nx-mute">UTE</span>
          <span className="font-mono text-nx-cyan">{outdoorTemp}</span>
        </motion.div>

        {/* Address tag */}
        <div className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.22em] text-nx-mute">
          ◉ HUNSTEIN 48c
        </div>

        {/* Room temperature pins */}
        {ROOM_PINS.map(p => {
          const t = findTempForZone(p.zone, devices, zones);
          return (
            <RoomPin
              key={p.zone}
              label={p.label}
              temp={t}
              xPct={p.xPct}
              yPct={p.yPct}
              labelDX={p.labelDX ?? 0}
              labelDY={p.labelDY ?? -16}
            />
          );
        })}
      </div>

      <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-nx-mute font-mono">
        Tips: juster pin-posisjoner i ROOM_PINS øverst i HouseView.jsx
      </p>
    </div>
  );
}

function RoomPin({ label, temp, xPct, yPct, labelDX, labelDY }) {
  return (
    <div className="absolute" style={{ left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%, -50%)' }}>
      {/* Pulse ring */}
      <span className="absolute inset-0 -m-1 rounded-full border border-nx-cyan/60 animate-pulseGlow" />
      {/* Core dot */}
      <span className="relative block h-2.5 w-2.5 rounded-full bg-nx-cyan shadow-[0_0_12px_rgba(34,230,255,0.9)]" />
      {/* Connector + badge */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${labelDX}%`,
          top: `${labelDY}px`,
          transform: 'translateY(-100%)'
        }}
      >
        <div className="rounded-md border border-nx-cyan/45 bg-nx-bg/85 backdrop-blur-sm px-2 py-1 shadow-glow-soft">
          <div className="text-[8px] tracking-[0.18em] text-nx-mute font-mono leading-none">{label}</div>
          <div className="text-[12px] font-mono text-nx-cyan leading-tight">
            {temp != null ? `${temp.toFixed(1)}°C` : '—'}
          </div>
        </div>
        {/* Connector line */}
        <div className="absolute left-1/2 top-full h-3 w-px bg-nx-cyan/50" />
      </div>
    </div>
  );
}

function Brackets() {
  const cls = 'absolute h-5 w-5 border-nx-cyan/70';
  return (
    <>
      <div className={`${cls} top-2 left-2 border-t-2 border-l-2`} />
      <div className={`${cls} top-2 right-2 border-t-2 border-r-2`} />
      <div className={`${cls} bottom-2 left-2 border-b-2 border-l-2`} />
      <div className={`${cls} bottom-2 right-2 border-b-2 border-r-2`} />
    </>
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
