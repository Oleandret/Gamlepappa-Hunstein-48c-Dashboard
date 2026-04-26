import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Home as HomeIcon, Anchor, Plus, Trash2, RotateCcw, ArrowUp, ArrowDown,
  ArrowLeft, ArrowRight, Car, Sun, Flame, MapPin, Box as BoxIcon
} from 'lucide-react';
import { VIEWS } from './HouseView.jsx';

/**
 * Editor for pin-konfig på framsidens hovedbilder.
 * - Tabs for Hjem / Hytte
 * - Forhåndsvisning av bildet med pinene oppå (dra-og-slipp for å plassere)
 * - Pin-liste med kind/detaljer/placement-syklus/slett
 * - Legg-til-knapper for alle pin-typer
 */
const KIND_LABELS = {
  zone:        { label: 'Sone (hjem)',     Icon: BoxIcon  },
  cabinZone:   { label: 'Sone (hytte)',    Icon: BoxIcon  },
  cabinDevice: { label: 'Hytte-enhet',     Icon: BoxIcon  },
  tesla:       { label: 'Tesla',           Icon: Car      },
  solar:       { label: 'Solceller',       Icon: Sun      },
  sauna:       { label: 'Sauna',           Icon: Flame    },
  pier:        { label: 'Brygge',          Icon: Anchor   },
  boathouse:   { label: 'Båthus',          Icon: Anchor   }
};

const PLACEMENTS = ['top', 'right', 'bottom', 'left'];
const PLACEMENT_ICON = { top: ArrowUp, right: ArrowRight, bottom: ArrowDown, left: ArrowLeft };

export function PinEditor({ pinConfig, devices = {}, zones = {} }) {
  const [location, setLocation] = useState('home');
  const list = pinConfig.config[location] || [];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="panel-title">Sensorer på framsiden</p>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Tilbakestille ${location === 'home' ? 'Hjem' : 'Hytte'} til standard?`)) {
              pinConfig.reset(location);
            }
          }}
          className="text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute hover:text-nx-cyan flex items-center gap-1"
          title="Tilbakestill denne lokasjonen til default-pinene"
        >
          <RotateCcw size={11} /> Standard
        </button>
      </div>

      {/* Tabs: Hjem / Hytte */}
      <div className="flex gap-1 p-0.5 rounded-lg border border-nx-line/60 bg-nx-panel/40 w-fit mb-3">
        <TabButton active={location === 'home'}  onClick={() => setLocation('home')}  Icon={HomeIcon} label="Hjem" />
        <TabButton active={location === 'cabin'} onClick={() => setLocation('cabin')} Icon={Anchor}   label="Hytte" />
      </div>

      <p className="text-xs text-nx-mute mb-2">
        Dra pinene direkte på bildet for å flytte dem. Klikk pilen i lista for å rotere hvilken side label-en flyter på.
      </p>

      <PreviewWithPins
        location={location}
        pins={list}
        onMove={(id, x, y) => pinConfig.updatePin(location, id, { x, y })}
      />

      <PinList
        location={location}
        pins={list}
        zones={zones}
        devices={devices}
        onCyclePlacement={(id) => {
          const p = list.find(p => p.id === id);
          if (!p) return;
          const next = PLACEMENTS[(PLACEMENTS.indexOf(p.placement || 'top') + 1) % PLACEMENTS.length];
          pinConfig.updatePin(location, id, { placement: next });
        }}
        onUpdate={(id, patch) => pinConfig.updatePin(location, id, patch)}
        onRemove={(id) => pinConfig.removePin(location, id)}
      />

      <AddPinForm
        location={location}
        zones={zones}
        devices={devices}
        onAdd={(pin) => pinConfig.addPin(location, pin)}
      />
    </div>
  );
}

function TabButton({ active, onClick, Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono uppercase tracking-[0.18em] transition-colors',
        active ? 'bg-nx-cyan/15 text-nx-cyan shadow-glow-soft' : 'text-nx-mute hover:text-nx-text'
      ].join(' ')}
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </button>
  );
}

function PreviewWithPins({ location, pins, onMove }) {
  const containerRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const view = VIEWS[location];

  // Pointer-baserte drag-events for å støtte både mus og touch
  useEffect(() => {
    if (!draggingId) return;

    const move = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      if (clientX == null || clientY == null) return;
      const x = ((clientX - rect.left) / rect.width)  * 100;
      const y = ((clientY - rect.top)  / rect.height) * 100;
      onMove(draggingId, clamp(x), clamp(y));
    };
    const up = () => setDraggingId(null);

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup',   up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup',   up);
      window.removeEventListener('pointercancel', up);
    };
  }, [draggingId, onMove]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-nx-line/60 bg-nx-bg select-none"
      style={{ touchAction: 'none' }}
    >
      <img
        src={view.image}
        alt={view.address}
        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        draggable={false}
      />
      <div className="absolute inset-0 bg-grid bg-[size:32px_32px] opacity-15 mix-blend-screen pointer-events-none" />

      {pins.map((p) => (
        <EditorPin
          key={p.id}
          pin={p}
          dragging={draggingId === p.id}
          onPointerDown={(e) => {
            e.preventDefault();
            setDraggingId(p.id);
          }}
        />
      ))}
    </div>
  );
}

function EditorPin({ pin, dragging, onPointerDown }) {
  const meta = KIND_LABELS[pin.kind] || { label: pin.kind, Icon: MapPin };
  const Icon = meta.Icon;
  const labelText =
    pin.zoneName ||
    pin.label ||
    pin.deviceMatch ||
    meta.label;

  return (
    <div
      className="absolute cursor-grab active:cursor-grabbing"
      style={{
        left: `${pin.x}%`,
        top:  `${pin.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: dragging ? 10 : 1
      }}
      onPointerDown={onPointerDown}
      role="button"
      aria-label={`Flytt pin ${labelText}`}
    >
      <span aria-hidden="true" className={[
        'block h-3.5 w-3.5 rounded-full border-2 border-nx-bg shadow-[0_0_12px_rgba(34,230,255,0.9)]',
        dragging ? 'bg-nx-purple' : 'bg-nx-cyan'
      ].join(' ')} />
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-full -top-1 whitespace-nowrap rounded-md border border-nx-cyan/45 bg-nx-bg/85 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-mono text-nx-cyan flex items-center gap-1 pointer-events-none"
      >
        <Icon size={10} aria-hidden="true" />
        {labelText}
      </div>
    </div>
  );
}

function PinList({ location, pins, zones, devices, onCyclePlacement, onUpdate, onRemove }) {
  if (pins.length === 0) {
    return <p className="mt-3 text-xs text-nx-mute italic">Ingen pins for {location === 'home' ? 'Hjem' : 'Hytte'} ennå. Legg til under.</p>;
  }

  return (
    <ul className="mt-3 divide-y divide-nx-line/40 border border-nx-line/40 rounded-lg overflow-hidden">
      {pins.map((p) => {
        const meta = KIND_LABELS[p.kind] || { label: p.kind, Icon: MapPin };
        const PlacementIcon = PLACEMENT_ICON[p.placement || 'top'] || ArrowUp;
        return (
          <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-nx-panel/40">
            <meta.Icon size={12} className="text-nx-cyan shrink-0" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-nx-mute w-20 shrink-0 truncate">
              {meta.label}
            </span>
            <PinIdentField pin={p} zones={zones} devices={devices} onUpdate={(patch) => onUpdate(p.id, patch)} />
            <span className="font-mono text-[10px] text-nx-mute tabular-nums w-20 text-right shrink-0">
              {Math.round(p.x)}, {Math.round(p.y)}
            </span>
            <button
              type="button"
              onClick={() => onCyclePlacement(p.id)}
              className="p-1 rounded hover:bg-nx-cyan/10 text-nx-mute hover:text-nx-cyan"
              title={`Label-side: ${p.placement || 'top'} (klikk for å rotere)`}
              aria-label={`Endre label-side, nå ${p.placement || 'top'}`}
            >
              <PlacementIcon size={12} />
            </button>
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              className="p-1 rounded hover:bg-nx-red/10 text-nx-mute hover:text-nx-red"
              title="Fjern pin"
              aria-label="Fjern pin"
            >
              <Trash2 size={12} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Vis riktig identifier-input avhengig av pin-type */
function PinIdentField({ pin, zones, devices, onUpdate }) {
  const allZones = useMemo(() => Object.values(zones || {}), [zones]);

  if (pin.kind === 'zone' || pin.kind === 'cabinZone') {
    return (
      <select
        value={pin.zoneName || ''}
        onChange={(e) => onUpdate({ zoneName: e.target.value })}
        className="flex-1 min-w-0 bg-nx-panel/60 border border-nx-line/60 rounded px-1.5 py-0.5 text-xs text-nx-text font-mono"
      >
        <option value="">— velg sone —</option>
        {allZones.map(z => (
          <option key={z.id} value={z.name}>{z.name}</option>
        ))}
      </select>
    );
  }

  if (pin.kind === 'cabinDevice') {
    return (
      <div className="flex-1 min-w-0 flex gap-1">
        <input
          type="text"
          value={pin.deviceMatch || ''}
          onChange={(e) => onUpdate({ deviceMatch: e.target.value })}
          placeholder="enhetsnavn (regex)"
          className="flex-1 min-w-0 bg-nx-panel/60 border border-nx-line/60 rounded px-1.5 py-0.5 text-xs text-nx-text font-mono"
        />
        <input
          type="text"
          value={pin.label || ''}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="LABEL"
          className="w-20 bg-nx-panel/60 border border-nx-line/60 rounded px-1.5 py-0.5 text-xs text-nx-text font-mono uppercase"
        />
      </div>
    );
  }

  // tesla/solar/sauna/pier/boathouse — ingen identifier å redigere
  return <span className="flex-1 min-w-0 text-xs text-nx-mute italic truncate">— auto —</span>;
}

function AddPinForm({ location, zones, devices, onAdd }) {
  const [kind, setKind] = useState('zone');
  const [zoneName, setZoneName] = useState('');
  const [deviceMatch, setDeviceMatch] = useState('');
  const [label, setLabel] = useState('');

  const allZones = useMemo(() => Object.values(zones || {}), [zones]);

  const needsZone = kind === 'zone' || kind === 'cabinZone';
  const needsDevice = kind === 'cabinDevice';

  const canAdd = needsZone ? !!zoneName : needsDevice ? !!deviceMatch : true;

  const handleAdd = () => {
    if (!canAdd) return;
    const pin = { kind };
    if (needsZone) pin.zoneName = zoneName;
    if (needsDevice) {
      pin.deviceMatch = deviceMatch;
      pin.label = label || deviceMatch.toUpperCase();
    }
    onAdd(pin);
    // Reset form
    setZoneName('');
    setDeviceMatch('');
    setLabel('');
  };

  return (
    <div className="mt-4 panel p-3 border border-nx-line/40">
      <p className="panel-title mb-2">Legg til pin</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-text font-mono"
        >
          {Object.entries(KIND_LABELS).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>

        {needsZone && (
          <select
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            className="flex-1 min-w-[160px] bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-text font-mono"
          >
            <option value="">— velg sone —</option>
            {allZones.map(z => (
              <option key={z.id} value={z.name}>{z.name}</option>
            ))}
          </select>
        )}

        {needsDevice && (
          <>
            <input
              type="text"
              value={deviceMatch}
              onChange={(e) => setDeviceMatch(e.target.value)}
              placeholder="enhetsnavn (regex)"
              className="flex-1 min-w-[140px] bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-text font-mono"
            />
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="LABEL"
              className="w-24 bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-text font-mono uppercase"
            />
          </>
        )}

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className={[
            'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-[0.16em] transition-colors',
            canAdd ? 'bg-nx-cyan/15 text-nx-cyan hover:bg-nx-cyan/25' : 'text-nx-mute opacity-50 cursor-not-allowed'
          ].join(' ')}
        >
          <Plus size={12} /> Legg til
        </button>
      </div>
      <p className="mt-2 text-[10px] text-nx-mute">
        Nye pins legges på midten av bildet — dra dem til riktig plass etterpå.
      </p>
    </div>
  );
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}
