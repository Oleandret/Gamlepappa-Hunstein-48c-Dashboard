import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Thermometer, Droplets, Lock, Unlock, Camera as CameraIcon,
  DoorOpen, ShieldAlert, ShieldCheck, Home as HomeIcon, Anchor,
  Car, Sun, Flame, Music, MapPin
} from 'lucide-react';
import { capValue, hasCap } from '../lib/deviceUtils.js';

/**
 * Two locations: huset (Hunstein 48c) og hytta (Halsaneset 32).
 * Each renders a background photo with sci-fi pin overlays.
 *
 * Use without `forceLocation` for a togglable single-panel view, or pass
 * `forceLocation="home"` / `"cabin"` to lock to one location (no toggle).
 *
 * Image URLs include a version query so browsers/CDN won't serve stale
 * copies after we update the JPGs.
 */
const IMG_VERSION = '5';

/**
 * Pin coordinates are % of the photo width / height.
 * `placement` controls which side of the pin the badge floats on:
 *   'top' (default), 'bottom', 'left', 'right'.
 * Spread pins apart enough that the badges don't overlap visually.
 *
 * VIEWS er eksportert slik at PinEditor i innstillinger kan bruke samme
 * data som default når brukeren ikke har lagret egen konfig.
 */
export const VIEWS = {
  home: {
    label: 'Hjem',
    address: 'Hunstein 48c',
    Icon: HomeIcon,
    image: `/house.jpg?v=${IMG_VERSION}`,
    pins: [
      // Top row (labels float above)
      { kind: 'zone',  zoneName: 'Hage',         x: 18, y: 28, placement: 'top' },     // basketball court (venstre)
      { kind: 'solar',                           x: 50, y: 18, placement: 'top' },     // solpaneler øverst
      { kind: 'zone',  zoneName: 'Stue',         x: 60, y: 32, placement: 'top' },     // terrasse-stue
      { kind: 'zone',  zoneName: 'Hovedsoverom', x: 78, y: 38, placement: 'top' },     // soverom oppe (høyre vinduer)
      // Middle row (labels float to side)
      { kind: 'zone',  zoneName: 'Garasje',      x: 30, y: 55, placement: 'left' },    // garasjeport (venstre)
      { kind: 'tesla',                           x: 82, y: 55, placement: 'right' },   // gul Tesla (høyre)
      // Lower row (labels float below — the sky is closed in by header)
      { kind: 'zone',  zoneName: 'Hovedetasjen', x: 55, y: 65, placement: 'bottom' },  // hovedetasje vinduer
      { kind: 'zone',  zoneName: 'Kjeller',      x: 50, y: 80, placement: 'bottom' }   // kjeller nederst
    ]
  },
  cabin: {
    label: 'Hytte',
    address: 'Halsaneset 32',
    Icon: Anchor,
    image: `/cabin.jpg?v=${IMG_VERSION}`,
    pins: [
      { kind: 'sauna',                                 x: 28, y: 14, placement: 'right' },  // lite sauna-bygg bak
      { kind: 'cabinZone',   zoneName: 'Halsaneset',   x: 70, y: 22, placement: 'top' },   // hovedhytta
      { kind: 'cabinDevice', deviceMatch: 'Terasse',   x: 50, y: 38, placement: 'left',   label: 'TERRASSE' }, // orangeri
      { kind: 'cabinDevice', deviceMatch: 'Kjeller',   x: 47, y: 55, placement: 'left',   label: 'KJELLER' },  // glass-rom
      { kind: 'pier',                                  x: 50, y: 82, placement: 'top' },   // brygge med båt
      { kind: 'boathouse',                             x: 82, y: 78, placement: 'top' }    // båthus (høyre)
    ]
  }
};

export function HouseView({ devices, zones, weather, forceLocation = null, customPins = null, imageConfig = null }) {
  const [internalView, setInternalView] = useState('home');
  const view = forceLocation || internalView;
  const cur = VIEWS[view];
  const showToggle = !forceLocation;
  // Hvis brukeren har overstyrt pin-config i innstillinger, bruk den; ellers default.
  const pins = (customPins && Array.isArray(customPins[view])) ? customPins[view] : cur.pins;
  // Brukerstyrt bildestørrelse (aspect ratio + max-h). Fallback til 16/9 + 260px.
  const aspectRatio = imageConfig?.aspectRatio || '16/9';
  const maxHeightPx = imageConfig?.maxHeight ?? 260;

  const outdoorTemp = Number.isFinite(weather?.now?.temp) ? `${Math.round(weather.now.temp)}°C` : '--';
  const humidity = Number.isFinite(weather?.now?.humidity) ? `${Math.round(weather.now.humidity)}%` : '--';

  const zoneStatus = useMemo(() => buildZoneStatus(devices, zones), [devices, zones]);
  const allDevs = Object.values(devices || {});

  // Filter devices that belong to this location for the header stats
  const locationDevices = useMemo(() => {
    if (view === 'cabin') {
      const cabinZone = Object.values(zones || {}).find(z => /halsaneset/i.test(z.name || ''));
      if (!cabinZone) return [];
      const cabinIds = collectZoneIds(zones, cabinZone.id);
      return allDevs.filter(d => cabinIds.includes(d.zone));
    }
    // For huset: alle som IKKE er i Halsaneset
    const cabinZone = Object.values(zones || {}).find(z => /halsaneset/i.test(z.name || ''));
    const cabinIds = cabinZone ? collectZoneIds(zones, cabinZone.id) : [];
    return allDevs.filter(d => !cabinIds.includes(d.zone));
  }, [allDevs, zones, view]);

  const indoorTemps = locationDevices
    .map(d => capValue(d, 'measure_temperature'))
    .filter(t => Number.isFinite(t));
  const avg = indoorTemps.length
    ? (indoorTemps.reduce((a, b) => a + b, 0) / indoorTemps.length).toFixed(1)
    : '--';

  const securityCounts = useMemo(() => ({
    locks:    locationDevices.filter(d => d.class === 'lock').length,
    locked:   locationDevices.filter(d => d.class === 'lock' && capValue(d, 'locked')).length,
    cameras:  locationDevices.filter(d => d.class === 'camera').length,
    motion:   locationDevices.filter(d => capValue(d, 'alarm_motion') === true).length,
    open:     locationDevices.filter(d => capValue(d, 'alarm_contact') === true).length
  }), [locationDevices]);

  const allSecure = (securityCounts.locks === 0 || securityCounts.locked === securityCounts.locks)
                    && securityCounts.open === 0
                    && securityCounts.motion === 0;

  // Find Tesla + Tibber for the special pins (only relevant for "home")
  // Foretrekk Model X hvis flere Tesla-enheter er registrert.
  const tesla = useMemo(() => {
    const cars = allDevs.filter(d => d.class === 'car' || /tesla/i.test(d.driverUri || ''));
    return cars.find(d => /model\s*x/i.test(d.name || '')) || cars[0] || null;
  }, [allDevs]);
  const tibber = useMemo(() =>
    allDevs.find(d => /tibber/i.test(d.driverUri || '')),
    [allDevs]
  );
  const solarPower = capValue(tibber, 'measure_current.L1');

  return (
    <div className="relative h-full p-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="panel-title flex items-center gap-1">
            <MapPin size={10} className="text-nx-cyan" aria-hidden="true" /> {cur.address}
          </p>
          <h2 className="mt-0.5 text-xs font-semibold flex items-center gap-1.5">
            {allSecure
              ? <ShieldCheck size={12} className="text-nx-green" aria-hidden="true" />
              : <ShieldAlert size={12} className="text-nx-amber" aria-hidden="true" />}
            {allSecure ? 'Sikret' : 'Sjekk'}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
          <Mini icon={<Thermometer size={10} className="text-nx-cyan" aria-hidden="true" />} value={`${avg}°`} />
          <Mini icon={<Droplets size={10} className="text-nx-cyan" aria-hidden="true" />} value={humidity} />
          {securityCounts.locks > 0 && (
            <Mini icon={<Lock size={10} className={securityCounts.locked === securityCounts.locks ? 'text-nx-green' : 'text-nx-amber'} aria-hidden="true" />} value={`${securityCounts.locked}/${securityCounts.locks}`} />
          )}
          {securityCounts.open > 0 && (
            <Mini icon={<DoorOpen size={10} className="text-nx-amber" aria-hidden="true" />} value={String(securityCounts.open)} />
          )}
          {securityCounts.cameras > 0 && (
            <Mini icon={<CameraIcon size={10} className={securityCounts.motion ? 'text-nx-amber' : 'text-nx-cyan'} aria-hidden="true" />} value={String(securityCounts.cameras)} />
          )}
        </div>
      </div>

      {showToggle && (
        <div className="mt-3 flex gap-1 p-0.5 rounded-lg border border-nx-line/60 bg-nx-panel/40 w-fit">
          {Object.entries(VIEWS).map(([key, v]) => {
            const active = view === key;
            const Icon = v.Icon;
            return (
              <button
                key={key}
                onClick={() => setInternalView(key)}
                aria-pressed={active}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono uppercase tracking-[0.18em] transition-colors',
                  active ? 'bg-nx-cyan/15 text-nx-cyan shadow-glow-soft' : 'text-nx-mute hover:text-nx-text'
                ].join(' ')}
              >
                <Icon size={12} aria-hidden="true" />
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="relative mt-2 w-full overflow-hidden rounded-xl border border-nx-line/60 bg-nx-bg"
        style={{ aspectRatio: aspectRatio.replace('/', ' / '), maxHeight: `${maxHeightPx}px` }}
      >
        <img
          src={cur.image}
          alt={`${cur.address} sett fra droneperspektiv`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(circle at 50% 35%, rgba(34,230,255,0.08), transparent 70%)'
        }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid bg-[size:32px_32px] opacity-12 mix-blend-screen" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -inset-x-10 h-32 bg-gradient-to-b from-transparent via-nx-cyan/8 to-transparent animate-scan" />
        </div>
        <Brackets />

        <motion.div
          key={view}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-3 left-3 chip text-xs"
        >
          <span className="text-nx-mute">UTE</span>
          <span className="font-mono text-nx-cyan">{outdoorTemp}</span>
        </motion.div>

        <div className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.22em] text-nx-mute">
          ◉ {cur.address.toUpperCase()} · LIVE
        </div>

        {pins.map((p, i) => {
          if (p.kind === 'zone') {
            const z = zoneStatus.find(s => s.name === p.zoneName);
            return <ZonePin key={i} zone={z || { name: p.zoneName, summary: '—' }} pos={p} />;
          }
          if (p.kind === 'cabinZone') {
            const z = zoneStatus.find(s => s.name === p.zoneName);
            return <ZonePin key={i} zone={z || { name: p.zoneName, summary: '—' }} pos={p} />;
          }
          if (p.kind === 'cabinDevice') {
            const dev = locationDevices.find(d => new RegExp(p.deviceMatch, 'i').test(d.name || ''));
            return <CabinDevicePin key={i} device={dev} label={p.label} pos={p} />;
          }
          if (p.kind === 'device') {
            const dev = devices?.[p.deviceId];
            return <DevicePin key={i} device={dev} fallbackLabel={p.label} pos={p} />;
          }
          if (p.kind === 'tesla') return tesla
            ? <TeslaPin key={i} tesla={tesla} pos={p} />
            : null;
          if (p.kind === 'solar') return tibber
            ? <SolarPin key={i} solarAmps={solarPower} pos={p} />
            : null;
          if (p.kind === 'sauna')     return <LabelPin key={i} label="SAUNA" sub="Halsaneset" pos={p} Icon={Flame} />;
          if (p.kind === 'pier')      return <LabelPin key={i} label="BRYGGE" sub="Sjøside" pos={p} Icon={Anchor} />;
          if (p.kind === 'boathouse') return <LabelPin key={i} label="BÅTHUS" sub="Verkstedslys" pos={p} Icon={Anchor} />;
          return null;
        })}
      </div>
    </div>
  );
}

const ZonePin = memo(function ZonePin({ zone, pos }) {
  const hasAlarm = zone.motion || zone.openContact;
  const allLocked = zone.locks > 0 && zone.locked === zone.locks;
  return (
    <PinShell pos={pos} hasAlarm={hasAlarm} ariaLabel={`${zone.name}: ${zone.summary || '—'}`}>
      <div className="text-[8px] tracking-[0.18em] text-nx-mute font-mono leading-none">
        {zone.name?.toUpperCase()}
      </div>
      {zone.temp != null && (
        <div className="text-[12px] font-mono text-nx-cyan leading-tight">
          {zone.temp.toFixed(1)}°C
        </div>
      )}
      <div className="flex items-center gap-1 mt-0.5">
        {zone.locks > 0 && (
          allLocked
            ? <Lock size={10} className="text-nx-green" aria-hidden="true" />
            : <Unlock size={10} className="text-nx-amber" aria-hidden="true" />
        )}
        {zone.cameras > 0 && (
          <CameraIcon size={10} className={zone.motion ? 'text-nx-red' : 'text-nx-mute'} aria-hidden="true" />
        )}
        {zone.openContact > 0 && <DoorOpen size={10} className="text-nx-amber" aria-hidden="true" />}
      </div>
    </PinShell>
  );
});

function CabinDevicePin({ device, label, pos }) {
  if (!device) {
    return (
      <PinShell pos={pos} ariaLabel={label}>
        <div className="text-[8px] tracking-[0.18em] text-nx-mute font-mono leading-none">{label}</div>
        <div className="text-[10px] font-mono text-nx-mute leading-tight">—</div>
      </PinShell>
    );
  }
  const t = capValue(device, 'measure_temperature');
  const target = capValue(device, 'target_temperature');
  const playing = capValue(device, 'speaker_playing');
  const onoff = capValue(device, 'onoff');
  return (
    <PinShell pos={pos} ariaLabel={`${label} — ${device.name}`}>
      <div className="text-[8px] tracking-[0.18em] text-nx-mute font-mono leading-none">{label}</div>
      {t != null && (
        <div className="text-[12px] font-mono text-nx-cyan leading-tight">
          {Number(t).toFixed(1)}°C
          {target != null && <span className="text-nx-mute text-[9px] ml-1">→ {Number(target).toFixed(0)}°</span>}
        </div>
      )}
      {playing !== undefined && (
        <div className={['text-[10px] font-mono leading-tight flex items-center gap-1', playing ? 'text-nx-cyan' : 'text-nx-mute'].join(' ')}>
          <Music size={9} aria-hidden="true" /> {playing ? 'spiller' : 'stille'}
        </div>
      )}
      {onoff !== undefined && playing === undefined && t == null && (
        <div className={['text-[10px] font-mono leading-tight', onoff ? 'text-nx-green' : 'text-nx-mute'].join(' ')}>
          {onoff ? 'PÅ' : 'AV'}
        </div>
      )}
    </PinShell>
  );
}

/**
 * Generisk pin for en spesifikk Homey-enhet valgt i innstillinger.
 * Velger den mest relevante capability-en å vise basert på hva enheten har.
 */
function DevicePin({ device, fallbackLabel, pos }) {
  if (!device) {
    return (
      <PinShell pos={pos} ariaLabel={fallbackLabel || 'Enhet ikke funnet'}>
        <div className="text-[8px] tracking-[0.18em] text-nx-mute font-mono leading-none">
          {(fallbackLabel || 'ENHET').toString().toUpperCase()}
        </div>
        <div className="text-[10px] font-mono text-nx-mute leading-tight">— mangler —</div>
      </PinShell>
    );
  }

  const t        = capValue(device, 'measure_temperature');
  const target   = capValue(device, 'target_temperature');
  const battery  = capValue(device, 'measure_battery');
  const onoff    = capValue(device, 'onoff');
  const locked   = capValue(device, 'locked');
  const motion   = capValue(device, 'alarm_motion');
  const contact  = capValue(device, 'alarm_contact');
  const playing  = capValue(device, 'speaker_playing');
  const dim      = capValue(device, 'dim');
  const power    = capValue(device, 'measure_power');

  const name = (fallbackLabel || device.name || 'enhet').toString();

  // Velg "primær" verdi som vises stort
  let primary = null;
  if (Number.isFinite(t)) {
    primary = (
      <span>
        {Number(t).toFixed(1)}°C
        {Number.isFinite(target) && <span className="text-nx-mute text-[9px] ml-1">→ {Number(target).toFixed(0)}°</span>}
      </span>
    );
  } else if (device.class === 'lock' && typeof locked === 'boolean') {
    primary = locked
      ? <span className="text-nx-green inline-flex items-center gap-1"><Lock size={10} /> Låst</span>
      : <span className="text-nx-amber inline-flex items-center gap-1"><Unlock size={10} /> Åpen</span>;
  } else if (typeof motion === 'boolean' && motion) {
    primary = <span className="text-nx-red">Bevegelse</span>;
  } else if (typeof contact === 'boolean' && contact) {
    primary = <span className="text-nx-amber">Åpen</span>;
  } else if (typeof playing === 'boolean') {
    primary = (
      <span className={playing ? 'text-nx-cyan inline-flex items-center gap-1' : 'text-nx-mute inline-flex items-center gap-1'}>
        <Music size={9} /> {playing ? 'spiller' : 'stille'}
      </span>
    );
  } else if (typeof onoff === 'boolean') {
    primary = onoff
      ? <span className="text-nx-green">{Number.isFinite(dim) ? `${Math.round(dim * 100)}%` : 'PÅ'}</span>
      : <span className="text-nx-mute">AV</span>;
  } else if (Number.isFinite(power)) {
    primary = <span>{Math.round(power)} W</span>;
  } else if (Number.isFinite(battery)) {
    primary = <span>{Math.round(battery)}%</span>;
  } else {
    primary = <span className="text-nx-mute">—</span>;
  }

  return (
    <PinShell pos={pos} ariaLabel={`${name} status`}>
      <div className="text-[8px] tracking-[0.18em] text-nx-mute font-mono leading-none truncate max-w-[120px]">
        {name.toUpperCase()}
      </div>
      <div className="text-[12px] font-mono text-nx-cyan leading-tight">
        {primary}
      </div>
      {Number.isFinite(battery) && Number.isFinite(t) && (
        <div className="text-[9px] font-mono text-nx-mute leading-tight">bat {Math.round(battery)}%</div>
      )}
    </PinShell>
  );
}

function TeslaPin({ tesla, pos }) {
  const battery = capValue(tesla, 'measure_battery');
  const charging = String(capValue(tesla, 'ev_charging_state') || '').toLowerCase().includes('charging');
  return (
    <PinShell pos={pos} ariaLabel={`Tesla ${tesla.name}: batteri ${battery}%`}>
      <div className="text-[8px] tracking-[0.18em] text-nx-mute font-mono leading-none flex items-center gap-1">
        <Car size={9} aria-hidden="true" /> {tesla.name?.toUpperCase()}
      </div>
      {battery != null && (
        <div className="text-[12px] font-mono text-nx-cyan leading-tight">
          {Math.round(battery)}%
          {charging && <span className="ml-1 text-nx-green">⚡</span>}
        </div>
      )}
    </PinShell>
  );
}

function SolarPin({ solarAmps, pos }) {
  const producing = solarAmps != null && solarAmps < 0;
  return (
    <PinShell pos={pos} ariaLabel="Solcelleanlegg" accent={producing ? 'green' : 'cyan'}>
      <div className="text-[8px] tracking-[0.18em] text-nx-mute font-mono leading-none flex items-center gap-1">
        <Sun size={9} aria-hidden="true" /> SOL
      </div>
      <div className={['text-[12px] font-mono leading-tight', producing ? 'text-nx-green' : 'text-nx-mute'].join(' ')}>
        {producing ? `+${Math.abs(solarAmps).toFixed(1)} A` : 'idle'}
      </div>
    </PinShell>
  );
}

function LabelPin({ label, sub, pos, Icon }) {
  return (
    <PinShell pos={pos} ariaLabel={`${label}${sub ? ' — ' + sub : ''}`}>
      <div className="text-[8px] tracking-[0.18em] text-nx-mute font-mono leading-none flex items-center gap-1">
        {Icon && <Icon size={9} aria-hidden="true" />} {label}
      </div>
      {sub && <div className="text-[10px] font-mono text-nx-cyan leading-tight truncate max-w-[120px]">{sub}</div>}
    </PinShell>
  );
}

function PinShell({ pos, ariaLabel, hasAlarm = false, accent = 'cyan', children }) {
  const placement = pos.placement || 'top';
  const placementStyle = getPlacementStyle(placement);

  return (
    <div
      className="absolute"
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
      role="img"
      aria-label={ariaLabel}
    >
      <span aria-hidden="true" className={[
        'absolute inset-0 -m-1 rounded-full border animate-pulseGlow',
        hasAlarm ? 'border-nx-red/70'
                 : accent === 'green' ? 'border-nx-green/60'
                 : 'border-nx-cyan/60'
      ].join(' ')} />
      <span aria-hidden="true" className={[
        'relative block h-2.5 w-2.5 rounded-full',
        hasAlarm ? 'bg-nx-red shadow-[0_0_12px_rgba(255,92,122,0.9)]'
                 : accent === 'green' ? 'bg-nx-green shadow-[0_0_12px_rgba(61,220,132,0.9)]'
                 : 'bg-nx-cyan shadow-[0_0_12px_rgba(34,230,255,0.9)]'
      ].join(' ')} />
      <div className="absolute pointer-events-none" style={placementStyle.label} aria-hidden="true">
        <div className={[
          'rounded-md border bg-nx-bg/85 backdrop-blur-sm px-2 py-1 shadow-glow-soft min-w-[72px] whitespace-nowrap',
          hasAlarm ? 'border-nx-red/55'
                   : accent === 'green' ? 'border-nx-green/45'
                   : 'border-nx-cyan/45'
        ].join(' ')}>
          {children}
        </div>
        <div
          className={[
            'absolute',
            hasAlarm ? 'bg-nx-red/60'
                     : accent === 'green' ? 'bg-nx-green/60'
                     : 'bg-nx-cyan/50'
          ].join(' ')}
          style={placementStyle.connector}
        />
      </div>
    </div>
  );
}

function getPlacementStyle(placement) {
  switch (placement) {
    case 'bottom':
      return {
        label:     { top: '14px', left: '50%', transform: 'translateX(-50%)' },
        connector: { left: '50%', top: '-8px', height: '8px', width: '1px' }
      };
    case 'left':
      return {
        label:     { right: '16px', top: '50%', transform: 'translateY(-50%)' },
        connector: { right: '-8px', top: '50%', width: '8px', height: '1px' }
      };
    case 'right':
      return {
        label:     { left: '16px', top: '50%', transform: 'translateY(-50%)' },
        connector: { left: '-8px', top: '50%', width: '8px', height: '1px' }
      };
    case 'top':
    default:
      return {
        label:     { bottom: '14px', left: '50%', transform: 'translateX(-50%)' },
        connector: { left: '50%', top: '100%', height: '8px', width: '1px' }
      };
  }
}

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

function Mini({ icon, value }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-nx-line/60 bg-nx-panel/60 px-1.5 py-0.5">
      {icon}<span className="text-nx-text">{value}</span>
    </span>
  );
}

function buildZoneStatus(devices, zones) {
  const list = Object.values(devices || {});
  const result = {};
  for (const d of list) {
    const zone = zones?.[d.zone];
    if (!zone) continue;
    if (!result[zone.id]) {
      result[zone.id] = { id: zone.id, name: zone.name, temps: [], locks: 0, locked: 0, cameras: 0, motion: 0, openContact: 0 };
    }
    const s = result[zone.id];
    const t = capValue(d, 'measure_temperature');
    if (Number.isFinite(t)) s.temps.push(t);
    if (d.class === 'lock') {
      s.locks++;
      if (capValue(d, 'locked')) s.locked++;
    }
    if (d.class === 'camera') s.cameras++;
    if (capValue(d, 'alarm_motion') === true) s.motion++;
    if (hasCap(d, 'alarm_contact') && capValue(d, 'alarm_contact') === true) s.openContact++;
  }
  return Object.values(result).map(s => ({
    ...s,
    temp: s.temps.length ? s.temps.reduce((a,b)=>a+b,0) / s.temps.length : null,
    summary: [
      s.temps.length && `${(s.temps.reduce((a,b)=>a+b,0) / s.temps.length).toFixed(1)}°`,
      s.locks > 0 && `${s.locked}/${s.locks} låst`,
      s.openContact > 0 && `${s.openContact} åpen`,
      s.motion > 0 && `${s.motion} bevegelse`
    ].filter(Boolean).join(' · ') || 'OK'
  }));
}

function collectZoneIds(zones, rootId) {
  const ids = [rootId];
  const all = Object.values(zones || {});
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift();
    for (const z of all) {
      if (z.parent === current) {
        ids.push(z.id);
        queue.push(z.id);
      }
    }
  }
  return ids;
}
