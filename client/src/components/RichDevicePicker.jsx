import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, X, Lightbulb, Lock, Thermometer, Activity, DoorOpen, Camera,
  Music, Zap, Power, Battery, Droplets, Sun, Flame, ChevronDown, Wind, Tv
} from 'lucide-react';
import { allCaps, capValue, classLabel, hasCap } from '../lib/deviceUtils.js';

/**
 * Søkbar enhets-velger med rikt info-display per rad: navn, klasse,
 * capabilities (oversatt til norsk), og live state der det er relevant.
 *
 * Brukes som drop-in-erstatter for native <select> hvor brukeren skal
 * plukke en spesifikk Homey-enhet (floor plan pins, sensor-widgets, osv.).
 */

const CAP_LABEL = {
  onoff: 'av/på',
  dim: 'dimmer',
  light_temperature: 'fargetemp',
  light_hue: 'farge',
  light_saturation: 'metning',
  measure_temperature: 'temp',
  target_temperature: 'måltemp',
  measure_humidity: 'fuktighet',
  measure_luminance: 'lys-nivå',
  measure_power: 'effekt',
  meter_power: 'kWh',
  measure_battery: 'batteri',
  alarm_battery: 'batteri-alarm',
  locked: 'lås',
  alarm_motion: 'bevegelse',
  alarm_contact: 'dør/vindu',
  alarm_smoke: 'røyk',
  alarm_water: 'vann',
  speaker_playing: 'spiller',
  speaker_track: 'spor',
  volume_set: 'volum',
  volume_mute: 'mute',
  windowcoverings_set: 'persienne',
  windowcoverings_state: 'persienne-status',
  measure_co: 'CO',
  measure_co2: 'CO₂',
  measure_pm25: 'PM2.5',
  measure_voc: 'VOC',
  measure_noise: 'støy',
  measure_rain: 'regn',
  measure_wind_strength: 'vind',
  measure_wind_angle: 'vindretning',
  measure_pressure: 'lufttrykk',
  measure_gust_strength: 'vindkast',
  measure_water: 'vann-nivå',
  alarm_tamper: 'sabotasje',
  thermostat_mode: 'modus',
  vacuumcleaner_state: 'støvsuger-status',
  homealarm_state: 'alarm-status'
};

function classIcon(cls) {
  return ({
    light: Lightbulb,
    lock: Lock,
    thermostat: Thermometer,
    sensor: Activity,
    camera: Camera,
    speaker: Music,
    tv: Tv,
    socket: Power,
    fan: Wind,
    heater: Flame,
    homealarm: Activity,
    button: Power,
    doorbell: Activity,
    car: Power,
    curtain: ChevronDown,
    windowcoverings: ChevronDown,
    vacuumcleaner: Activity,
    other: Activity
  })[cls] || Activity;
}

function shortStatus(d) {
  // Kortest mulig oversikt over enhetens nåværende status
  if (hasCap(d, 'onoff')) {
    const on = capValue(d, 'onoff');
    if (hasCap(d, 'dim') && on) {
      const dim = capValue(d, 'dim');
      return Number.isFinite(dim) ? `på ${Math.round(dim * 100)}%` : 'på';
    }
    return on ? 'på' : 'av';
  }
  if (hasCap(d, 'locked')) return capValue(d, 'locked') ? 'låst' : 'ulåst';
  if (hasCap(d, 'measure_temperature')) {
    const t = capValue(d, 'measure_temperature');
    return Number.isFinite(t) ? `${t.toFixed(1)}°C` : '—';
  }
  if (hasCap(d, 'measure_battery')) {
    const b = capValue(d, 'measure_battery');
    return Number.isFinite(b) ? `bat ${Math.round(b)}%` : '—';
  }
  if (hasCap(d, 'alarm_motion')) return capValue(d, 'alarm_motion') ? 'BEVEGELSE' : 'rolig';
  if (hasCap(d, 'alarm_contact')) return capValue(d, 'alarm_contact') ? 'åpen' : 'lukket';
  if (hasCap(d, 'speaker_playing')) return capValue(d, 'speaker_playing') ? 'spiller' : 'stille';
  if (hasCap(d, 'measure_power')) {
    const p = capValue(d, 'measure_power');
    return Number.isFinite(p) ? `${Math.round(p)} W` : '—';
  }
  return '';
}

function deviceCapsList(d) {
  return allCaps(d)
    .map(c => CAP_LABEL[c] || c)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 5);
}

export function RichDevicePicker({
  value,
  onChange,
  devices,
  zones,
  placeholder = 'Velg enhet…',
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const selected = value && devices?.[value] ? devices[value] : null;

  // Lukk dropdown når man klikker utenfor
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const groups = useMemo(() => {
    const all = Object.values(devices || {});
    const q = query.trim().toLowerCase();
    const filtered = all.filter(d => {
      if (!q) return true;
      const hay = [
        d.name || '',
        classLabel(d.class) || '',
        d.class || '',
        zones?.[d.zone]?.name || '',
        ...allCaps(d)
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });

    const byZone = {};
    for (const d of filtered) {
      const zoneName = zones?.[d.zone]?.name || 'Uten sone';
      if (!byZone[zoneName]) byZone[zoneName] = [];
      byZone[zoneName].push(d);
    }
    Object.values(byZone).forEach(arr => arr.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    return Object.entries(byZone).sort((a, b) => a[0].localeCompare(b[0]));
  }, [devices, zones, query]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-text font-mono hover:border-nx-cyan/40 transition-colors"
      >
        {selected ? (
          <>
            {(() => { const I = classIcon(selected.class); return <I size={11} className="text-nx-cyan shrink-0" aria-hidden="true" />; })()}
            <span className="truncate text-left flex-1">{selected.name || '(uten navn)'}</span>
            <span className="text-nx-mute text-[10px] shrink-0">{classLabel(selected.class)}</span>
          </>
        ) : (
          <span className="text-nx-mute italic flex-1 text-left">{placeholder}</span>
        )}
        <ChevronDown size={11} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border border-nx-cyan/45 bg-nx-bg/95 backdrop-blur-md shadow-glow-soft overflow-hidden">
          <div className="relative border-b border-nx-line/40">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-nx-mute" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk navn, type, capability, rom..."
              autoFocus
              className="w-full bg-transparent border-none pl-7 pr-7 py-2 text-xs text-nx-text placeholder:text-nx-mute focus:outline-none font-mono"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Tøm søk"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-nx-mute hover:text-nx-cyan"
              >
                <X size={11} />
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {groups.length === 0 && (
              <p className="px-3 py-6 text-xs text-nx-mute italic text-center">Ingen treff</p>
            )}
            {groups.map(([zoneName, devs]) => (
              <div key={zoneName}>
                <div className="sticky top-0 bg-nx-panel/90 backdrop-blur px-2 py-1 text-[9px] font-mono uppercase tracking-[0.18em] text-nx-mute border-b border-nx-line/30">
                  {zoneName} ({devs.length})
                </div>
                <ul>
                  {devs.map(d => {
                    const Icon = classIcon(d.class);
                    const isSelected = d.id === value;
                    const caps = deviceCapsList(d);
                    const status = shortStatus(d);
                    const offline = d.available === false;
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onChange(d.id);
                            setOpen(false);
                            setQuery('');
                          }}
                          className={[
                            'w-full text-left px-2 py-1.5 flex items-start gap-2 hover:bg-nx-cyan/10 transition-colors border-b border-nx-line/20',
                            isSelected ? 'bg-nx-cyan/15' : ''
                          ].join(' ')}
                        >
                          <Icon size={13} className={[
                            'shrink-0 mt-0.5',
                            offline ? 'text-nx-red' : isSelected ? 'text-nx-cyan' : 'text-nx-mute'
                          ].join(' ')} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs truncate ${isSelected ? 'text-nx-cyan font-semibold' : 'text-nx-text'}`}>
                                {d.name || '(uten navn)'}
                              </span>
                              <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-nx-mute">
                                {classLabel(d.class)}
                              </span>
                              {offline && <span className="text-[9px] font-mono text-nx-red">offline</span>}
                              {status && (
                                <span className="text-[9px] font-mono text-nx-cyan ml-auto">{status}</span>
                              )}
                            </div>
                            {caps.length > 0 && (
                              <div className="text-[9px] text-nx-mute font-mono truncate mt-0.5">
                                {caps.join(' · ')}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
