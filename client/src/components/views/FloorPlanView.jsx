import { useMemo, useState, useEffect, useRef } from 'react';
import { Home as HomeIcon, Anchor, Building2, Upload, Lock, Unlock, Camera as CameraIcon, DoorOpen, FileSpreadsheet, ZoomIn, ZoomOut, Thermometer, ShieldAlert, Lightbulb, Layers, Edit2, Plus } from 'lucide-react';
import { capValue, hasCap, classLabel } from '../../lib/deviceUtils.js';
import { FloorPlanPin } from '../FloorPlanPin.jsx';

/**
 * Floor plan visualisation. Reads plantegninger from /public/* and lets the
 * user toggle between hytta (Halsaneset) and huset (Hunstein 48c).
 *
 * Pin coordinates are tuned to match the actual room rectangles in each plan.
 */
const PLAN_VERSION = '3';

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
  homeBasement: {
    id: 'homeBasement',
    location: 'home',
    label: 'Hus · Kjeller',
    image: `/home-floor-basement.jpg?v=${PLAN_VERSION}`,
    rooms: [
      { name: 'KINO',          match: /kino/i,                 x: 17, y: 32, w: 12, h: 12 },
      { name: 'SVØMMEBASSENG', match: /basseng$/i,             x: 22, y: 52, w: 22, h: 16 },
      { name: 'BASSENGBAD',    match: /baderom|bassengbad/i,   x: 16, y: 72, w: 8,  h: 9  },
      { name: 'SPORTSBOD',     match: /bod|sport/i,            x: 27, y: 70, w: 10, h: 8  },
      { name: 'KONTOR',        match: /kontor|teknisk/i,       x: 35, y: 33, w: 7,  h: 6  },
      { name: 'BAD',           match: /^bad$|baderom/i,        x: 39, y: 42, w: 5,  h: 5  },
      { name: 'SOVEROM 1',     match: /soverom 1|hybel/i,      x: 36, y: 47, w: 11, h: 8  },
      { name: 'SOVEROM 2',     match: /soverom 2/i,            x: 47, y: 38, w: 12, h: 9  },
      { name: 'TRENINGSROM',   match: /trening/i,              x: 50, y: 50, w: 12, h: 10 },
      { name: 'ENTRÉ',         match: /entr/i,                 x: 56, y: 70, w: 12, h: 8  }
    ]
  },
  homeFloor1: {
    id: 'homeFloor1',
    location: 'home',
    label: 'Hus · 1. etasje',
    image: `/home-floor-1.jpg?v=${PLAN_VERSION}`,
    rooms: [
      { name: 'GARASJE',       match: /garasje/i,                       x: 22, y: 28, w: 22, h: 18 },
      { name: 'BOD/SLUSE',     match: /^bod$|sluse/i,                   x: 41, y: 32, w: 8,  h: 7  },
      { name: 'GANG',          match: /^gang$/i,                        x: 41, y: 22, w: 6,  h: 8  },
      { name: 'WC',            match: /wc/i,                            x: 41, y: 16, w: 6,  h: 5  },
      { name: 'BAD',           match: /^bad$|baderom/i,                 x: 47, y: 16, w: 8,  h: 8  },
      { name: 'VASKEROM',      match: /vaskerom/i,                      x: 47, y: 24, w: 7,  h: 7  },
      { name: 'WALK-IN/BOD',   match: /walk|walk-?in/i,                 x: 55, y: 22, w: 8,  h: 8  },
      { name: 'SOVEROM 3',     match: /hovedsoverom|soverom 3/i,        x: 64, y: 18, w: 13, h: 11 },
      { name: 'KJØKKEN/STUE',  match: /kj.kken|^stue$|hovedetasjen/i,   x: 50, y: 41, w: 26, h: 20 },
      { name: 'TERRASSE',      match: /terasse|terrasse/i,              x: 78, y: 28, w: 10, h: 22 }
    ]
  },
  homeFloor2: {
    id: 'homeFloor2',
    location: 'home',
    label: 'Hus · 2. etasje',
    image: `/home-floor-2.jpg?v=${PLAN_VERSION}`,
    rooms: [
      { name: 'VINTERHAGE',     match: /vinter|loft/i,             x: 17, y: 32, w: 22, h: 22 },
      { name: 'SOVEROM 6 / VENDELA',  match: /vendela|soverom 6/i, x: 40, y: 28, w: 9,  h: 12 },
      { name: 'SOVEROM 4 / ANDREA',   match: /andrea|soverom 4/i,  x: 49, y: 28, w: 9,  h: 12 },
      { name: 'BAD',            match: /baderom|^bad$/i,           x: 38, y: 47, w: 8,  h: 7  },
      { name: 'GANG/TRAPP',     match: /gang|entr|trapp/i,         x: 46, y: 47, w: 6,  h: 9  },
      { name: 'SOVEROM 5 / YLVA / TV-STUE', match: /ylva|soverom 5|tv/i, x: 46, y: 56, w: 12, h: 10 },
      { name: 'TERRASSE SJØSIDE', match: /terasse.*sj|sj.side/i,   x: 60, y: 32, w: 12, h: 22 }
    ]
  },
  homeRomskjerma: {
    id: 'homeRomskjerma',
    location: 'home',
    label: 'Hus · Romskjerma',
    image: `/home-romskjerma.jpg?v=${PLAN_VERSION}`,
    kind: 'reference',
    rooms: []
  }
};

const VIEW_MODES = [
  { id: 'all',      label: 'Alle',         Icon: Layers },
  { id: 'temp',     label: 'Temperatur',   Icon: Thermometer },
  { id: 'security', label: 'Sikkerhet',    Icon: ShieldAlert },
  { id: 'light',    label: 'Lys',          Icon: Lightbulb }
];

export function FloorPlanView({ devices, zones, location = 'home', floorPlanPins, onSetCapability }) {
  // Velg første tilgjengelige plan for denne lokasjonen som default
  const plansForLocation = useMemo(
    () => Object.values(PLANS).filter(p => p.location === location),
    [location]
  );
  const [planId, setPlanId] = useState(plansForLocation[0]?.id || 'cabinMain');
  const [viewMode, setViewMode] = useState('all');
  const [editing, setEditing] = useState(false);
  // Auto-genererte rom-overlays (de hardkodede rektangelene fra PLANS[].rooms)
  // er som standard SKRUDD AV nå som plantegningene er croppet — koordinatene
  // er ikke lenger riktige. Brukeren kan slå dem på igjen via toggle om ønsket.
  const [showAutoRooms, setShowAutoRooms] = useState(false);

  // Sync default når location bytter (bruker navigerer mellom hus/hytte i sidebar)
  useEffect(() => {
    if (!plansForLocation.find(p => p.id === planId)) {
      setPlanId(plansForLocation[0]?.id || 'cabinMain');
    }
  }, [plansForLocation, planId]);

  const plan = PLANS[planId] || plansForLocation[0];
  if (!plan) return null;

  const roomData = useMemo(
    () => plan.rooms.map(r => ({ ...r, status: getRoomStatus(r, devices, zones, viewMode) })),
    [plan, devices, zones, viewMode]
  );

  const locationLabel = location === 'cabin' ? 'Hytte · Halsaneset' : 'Hus · Hunstein 48c';

  return (
    <div>
      <header className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 className="panel-title">Plantegning</h2>
          <p className="mt-1 text-xl font-semibold">{locationLabel}</p>
          <p className="mt-0.5 text-xs text-nx-mute font-mono">{plan.label}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {plansForLocation.map(t => {
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

      {/* View-mode filter + edit-toggle — gjelder ikke for romskjerma-referanse */}
      {plan.kind !== 'reference' && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {VIEW_MODES.map(m => {
            const active = viewMode === m.id;
            const Icon = m.Icon;
            return (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id)}
                aria-pressed={active}
                className={[
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] transition-colors',
                  active ? 'bg-nx-cyan/15 text-nx-cyan shadow-glow-soft' : 'text-nx-mute hover:text-nx-text hover:bg-nx-panel/60'
                ].join(' ')}
              >
                <Icon size={11} aria-hidden="true" />
                {m.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setShowAutoRooms(s => !s)}
              aria-pressed={showAutoRooms}
              title="Vis/skjul auto-genererte rom-rektangler (kan være feilplassert)"
              className={[
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] transition-colors border',
                showAutoRooms
                  ? 'bg-nx-cyan/15 text-nx-cyan border-nx-cyan/55'
                  : 'border-nx-line/60 text-nx-mute hover:text-nx-text hover:border-nx-cyan/40'
              ].join(' ')}
            >
              {showAutoRooms ? 'Skjul auto-rom' : 'Vis auto-rom'}
            </button>
            {floorPlanPins && (
              <button
                onClick={() => setEditing(e => !e)}
                aria-pressed={editing}
                className={[
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] transition-colors border',
                  editing
                    ? 'bg-nx-cyan/15 text-nx-cyan border-nx-cyan/55 shadow-glow-soft'
                    : 'border-nx-line/60 text-nx-mute hover:text-nx-text hover:border-nx-cyan/40'
                ].join(' ')}
              >
                <Edit2 size={11} aria-hidden="true" />
                {editing ? 'Ferdig' : 'Rediger pins'}
              </button>
            )}
          </div>
        </div>
      )}

      {!plan.image
        ? <PlanPlaceholder plan={plan} />
        : plan.kind === 'reference'
          ? <ReferenceImage plan={plan} />
          : <FloorPlanCanvas
              plan={plan}
              rooms={roomData}
              showAutoRooms={showAutoRooms}
              pins={floorPlanPins?.getPins(plan.id) || []}
              devices={devices}
              zones={zones}
              editing={editing}
              floorPlanPins={floorPlanPins}
              onSetCapability={onSetCapability}
            />
      }

      {/* Add-pin verktøylinje når man er i edit-modus */}
      {editing && plan.kind !== 'reference' && floorPlanPins && (
        <AddPinPanel
          planId={plan.id}
          devices={devices}
          zones={zones}
          existingPins={floorPlanPins.getPins(plan.id)}
          onAdd={(pin) => floorPlanPins.addPin(plan.id, pin)}
          onResetPlan={() => {
            if (confirm('Fjerne ALLE pins fra denne plantegninga?')) {
              floorPlanPins.resetPlan(plan.id);
            }
          }}
        />
      )}

      {plan.image && plan.kind !== 'reference' && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {roomData.filter(r => r.status.hasData && r.status.matchesView !== false).map(r => (
            <RoomStatusCard key={r.name} room={r} viewMode={viewMode} />
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
      <div className="rounded-xl border border-nx-line/60 bg-nx-bg overflow-auto max-h-[80vh]">
        <img
          src={plan.image}
          alt={plan.label}
          loading="lazy"
          decoding="async"
          style={{
            width: `${zoom * 100}%`,
            maxWidth: 'none',
            filter: 'invert(1) hue-rotate(180deg) brightness(0.95) contrast(1.1) saturate(1.15)'
          }}
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

function FloorPlanCanvas({ plan, rooms, showAutoRooms = false, pins, devices, zones, editing, floorPlanPins, onSetCapability }) {
  const containerRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);

  // Drag-håndtering for pins når man er i edit-modus (pointer events for touch+mus)
  useEffect(() => {
    if (!draggingId) return;
    const move = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      if (cx == null || cy == null) return;
      const x = Math.max(0, Math.min(100, ((cx - rect.left) / rect.width)  * 100));
      const y = Math.max(0, Math.min(100, ((cy - rect.top)  / rect.height) * 100));
      floorPlanPins?.updatePin(plan.id, draggingId, { x, y });
    };
    const up = () => setDraggingId(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [draggingId, plan.id, floorPlanPins]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-nx-line/60 bg-nx-bg"
      style={{
        height: 'calc(100vh - 320px)',
        minHeight: '480px',
        maxHeight: '880px',
        touchAction: editing ? 'none' : undefined
      }}
    >
      <img
        src={plan.image}
        alt={plan.label}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain"
        style={{
          filter: 'invert(1) hue-rotate(180deg) brightness(0.95) contrast(1.1) saturate(1.15)'
        }}
        draggable={false}
      />

      {/* Sci-fi grid overlay */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid bg-[size:32px_32px] opacity-[0.12] mix-blend-screen" />

      {/* Cyan radial tint */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
        background: 'radial-gradient(circle at 50% 40%, rgba(34,230,255,0.10), transparent 70%)'
      }} />

      {/* Sweep-linje for sci-fi-stemning */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -inset-x-10 h-32 bg-gradient-to-b from-transparent via-nx-cyan/8 to-transparent animate-scan" />
      </div>

      {/* Hjørne-brackets */}
      <Brackets />

      {/* Room hot-spots (auto-genererte rektangler) — kun hvis togglet på */}
      {showAutoRooms && rooms.filter(r => r.status.matchesView !== false).map(r => (
        <RoomOverlay key={r.name} room={r} />
      ))}

      {/* Brukerens egne device-pins */}
      {pins.map(pin => (
        <FloorPlanPin
          key={pin.id}
          pin={pin}
          device={devices?.[pin.deviceId]}
          editing={editing}
          isDragging={draggingId === pin.id}
          onMoveStart={(id) => setDraggingId(id)}
          onUpdate={(patch) => floorPlanPins?.updatePin(plan.id, pin.id, patch)}
          onRemove={() => floorPlanPins?.removePin(plan.id, pin.id)}
          onSet={onSetCapability}
        />
      ))}
    </div>
  );
}

function AddPinPanel({ planId, devices, zones, existingPins, onAdd, onResetPlan }) {
  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');

  const groups = useMemo(() => {
    const byZone = {};
    Object.values(devices || {}).forEach(d => {
      const zoneName = zones?.[d.zone]?.name || 'Uten sone';
      if (!byZone[zoneName]) byZone[zoneName] = [];
      byZone[zoneName].push(d);
    });
    Object.values(byZone).forEach(arr => arr.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    return Object.entries(byZone).sort((a, b) => a[0].localeCompare(b[0]));
  }, [devices, zones]);

  const handleAdd = () => {
    if (!deviceId) return;
    onAdd({ deviceId, label: label.trim() });
    setDeviceId(''); setLabel('');
  };

  return (
    <div className="mt-3 panel p-3 border border-nx-cyan/30">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="panel-title">Legg til enhet på plantegning ({existingPins.length} plassert)</p>
        <button
          type="button"
          onClick={onResetPlan}
          className="text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute hover:text-nx-red"
          title="Fjern alle pins fra denne plantegninga"
        >
          Tøm alt
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          className="flex-1 min-w-[220px] bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-text font-mono"
        >
          <option value="">— velg enhet —</option>
          {groups.map(([zoneName, devs]) => (
            <optgroup key={zoneName} label={zoneName}>
              {devs.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name || '(uten navn)'} · {classLabel(d.class)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="kort label (valgfri)"
          className="w-40 bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-text font-mono"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!deviceId}
          className={[
            'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-[0.16em] transition-colors',
            deviceId ? 'bg-nx-cyan/15 text-nx-cyan hover:bg-nx-cyan/25' : 'text-nx-mute opacity-50 cursor-not-allowed'
          ].join(' ')}
        >
          <Plus size={12} /> Legg til
        </button>
      </div>
      <p className="mt-2 text-[10px] text-nx-mute">
        Pin-en plasseres på midten av plantegninga — dra den til riktig posisjon. Lagres umiddelbart.
      </p>
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
              : hasData ? 'border-nx-cyan/55 bg-nx-cyan/10'
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
            'rounded border bg-nx-bg/90 backdrop-blur-sm px-1.5 py-0.5 shadow-glow-soft text-[9px] font-mono leading-tight whitespace-nowrap flex items-center gap-1',
            alarm ? 'border-nx-red/55' : 'border-nx-cyan/45'
          ].join(' ')}>
            <span className="text-nx-mute tracking-[0.18em] uppercase">{room.name}</span>
            {status.temp != null && <span className="text-nx-cyan">{status.temp.toFixed(1)}°</span>}
            {status.locks > 0 && (
              status.locked === status.locks
                ? <Lock size={9} className="text-nx-green" />
                : <Unlock size={9} className="text-nx-amber" />
            )}
            {status.openContact > 0 && <DoorOpen size={9} className="text-nx-amber" />}
            {status.motion > 0 && <span className="text-nx-red">●</span>}
            {status.lights > 0 && (
              <span className={status.lightsOn ? 'text-nx-amber' : 'text-nx-mute'}>
                <Lightbulb size={9} className="inline" /> {status.lightsOn}/{status.lights}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoomStatusCard({ room, viewMode = 'all' }) {
  const s = room.status;
  // Hva som vises i kortet styres av viewMode
  const showTemp     = viewMode === 'all' || viewMode === 'temp';
  const showSecurity = viewMode === 'all' || viewMode === 'security';
  const showLight    = viewMode === 'all' || viewMode === 'light';

  return (
    <div className={[
      'panel p-2 text-xs',
      (showSecurity && (s.motion || s.openContact)) ? 'border-nx-red/40' : ''
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-nx-mute truncate">{room.name}</span>
        {showTemp && s.temp != null && <span className="font-mono text-nx-cyan">{s.temp.toFixed(1)}°</span>}
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
        {showSecurity && s.locks > 0 && (
          <span className={s.locked === s.locks ? 'text-nx-green' : 'text-nx-amber'}>
            {s.locked === s.locks ? <Lock size={10} className="inline" /> : <Unlock size={10} className="inline" />}
            {' '}{s.locked}/{s.locks}
          </span>
        )}
        {showSecurity && s.cameras > 0 && (
          <span className={s.motion ? 'text-nx-red' : 'text-nx-mute'}>
            <CameraIcon size={10} className="inline" /> {s.cameras}
          </span>
        )}
        {showSecurity && s.openContact > 0 && (
          <span className="text-nx-amber"><DoorOpen size={10} className="inline" /> {s.openContact}</span>
        )}
        {showSecurity && s.motion > 0 && (
          <span className="text-nx-red">● bevegelse</span>
        )}
        {showLight && s.lights > 0 && (
          <span className={s.lightsOn ? 'text-nx-amber' : 'text-nx-mute'}>
            <Lightbulb size={10} className="inline" /> {s.lightsOn}/{s.lights}
          </span>
        )}
        {viewMode === 'all' && s.deviceCount > 0 && !s.temp && !s.locks && !s.cameras && !s.lights && (
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
 * `viewMode` påvirker `matchesView` — om dette rommet skal vises i gjeldende
 * filter (Temperatur / Sikkerhet / Lys / Alle).
 */
function getRoomStatus(room, devices, zones, viewMode = 'all') {
  const all = Object.values(devices || {});
  const matchingZones = Object.values(zones || {}).filter(z => room.match.test(z.name || ''));
  const zoneIds = new Set(matchingZones.map(z => z.id));
  const list = all.filter(d => zoneIds.has(d.zone));

  const temps = list.map(d => capValue(d, 'measure_temperature')).filter(t => Number.isFinite(t));
  const locks = list.filter(d => d.class === 'lock');
  const cams  = list.filter(d => d.class === 'camera');
  const lights = list.filter(d => d.class === 'light' || hasCap(d, 'dim'));
  const lightsOn = lights.filter(d => capValue(d, 'onoff') === true).length;
  const motionCount = list.filter(d => capValue(d, 'alarm_motion') === true).length;
  const openContactCount = list.filter(d => hasCap(d, 'alarm_contact') && capValue(d, 'alarm_contact') === true).length;
  const contactDevices = list.filter(d => hasCap(d, 'alarm_contact')).length;
  const motionDevices = list.filter(d => hasCap(d, 'alarm_motion')).length;

  // matchesView avgjør om rommet vises i gjeldende view-mode
  const hasTemp     = temps.length > 0;
  const hasSecurity = locks.length > 0 || cams.length > 0 || motionDevices > 0 || contactDevices > 0;
  const hasLight    = lights.length > 0;
  const matchesView = viewMode === 'all'
    || (viewMode === 'temp'     && hasTemp)
    || (viewMode === 'security' && hasSecurity)
    || (viewMode === 'light'    && hasLight);

  return {
    deviceCount: list.length,
    hasData: list.length > 0,
    matchesView,
    temp: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
    locks: locks.length,
    locked: locks.filter(d => capValue(d, 'locked') === true).length,
    cameras: cams.length,
    motion: motionCount,
    openContact: openContactCount,
    lights: lights.length,
    lightsOn,
    summary: list.length ? `${list.length} enheter` : 'Ingen enheter koblet'
  };
}
