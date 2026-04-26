import { useMemo, useState } from 'react';
import { Home as HomeIcon, Anchor, Building2, Upload, Lock, Unlock, Camera as CameraIcon, DoorOpen, FileSpreadsheet, ZoomIn, ZoomOut } from 'lucide-react';
import { capValue, hasCap } from '../../lib/deviceUtils.js';

/**
 * Floor plan visualisation. Reads plantegninger from /public/* and lets the
 * user toggle between hytta (Halsaneset) and huset (Hunstein 48c).
 *
 * Pin coordinates are tuned to match the actual room rectangles in each plan.
 */
const PLAN_VERSION = '1';

const PLANS = {
  cabinMain: {
    id: 'cabinMain',
    location: 'cabin',
    label: 'Hytte · Hovedplan',
    image: `/cabin-floor-main.jpg?v=${PLAN_VERSION}`,
    rooms: [
      { name: 'OVERBYGD TERRASSE', match: /halsaneset terasse/i, x: 60, y: 14, w: 30, h: 12 },
      { name: 'KJØKKEN',           match: /kj.kken/i,            x: 38, y: 32, w: 14, h: 10 },
      { name: 'STUE',              match: /halsaneset/i,         x: 60, y: 36, w: 28, h: 18 },
      { name: 'SOVEROM',           match: /soverom 1/i,          x: 42, y: 47, w: 16, h: 9  },
      { name: 'SOVEROM 2',         match: /soverom 2/i,          x: 38, y: 60, w: 18, h: 10 },
      { name: 'TV-STUE',           match: /tv|stue 2/i,          x: 65, y: 60, w: 18, h: 10 },
      { name: 'BAD',               match: /bad/i,                x: 56, y: 75, w: 8,  h: 5  },
      { name: 'ENTRÉ',             match: /entr/i,               x: 70, y: 75, w: 10, h: 5  }
    ]
  },
  cabinBasement: {
    id: 'cabinBasement',
    location: 'cabin',
    label: 'Hytte · Kjellerplan',
    image: `/cabin-floor-basement.jpg?v=${PLAN_VERSION}`,
    rooms: [
      { name: 'SOVEROM',  match: /halsaneset kjeller/i, x: 56, y: 30, w: 25, h: 14 },
      { name: 'BAD',      match: /bad/i,                x: 38, y: 32, w: 10, h: 9  },
      { name: 'VASKEROM', match: /vask/i,               x: 38, y: 52, w: 24, h: 12 }
    ]
  },
  homeRomskjerma: {
    id: 'homeRomskjerma',
    location: 'home',
    label: 'Hus · Romskjerma',
    image: `/home-romskjerma.jpg?v=${PLAN_VERSION}`,
    kind: 'reference',  // referanse-bilde, ikke plantegning med rom-rektangler
    rooms: []
  },
  homeFloor1: {
    id: 'homeFloor1',
    location: 'home',
    label: 'Hus · 1. etasje',
    image: null,
    rooms: []
  },
  homeFloor2: {
    id: 'homeFloor2',
    location: 'home',
    label: 'Hus · 2. etasje',
    image: null,
    rooms: []
  },
  homeBasement: {
    id: 'homeBasement',
    location: 'home',
    label: 'Hus · Kjeller',
    image: null,
    rooms: []
  }
};

export function FloorPlanView({ devices, zones }) {
  const [planId, setPlanId] = useState('cabinMain');
  const plan = PLANS[planId];

  const tabs = Object.values(PLANS);

  const roomData = useMemo(
    () => plan.rooms.map(r => ({ ...r, status: getRoomStatus(r, devices, zones) })),
    [plan, devices, zones]
  );

  return (
    <div>
      <header className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 className="panel-title">Plantegning</h2>
          <p className="mt-1 text-xl font-semibold">{plan.label}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tabs.map(t => {
            const active = planId === t.id;
            const Icon = t.kind === 'reference' ? FileSpreadsheet
                       : t.location === 'cabin' ? Anchor
                       : t.id.includes('Basement') ? Building2
                       : HomeIcon;
            return (
              <button
                key={t.id}
                onClick={() => setPlanId(t.id)}
                aria-pressed={active}
                disabled={!t.image && t.id !== planId}
                className={[
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] border transition-colors',
                  active ? 'border-nx-cyan/55 bg-nx-cyan/15 text-nx-cyan'
                         : t.image
                           ? 'border-nx-line/60 text-nx-mute hover:text-nx-text hover:border-nx-cyan/40'
                           : 'border-nx-line/40 text-nx-mute/50 cursor-not-allowed'
                ].join(' ')}
                title={t.image ? '' : 'Last opp plantegning for å aktivere'}
              >
                <Icon size={11} aria-hidden="true" />
                {t.label.replace('Hytte · ', '').replace('Hus · ', '')}
              </button>
            );
          })}
        </div>
      </header>

      {!plan.image
        ? <PlanPlaceholder plan={plan} />
        : plan.kind === 'reference'
          ? <ReferenceImage plan={plan} />
          : <FloorPlanCanvas plan={plan} rooms={roomData} />
      }

      {plan.image && plan.kind !== 'reference' && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {roomData.filter(r => r.status.hasData).map(r => (
            <RoomStatusCard key={r.name} room={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReferenceImage({ plan }) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
          aria-label="Zoom ut"
          className="grid h-7 w-7 place-items-center rounded-md border border-nx-line/60 hover:border-nx-cyan/55 hover:text-nx-cyan transition-colors"
        ><ZoomOut size={13} /></button>
        <span className="font-mono text-xs text-nx-mute w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(z => Math.min(3, z + 0.25))}
          aria-label="Zoom inn"
          className="grid h-7 w-7 place-items-center rounded-md border border-nx-line/60 hover:border-nx-cyan/55 hover:text-nx-cyan transition-colors"
        ><ZoomIn size={13} /></button>
        <button
          onClick={() => setZoom(1)}
          className="text-[11px] font-mono text-nx-mute hover:text-nx-cyan ml-1"
        >100%</button>
        <p className="ml-auto text-[10px] text-nx-mute font-mono">
          Smarthus-romskjerma · 3 etasjer · alle Google/Siri-kommandoer + teknisk utstyr per rom
        </p>
      </div>
      <div className="rounded-xl border border-nx-line/60 bg-white overflow-auto max-h-[80vh]">
        <img
          src={plan.image}
          alt={plan.label}
          loading="lazy"
          decoding="async"
          style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
          className="block"
          draggable={false}
        />
      </div>
      <p className="text-[10px] text-nx-mute font-mono">
        Tips: scroll horisontalt og vertikalt i tabellen, eller zoom inn for å lese kommandoer.
      </p>
    </div>
  );
}

function FloorPlanCanvas({ plan, rooms }) {
  return (
    <div className="relative w-full aspect-[7/8] overflow-hidden rounded-xl border border-nx-line/60 bg-white">
      <img
        src={plan.image}
        alt={plan.label}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain"
        draggable={false}
      />

      {/* Cyan tint overlay for sci-fi feel */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 mix-blend-multiply" style={{
        background: 'radial-gradient(circle at 50% 40%, rgba(34,230,255,0.05), transparent 70%)'
      }} />

      {/* Room hot-spots */}
      {rooms.map(r => (
        <RoomOverlay key={r.name} room={r} />
      ))}
    </div>
  );
}

function RoomOverlay({ room }) {
  const { x, y, w, h, status } = room;
  const hasData = status.hasData;
  const alarm = status.motion || status.openContact;
  return (
    <div
      className={[
        'absolute rounded transition-all',
        hasData ? 'border-2' : 'border border-dashed',
        alarm ? 'border-nx-red/70 bg-nx-red/10 animate-pulseGlow'
              : hasData ? 'border-nx-cyan/55 bg-nx-cyan/8'
                        : 'border-nx-mute/30 bg-transparent'
      ].join(' ')}
      style={{
        left: `${x}%`, top: `${y}%`,
        width: `${w}%`, height: `${h}%`
      }}
      role="img"
      aria-label={`${room.name}: ${status.summary}`}
    >
      {hasData && (
        <div className="absolute inset-x-0 top-0 -translate-y-full mb-1 flex justify-center">
          <div className={[
            'rounded border bg-nx-bg/90 backdrop-blur-sm px-1.5 py-0.5 shadow-glow-soft text-[9px] font-mono leading-tight whitespace-nowrap',
            alarm ? 'border-nx-red/55' : 'border-nx-cyan/45'
          ].join(' ')}>
            <span className="text-nx-mute tracking-[0.18em] uppercase">{room.name}</span>
            {status.temp != null && <span className="ml-1.5 text-nx-cyan">{status.temp.toFixed(1)}°</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function RoomStatusCard({ room }) {
  const s = room.status;
  return (
    <div className={[
      'panel p-2 text-xs',
      (s.motion || s.openContact) ? 'border-nx-red/40' : ''
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-nx-mute truncate">{room.name}</span>
        {s.temp != null && <span className="font-mono text-nx-cyan">{s.temp.toFixed(1)}°</span>}
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
        {s.locks > 0 && (
          <span className={s.locked === s.locks ? 'text-nx-green' : 'text-nx-amber'}>
            {s.locked === s.locks ? <Lock size={10} className="inline" /> : <Unlock size={10} className="inline" />}
            {' '}{s.locked}/{s.locks}
          </span>
        )}
        {s.cameras > 0 && (
          <span className={s.motion ? 'text-nx-red' : 'text-nx-mute'}>
            <CameraIcon size={10} className="inline" /> {s.cameras}
          </span>
        )}
        {s.openContact > 0 && (
          <span className="text-nx-amber"><DoorOpen size={10} className="inline" /> {s.openContact}</span>
        )}
        {s.deviceCount > 0 && !s.temp && !s.locks && !s.cameras && (
          <span className="text-nx-mute">{s.deviceCount} enh</span>
        )}
      </div>
    </div>
  );
}

function PlanPlaceholder({ plan }) {
  return (
    <div className="rounded-xl border border-dashed border-nx-line/60 bg-nx-panel/30 p-12 text-center">
      <Upload size={28} className="mx-auto text-nx-mute" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold">{plan.label}</p>
      <p className="mt-2 text-xs text-nx-mute max-w-md mx-auto leading-relaxed">
        Plantegning ikke lastet opp ennå. Lagre en JPG/PNG til <code className="font-mono text-nx-cyan">client/public/{plan.id}.jpg</code> i prosjektet ditt og angi rom-rektangler i <code className="font-mono text-nx-cyan">FloorPlanView.jsx</code> &rarr; <code className="font-mono text-nx-cyan">PLANS.{plan.id}.rooms</code>. Pin-overlays slår på automatisk når sensorer matches mot rom-navnet.
      </p>
    </div>
  );
}

/**
 * Aggregate sensor status for one room rectangle by matching against zone-name regex.
 */
function getRoomStatus(room, devices, zones) {
  const all = Object.values(devices || {});
  const matchingZones = Object.values(zones || {}).filter(z => room.match.test(z.name || ''));
  const zoneIds = new Set(matchingZones.map(z => z.id));
  const list = all.filter(d => zoneIds.has(d.zone));

  const temps = list.map(d => capValue(d, 'measure_temperature')).filter(t => Number.isFinite(t));
  const locks = list.filter(d => d.class === 'lock');
  const cams  = list.filter(d => d.class === 'camera');

  return {
    deviceCount: list.length,
    hasData: list.length > 0,
    temp: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
    locks: locks.length,
    locked: locks.filter(d => capValue(d, 'locked') === true).length,
    cameras: cams.length,
    motion: list.filter(d => capValue(d, 'alarm_motion') === true).length,
    openContact: list.filter(d => hasCap(d, 'alarm_contact') && capValue(d, 'alarm_contact') === true).length,
    summary: list.length ? `${list.length} enheter` : 'Ingen enheter koblet'
  };
}
