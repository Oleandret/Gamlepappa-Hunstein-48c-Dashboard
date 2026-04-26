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
const IMG_VERSION = '4';

const VIEWS = {
  home: {
    label: 'Hjem',
    address: 'Hunstein 48c',
    Icon: HomeIcon,
    image: `/house.jpg?v=${IMG_VERSION}`,
    pins: [
      { kind: 'zone', zoneName: 'Hovedsoverom', x: 58, y: 36, dx: 4,   dy: -16 },
      { kind: 'zone', zoneName: 'Stue',         x: 50, y: 32, dx: -8,  dy: -16 },
      { kind: 'zone', zoneName: 'Kjøkken',      x: 38, y: 36, dx: -22, dy: -16 },
      { kind: 'zone', zoneName: 'Hovedetasjen', x: 53, y: 50, dx: -8,  dy: 8   },
      { kind: 'zone', zoneName: 'Garasje',      x: 31, y: 53, dx: -22, dy: -16 },
      { kind: 'zone', zoneName: 'Hage',         x: 24, y: 25, dx: -22, dy: -16 },
      { kind: 'zone', zoneName: 'Kjeller',      x: 50, y: 70, dx: 4,   dy: 12  },
      { kind: 'zone', zoneName: 'Kino',         x: 60, y: 72, dx: 4,   dy: 12  },
      { kind: 'tesla', x: 78, y: 39, dx: -32, dy: -16 },
      { kind: 'solar', x: 50, y: 14, dx: -22, dy: -16 }
    ]
  },
  cabin: {
    label: 'Hytte',
    address: 'Halsaneset 32',
    Icon: Anchor,
    image: `/cabin.jpg?v=${IMG_VERSION}`,
    pins: [
      { kind: 'cabinZone', zoneName: 'Halsaneset',          x: 62, y: 25, dx: -22, dy: -16 },
      { kind: 'cabinDevice', deviceMatch: 'Terasse',        x: 38, y: 42, dx: -22, dy: -16, label: 'TERRASSE' },
      { kind: 'cabinDevice', deviceMatch: 'Kjeller',        x: 38, y: 56, dx: 6,   dy: 8,   label: 'KJELLER' },
      { kind: 'sauna',     x: 24, y: 18, dx: -22, dy: -16 },
      { kind: 'pier',      x: 47, y: 80, dx: -22, dy: -16 },
      { kind: 'boathouse', x: 80, y: 76, dx: 6,   dy: -16 }
    ]
  }
};

export function HouseView({ devices, zones, weather, forceLocation = null }) {
  const [internalView, setInternalView] = useState('home');
  const view = forceLocation || internalView;
  const cur = VIEWS[view];
  const showToggle = !forceLocation;

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
  const tesla = useMemo(() =>
    allDevs.find(d => d.class === 'car' || /tesla/i.test(d.driverUri || '')),
    [allDevs]
  );
  const tibber = useMemo(() =>
    allDevs.find(d => /tibber/i.test(d.driverUri || '')),
    [allDevs]
  );
  const solarPower = capValue(tibber, 'measure_current.L1');

  return (
    <div className="relative h-full p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="panel-title flex items-center gap-1">
            <MapPin size={10} className="text-nx-cyan" aria-hidden="true" /> {cur.address}
          </p>
          <h2 className="mt-0.5 text-sm font-semibold flex items-center gap-1.5">
            {allSecure
              ? <ShieldCheck size={14} className="text-nx-green" aria-hidden="true" />
              : <ShieldAlert size={14} className="text-nx-amber" aria-hidden="true" />}
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

      <div className="relative mt-2 aspect-[16/9] w-full overflow-hidden rounded-xl border border-nx-line/60 bg-nx-bg">
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

        {cur.pins.map((p, i) => {
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
      <div
        className="absolute pointer-events-none"
        style={{ left: `${pos.dx ?? 0}%`, top: `${pos.dy ?? -16}px`, transform: 'translateY(-100%)' }}
        aria-hidden="true"
      >
        <div className={[
          'rounded-md border bg-nx-bg/85 backdrop-blur-sm px-2 py-1 shadow-glow-soft min-w-[80px]',
          hasAlarm ? 'border-nx-red/55'
                   : accent === 'green' ? 'border-nx-green/45'
                   : 'border-nx-cyan/45'
        ].join(' ')}>
          {children}
        </div>
        <div className={[
          'absolute left-1/2 top-full h-3 w-px',
          hasAlarm ? 'bg-nx-red/60'
                   : accent === 'green' ? 'bg-nx-green/60'
                   : 'bg-nx-cyan/50'
        ].join(' ')} />
      </div>
    </div>
  );
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
