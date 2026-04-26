import { memo } from 'react';
import {
  Lightbulb, Power, Thermometer, Lock, Unlock, Camera, Wind,
  Volume2, Zap, Droplet, Activity, BellRing, Star, StarOff,
  Battery, Sun, BatteryLow, AlertTriangle, Disc3, Car, Plug,
  ChevronUp, ChevronDown
} from 'lucide-react';
import { capValue, hasCap, classLabel } from '../lib/deviceUtils.js';

/**
 * One device → one card. Renders the most relevant controls based on the
 * device's class and capabilities. Designed to handle 200+ devices in a list.
 */
export const DeviceCard = memo(function DeviceCard({ device, zoneName, onSet, isFavorite, onToggleFavorite }) {
  const Icon = pickIcon(device);
  const onoff = hasCap(device, 'onoff') ? capValue(device, 'onoff') : null;
  const dim = hasCap(device, 'dim') ? capValue(device, 'dim') : null;
  const temp = capValue(device, 'measure_temperature');
  const target = capValue(device, 'target_temperature');
  const humidity = capValue(device, 'measure_humidity');
  const power = capValue(device, 'measure_power');
  const battery = capValue(device, 'measure_battery');
  const locked = capValue(device, 'locked');
  const alarms = readAlarms(device);
  const volume = capValue(device, 'volume_set');
  const blindPos = capValue(device, 'windowcoverings_set');

  const set = (cap, value) => onSet?.(device.id, cap, value);

  return (
    <div className="panel p-3 flex flex-col gap-2 min-h-[112px]">
      <header className="flex items-start gap-2">
        <span className={[
          'grid h-8 w-8 place-items-center rounded-lg shrink-0',
          onoff ? 'bg-nx-cyan/15 text-nx-cyan shadow-glow-soft' : 'bg-nx-panel/60 text-nx-mute'
        ].join(' ')}>
          <Icon size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-tight truncate" title={device.name}>{device.name}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-nx-mute font-mono truncate">
            {zoneName || '—'} · {classLabel(device.class)}
          </div>
        </div>
        {onToggleFavorite && (
          <button
            onClick={() => onToggleFavorite(device.id)}
            aria-label={isFavorite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
            aria-pressed={isFavorite}
            className={[
              'p-1 rounded-md transition-colors',
              isFavorite ? 'text-nx-amber' : 'text-nx-mute hover:text-nx-text'
            ].join(' ')}
          >
            {isFavorite ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
          </button>
        )}
      </header>

      {/* Primary control row */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {onoff !== null && (
          <button
            onClick={() => set('onoff', !onoff)}
            aria-pressed={!!onoff}
            aria-label={`${device.name} — ${onoff ? 'skru av' : 'skru på'}`}
            className={[
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono transition-colors',
              onoff
                ? 'border-nx-cyan/55 bg-nx-cyan/15 text-nx-cyan'
                : 'border-nx-line/60 text-nx-mute hover:border-nx-cyan/40'
            ].join(' ')}
          >
            <Power size={11} aria-hidden="true" /> {onoff ? 'PÅ' : 'AV'}
          </button>
        )}
        {locked != null && (
          <button
            onClick={() => set('locked', !locked)}
            aria-pressed={!!locked}
            aria-label={locked ? 'Lås opp' : 'Lås'}
            className={[
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono',
              locked ? 'border-nx-green/45 text-nx-green bg-nx-green/10' : 'border-nx-amber/45 text-nx-amber bg-nx-amber/10'
            ].join(' ')}
          >
            {locked ? <Lock size={11} aria-hidden="true" /> : <Unlock size={11} aria-hidden="true" />}
            {locked ? 'LÅST' : 'ULÅST'}
          </button>
        )}
        {temp != null && (
          <span className="chip text-[11px]">
            <Thermometer size={11} className="text-nx-cyan" aria-hidden="true" />
            <span className="font-mono">{Number(temp).toFixed(1)}°</span>
            {target != null && <span className="text-nx-mute">→ {Number(target).toFixed(1)}°</span>}
          </span>
        )}
        {humidity != null && (
          <span className="chip text-[11px]">
            <Droplet size={11} className="text-nx-cyan" aria-hidden="true" />
            <span className="font-mono">{Math.round(humidity)}%</span>
          </span>
        )}
        {power != null && (
          <span className="chip text-[11px]">
            <Zap size={11} className="text-nx-cyan" aria-hidden="true" />
            <span className="font-mono">{Math.round(power)} W</span>
          </span>
        )}
        {battery != null && (
          <span className={[
            'chip text-[11px]',
            battery < 20 ? 'text-nx-red border-nx-red/40' : 'text-nx-mute'
          ].join(' ')}>
            {battery < 20 ? <BatteryLow size={11} aria-hidden="true" /> : <Battery size={11} aria-hidden="true" />}
            <span className="font-mono">{Math.round(battery)}%</span>
          </span>
        )}
      </div>

      {/* Dim / volume / blind sliders */}
      {(dim != null || volume != null || blindPos != null) && (
        <div className="space-y-1">
          {dim != null && onoff !== false && (
            <Slider label="Dim" value={dim} onChange={(v) => set('dim', v)} ariaLabel={`${device.name} dim-nivå`} />
          )}
          {volume != null && (
            <Slider label="Volum" value={volume} onChange={(v) => set('volume_set', v)} ariaLabel={`${device.name} volum`} />
          )}
          {blindPos != null && (
            <Slider label="Posisjon" value={blindPos} onChange={(v) => set('windowcoverings_set', v)}
                    ariaLabel={`${device.name} posisjon`} icons={[ChevronDown, ChevronUp]} />
          )}
        </div>
      )}

      {/* Alarms */}
      {alarms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {alarms.map(a => (
            <span key={a.cap} className={[
              'chip text-[11px]',
              a.active ? 'text-nx-red border-nx-red/45 animate-pulseGlow' : 'text-nx-mute'
            ].join(' ')}>
              <BellRing size={11} aria-hidden="true" /> {a.label}
            </span>
          ))}
        </div>
      )}

      {!device.available && (
        <div className="text-[10px] uppercase tracking-[0.18em] text-nx-amber font-mono">offline</div>
      )}
    </div>
  );
});

function Slider({ label, value, onChange, ariaLabel, icons }) {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  const [LowIcon, HighIcon] = icons || [];
  return (
    <label className="flex items-center gap-2 text-[11px]">
      <span className="text-nx-mute w-12 shrink-0 flex items-center gap-1">
        {LowIcon && <LowIcon size={10} aria-hidden="true" />}
        {label}
      </span>
      <input
        type="range" min="0" max="1" step="0.01" value={v}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        className="flex-1 accent-nx-cyan"
      />
      <span className="font-mono w-8 text-right text-nx-text">{Math.round(v * 100)}%</span>
      {HighIcon && <HighIcon size={10} className="text-nx-mute" aria-hidden="true" />}
    </label>
  );
}

function readAlarms(device) {
  const out = [];
  const map = {
    alarm_motion: 'Bevegelse',
    alarm_contact: 'Åpen',
    alarm_smoke: 'RØYK',
    alarm_water: 'LEKKASJE',
    alarm_battery: 'Lavt batteri',
    alarm_generic: 'Alarm'
  };
  for (const [cap, label] of Object.entries(map)) {
    const v = capValue(device, cap);
    if (v == null) continue;
    out.push({ cap, label, active: !!v });
  }
  return out;
}

function pickIcon(device) {
  const cls = device.class;
  if (cls === 'light') return Lightbulb;
  if (cls === 'socket') return Plug;
  if (cls === 'thermostat' || cls === 'heater') return Thermometer;
  if (cls === 'lock') return capValue(device, 'locked') ? Lock : Unlock;
  if (cls === 'camera') return Camera;
  if (cls === 'speaker' || cls === 'tv') return Volume2;
  if (cls === 'windowcoverings') return ChevronUp;
  if (cls === 'fan') return Wind;
  if (cls === 'lawnmower') return Sun;
  if (cls === 'vacuumcleaner') return Disc3;
  if (cls === 'electricvehicle' || cls === 'evcharger') return Car;
  if (cls === 'garagedoor') return Lock;
  if (hasCap(device, 'measure_power')) return Zap;
  if (hasCap(device, 'alarm_motion')) return Activity;
  if (hasCap(device, 'alarm_smoke') || hasCap(device, 'alarm_water')) return AlertTriangle;
  return Activity;
}
