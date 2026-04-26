import { useMemo, useState, useEffect, useRef } from 'react';
import { Home as HomeIcon, Anchor, Building2, Upload, FileSpreadsheet, ZoomIn, ZoomOut, Thermometer, ShieldAlert, Lightbulb, Layers, Edit2, Plus, Wifi, Cpu, Music, Save, Check, AlertCircle, Loader } from 'lucide-react';
import { hasCap } from '../../lib/deviceUtils.js';
import { FloorPlanPin } from '../FloorPlanPin.jsx';
import { RichDevicePicker } from '../RichDevicePicker.jsx';
import { FloorPlanFlowsPanel } from '../FloorPlanFlowsPanel.jsx';

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
  { id: 'light',    label: 'Lys',          Icon: Lightbulb },
  { id: 'music',    label: 'Musikk',       Icon: Music },
  { id: 'wifi',     label: 'Wifi',         Icon: Wifi },
  { id: 'tech',     label: 'Teknisk',      Icon: Cpu }
];

// Kategori-listen for pins (uten 'all' siden alle pins per definisjon
// vises i 'all'-fanen).
export const PIN_CATEGORIES = VIEW_MODES.filter(m => m.id !== 'all');

/**
 * "Teknisk" = enheter som ikke faller naturlig inn under lys, sikkerhet eller
 * rene temperaturmålere. Speakere, TV, stikkontakter, vifter, varmere,
 * støvsugere, gardiner, EV-ladere, termostater, røykvarslere som også gjør
 * mer enn alarm, osv.
 */
function isTechnicalDevice(d) {
  if (!d) return false;
  const isLight = d.class === 'light' || hasCap(d, 'dim');
  const isSecurity = d.class === 'lock' || d.class === 'camera'
    || hasCap(d, 'alarm_motion') || hasCap(d, 'alarm_contact')
    || hasCap(d, 'alarm_smoke')  || hasCap(d, 'alarm_water');
  // Rent temperaturmåler-only-sensor — uten ekstra capabilities
  const caps = (d.capabilities && Array.isArray(d.capabilities)) ? d.capabilities
              : d.capabilities ? Object.keys(d.capabilities)
              : d.capabilitiesObj ? Object.keys(d.capabilitiesObj) : [];
  const isTempOnly = caps.length <= 2
    && hasCap(d, 'measure_temperature')
    && !hasCap(d, 'onoff') && !hasCap(d, 'target_temperature');
  return !isLight && !isSecurity && !isTempOnly;
}

/**
 * Auto-kategoriser en enhet i én eksklusiv kategori. Brukes som default
 * når en pin ikke har eksplisitt category. Prioritert rekkefølge slik at
 * f.eks. Hue-lampe → 'light' (ikke 'wifi') og Sonos-høyttaler → 'music'.
 */
function autoCategoryFor(d) {
  if (!d) return 'tech';
  if (d.class === 'light' || hasCap(d, 'dim')) return 'light';
  if (d.class === 'lock' || d.class === 'camera') return 'security';
  if (hasCap(d, 'alarm_motion') || hasCap(d, 'alarm_contact')
   || hasCap(d, 'alarm_smoke')  || hasCap(d, 'alarm_water')) return 'security';
  if (d.class === 'speaker' || d.class === 'tv'
   || hasCap(d, 'speaker_playing') || hasCap(d, 'volume_set')) return 'music';
  if (hasCap(d, 'target_temperature') || hasCap(d, 'measure_temperature')) return 'temp';
  if (isWifiDevice(d)) return 'wifi';
  return 'tech';
}

/**
 * Avgjør om en pin tilhører gjeldende view-mode. Brukerens eksplisitte
 * pin.category vinner — hvis pin ble lagt til på Wifi-fanen, vises den
 * KUN i Wifi-fanen, uavhengig av enhetens type. 'auto' faller tilbake til
 * autoCategoryFor.
 */
function pinMatchesViewMode(device, viewMode, pin) {
  if (viewMode === 'all') return true;
  const cat = (pin?.category && pin.category !== 'auto') ? pin.category : autoCategoryFor(device);
  return cat === viewMode;
}

// Heuristikk for wifi-enheter: Homey-flags + kjente wifi/cloud-driver-mønstre.
// Fanger Sonos, Hue, TP-Link, Shelly, Tuya, Meross, Sonoff, Tesla, Roborock,
// Tibber, Nest, Ring, Arlo, Withings, Netatmo, Mill, Husqvarna automower osv.
const WIFI_DRIVER_RE = /(wifi|sonos|hue|tplink|shelly|tuya|meross|sonoff|esphome|tesla|roborock|tibber|nest|ring|arlo|withings|netatmo|mill|automower|husqvarna|ecobee|netgear|broadlink|yeelight|plejd|airthings|bambu)/i;

function isWifiDevice(d) {
  if (!d) return false;
  if (Array.isArray(d.flags) && d.flags.some(f => /wifi|cloud/i.test(f))) return true;
  if (typeof d.driverUri === 'string' && WIFI_DRIVER_RE.test(d.driverUri)) return true;
  if (typeof d.driverId === 'string' && WIFI_DRIVER_RE.test(d.driverId)) return true;
  return false;
}

export function FloorPlanView({ devices, zones, location = 'home', floorPlanPins, planFlows, flows, onRunFlow, onSetCapability }) {
  // Velg første tilgjengelige plan for denne lokasjonen som default
  const plansForLocation = useMemo(
    () => Object.values(PLANS).filter(p => p.location === location),
    [location]
  );
  const [planId, setPlanId] = useState(plansForLocation[0]?.id || 'cabinMain');
  const [viewMode, setViewMode] = useState('all');
  const [editing, setEditing] = useState(false);

  // Sync default når location bytter (bruker navigerer mellom hus/hytte i sidebar)
  useEffect(() => {
    if (!plansForLocation.find(p => p.id === planId)) {
      setPlanId(plansForLocation[0]?.id || 'cabinMain');
    }
  }, [plansForLocation, planId]);

  const plan = PLANS[planId] || plansForLocation[0];
  if (!plan) return null;

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
          {floorPlanPins && (
            <div className="ml-auto flex items-center gap-1.5">
              <SaveButton sync={floorPlanPins.sync} />
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
            </div>
          )}
        </div>
      )}

      {!plan.image
        ? <PlanPlaceholder plan={plan} />
        : plan.kind === 'reference'
          ? <ReferenceImage plan={plan} />
          : (
            <div className="flex flex-col xl:flex-row gap-3 items-stretch">
              <div className="flex-1 min-w-0">
                <FloorPlanCanvas
                  plan={plan}
                  pins={floorPlanPins?.getPins(plan.id) || []}
                  devices={devices}
                  zones={zones}
                  editing={editing}
                  viewMode={viewMode}
                  floorPlanPins={floorPlanPins}
                  onSetCapability={onSetCapability}
                />
              </div>
              {planFlows && (
                <FloorPlanFlowsPanel
                  planId={plan.id}
                  planLabel={plan.label}
                  flows={flows}
                  planFlows={planFlows}
                  onRun={onRunFlow}
                  editing={editing}
                />
              )}
            </div>
          )
      }

      {/* Add-pin verktøylinje når man er i edit-modus */}
      {editing && plan.kind !== 'reference' && floorPlanPins && (
        <AddPinPanel
          planId={plan.id}
          devices={devices}
          zones={zones}
          viewMode={viewMode}
          existingPins={floorPlanPins.getPins(plan.id).filter(p =>
            pinMatchesViewMode(devices?.[p.deviceId], viewMode, p)
          )}
          onAdd={(pin) => floorPlanPins.addPin(plan.id, pin)}
          onResetPlan={() => {
            if (confirm(`Fjerne alle pins i ${VIEW_MODES.find(m => m.id === viewMode)?.label || 'denne'}-fanen?`)) {
              const idsToRemove = floorPlanPins.getPins(plan.id)
                .filter(p => pinMatchesViewMode(devices?.[p.deviceId], viewMode, p))
                .map(p => p.id);
              idsToRemove.forEach(id => floorPlanPins.removePin(plan.id, id));
            }
          }}
        />
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

function FloorPlanCanvas({ plan, pins, devices, zones, editing, viewMode = 'all', floorPlanPins, onSetCapability }) {
  // Filtrer pins etter view-mode i BÅDE visning og edit. Da blir hver fane
  // ryddig — du ser kun pins som hører til den fanen du står på, og kan
  // legge til nye uten å bli forstyrret av pins fra andre kategorier.
  const visiblePins = pins.filter(p => pinMatchesViewMode(devices?.[p.deviceId], viewMode, p));
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

      {/* Brukerens egne device-pins, filtrert etter view-mode */}
      {visiblePins.map(pin => (
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

function AddPinPanel({ planId, devices, zones, viewMode = 'all', existingPins, onAdd, onResetPlan }) {
  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');

  const currentMode = VIEW_MODES.find(m => m.id === viewMode);

  const handleAdd = () => {
    if (!deviceId) return;
    // Hvis brukeren er på en spesifikk fane, fest pin-en til den fanen.
    // Hvis på 'Alle', la category være 'auto' så autoCategoryFor avgjør.
    const category = viewMode === 'all' ? 'auto' : viewMode;
    onAdd({ deviceId, label: label.trim(), category });
    setDeviceId(''); setLabel('');
  };

  return (
    <div className="mt-3 panel p-3 border border-nx-cyan/30">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="panel-title">
          Legg til på <span className="text-nx-cyan">{currentMode?.label || 'fanen'}</span>
          <span className="text-nx-mute font-normal ml-1">({existingPins.length} plassert)</span>
        </p>
        <button
          type="button"
          onClick={onResetPlan}
          className="text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute hover:text-nx-red"
          title={viewMode === 'all' ? 'Fjern ALLE pins fra denne plantegninga' : `Fjern pins i ${currentMode?.label}-fanen`}
        >
          Tøm fanen
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RichDevicePicker
          value={deviceId}
          onChange={setDeviceId}
          devices={devices}
          zones={zones}
          placeholder="— velg enhet —"
          className="flex-1 min-w-[260px]"
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="kort label (valgfri)"
          className="w-44 bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1.5 text-xs text-nx-text font-mono"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!deviceId}
          className={[
            'inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-[0.16em] transition-colors',
            deviceId ? 'bg-nx-cyan/15 text-nx-cyan hover:bg-nx-cyan/25' : 'text-nx-mute opacity-50 cursor-not-allowed'
          ].join(' ')}
        >
          <Plus size={12} /> Legg til
        </button>
      </div>
      <p className="mt-2 text-[10px] text-nx-mute">
        {viewMode === 'all'
          ? 'Pin-en plasseres på midten — dra til riktig sted. Pin-en auto-kategoriseres etter enhetens type.'
          : `Pin-en festes til ${currentMode?.label}-fanen. Vises ikke i andre faner. Dra til riktig sted.`}
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

/**
 * Eksplisitt 'Lagre til server'-knapp. Auto-save skjer 500ms etter siste
 * endring, men brukeren kan trykke denne for å tvinge fram et lagre nå og
 * få visuell bekreftelse på at det er gjort.
 *
 * Status-tilstander:
 *   normal    — "Lagre til server"
 *   saving    — "Lagrer..."  (med spinner)
 *   saved     — "Lagret ✓"   (i 2.5 sekunder etter vellykket save)
 *   error     — "Feil!"      (rød)
 */
function SaveButton({ sync }) {
  const { saving, lastSavedAt, error, flush } = sync || {};
  const [showSavedFor, setShowSavedFor] = useState(null);

  // Vis "Lagret ✓" kortvarig etter en save
  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSavedFor(lastSavedAt);
    const t = setTimeout(() => setShowSavedFor(null), 2500);
    return () => clearTimeout(t);
  }, [lastSavedAt]);

  const isJustSaved = showSavedFor === lastSavedAt && lastSavedAt;
  const tone = error ? 'red' : isJustSaved ? 'green' : 'cyan';

  let label = 'Lagre til server';
  let Icon = Save;
  if (saving) { label = 'Lagrer...'; Icon = Loader; }
  else if (isJustSaved) { label = 'Lagret'; Icon = Check; }
  else if (error) { label = 'Feil — prøv igjen'; Icon = AlertCircle; }

  const colorClass = tone === 'red'
    ? 'border-nx-red/55 text-nx-red bg-nx-red/10'
    : tone === 'green'
    ? 'border-nx-green/55 text-nx-green bg-nx-green/10'
    : 'border-nx-line/60 text-nx-mute hover:text-nx-cyan hover:border-nx-cyan/40';

  return (
    <button
      type="button"
      onClick={() => flush?.().catch(() => {})}
      disabled={saving}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] transition-colors border',
        colorClass,
        saving ? 'opacity-70 cursor-wait' : ''
      ].join(' ')}
      title={error ? `Feil: ${error.message || 'ukjent'}` : 'Tving lagring til server nå'}
    >
      <Icon size={11} aria-hidden="true" className={saving ? 'animate-spin' : ''} />
      {label}
    </button>
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

