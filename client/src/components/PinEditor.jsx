import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Home as HomeIcon, Anchor, Plus, Trash2, RotateCcw, ArrowUp, ArrowDown,
  ArrowLeft, ArrowRight, Car, Sun, Flame, MapPin, Box as BoxIcon, Save, Undo2,
  AlertCircle
} from 'lucide-react';
import { VIEWS } from './HouseView.jsx';

/**
 * Editor for pin-konfig på framsidens hovedbilder.
 *
 * Bruker lokal "draft"-state slik at alle endringer er midlertidige til
 * brukeren trykker Lagre. Forkast tilbakestiller til siste lagrede tilstand.
 */
const KIND_LABELS = {
  device:      { label: 'Enhet',           Icon: BoxIcon  },
  zone:        { label: 'Sone (hjem)',     Icon: BoxIcon  },
  cabinZone:   { label: 'Sone (hytte)',    Icon: BoxIcon  },
  tesla:       { label: 'Tesla',           Icon: Car      },
  solar:       { label: 'Solceller',       Icon: Sun      },
  sauna:       { label: 'Sauna',           Icon: Flame    },
  pier:        { label: 'Brygge',          Icon: Anchor   },
  boathouse:   { label: 'Båthus',          Icon: Anchor   },
  // Lagacy regex-baserte cabinDevice støttes for eldre konfig
  cabinDevice: { label: 'Hytte-enhet (regex)', Icon: BoxIcon }
};

const PLACEMENTS = ['top', 'right', 'bottom', 'left'];
const PLACEMENT_ICON = { top: ArrowUp, right: ArrowRight, bottom: ArrowDown, left: ArrowLeft };

function defaultsFor(location) {
  return VIEWS[location].pins.map((p, i) => ({
    id: `${p.kind}-default-${i}`,
    ...p
  }));
}

function newId(kind) {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export function PinEditor({ pinConfig, devices = {}, zones = {} }) {
  const [location, setLocation] = useState('home');

  // Lokal draft. Initialiseres fra pinConfig, og resyncer når pinConfig endres
  // eksternt (f.eks. fra et annet vindu via storage-event).
  const [draft, setDraft] = useState(pinConfig.config);
  const [savedSnapshot, setSavedSnapshot] = useState(pinConfig.config);

  useEffect(() => {
    // Hvis ekstern config endres og vi ikke har endret noe, sync draft.
    if (JSON.stringify(savedSnapshot) === JSON.stringify(pinConfig.config)) return;
    // ellers la draft være, men oppdater snapshot for diff-beregning
    setSavedSnapshot(pinConfig.config);
  }, [pinConfig.config, savedSnapshot]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(pinConfig.config),
    [draft, pinConfig.config]
  );

  const list = draft[location] || [];

  // Draft-mutasjoner
  const updatePin = (id, patch) => {
    setDraft(d => ({
      ...d,
      [location]: (d[location] || []).map(p => p.id === id ? { ...p, ...patch } : p)
    }));
  };
  const addPin = (pin) => {
    setDraft(d => ({
      ...d,
      [location]: [...(d[location] || []), {
        id: newId(pin.kind), x: 50, y: 50, placement: 'top', ...pin
      }]
    }));
  };
  const removePin = (id) => {
    setDraft(d => ({ ...d, [location]: (d[location] || []).filter(p => p.id !== id) }));
  };
  const cyclePlacement = (id) => {
    const p = list.find(p => p.id === id);
    if (!p) return;
    const next = PLACEMENTS[(PLACEMENTS.indexOf(p.placement || 'top') + 1) % PLACEMENTS.length];
    updatePin(id, { placement: next });
  };
  const resetLocationDraft = () => {
    if (!confirm(`Tilbakestille ${location === 'home' ? 'Hjem' : 'Hytte'} til standard?`)) return;
    setDraft(d => ({ ...d, [location]: defaultsFor(location) }));
  };

  const save = () => {
    pinConfig.update(draft);
    setSavedSnapshot(draft);
  };
  const discard = () => {
    setDraft(pinConfig.config);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="panel-title">Sensorer på framsiden</p>
          {isDirty && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-mono text-nx-amber">
              <AlertCircle size={11} /> Ulagrede endringer
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetLocationDraft}
            className="text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute hover:text-nx-cyan flex items-center gap-1"
            title="Tilbakestill denne lokasjonen til default-pinene (i draft)"
          >
            <RotateCcw size={11} /> Standard
          </button>
          <button
            type="button"
            onClick={discard}
            disabled={!isDirty}
            className={[
              'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-[0.16em] transition-colors',
              isDirty ? 'text-nx-mute hover:text-nx-text border border-nx-line/60' : 'text-nx-mute opacity-40 cursor-not-allowed border border-nx-line/40'
            ].join(' ')}
          >
            <Undo2 size={12} /> Forkast
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!isDirty}
            className={[
              'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-[0.16em] transition-colors',
              isDirty
                ? 'bg-nx-cyan/15 text-nx-cyan hover:bg-nx-cyan/25 shadow-glow-soft'
                : 'text-nx-mute opacity-40 cursor-not-allowed'
            ].join(' ')}
          >
            <Save size={12} /> Lagre
          </button>
        </div>
      </div>

      {/* Tabs: Hjem / Hytte */}
      <div className="flex gap-1 p-0.5 rounded-lg border border-nx-line/60 bg-nx-panel/40 w-fit mb-3">
        <TabButton active={location === 'home'}  onClick={() => setLocation('home')}  Icon={HomeIcon} label="Hjem" />
        <TabButton active={location === 'cabin'} onClick={() => setLocation('cabin')} Icon={Anchor}   label="Hytte" />
      </div>

      <p className="text-xs text-nx-mute mb-2">
        Dra pinene direkte på bildet for å flytte dem. Klikk pilen i lista for å rotere hvilken side label-en flyter på.
        Endringer er midlertidige til du trykker <span className="text-nx-cyan font-mono">Lagre</span>.
      </p>

      <PreviewWithPins
        location={location}
        pins={list}
        onMove={(id, x, y) => updatePin(id, { x, y })}
        devices={devices}
      />

      <PinList
        pins={list}
        zones={zones}
        devices={devices}
        onCyclePlacement={cyclePlacement}
        onUpdate={updatePin}
        onRemove={removePin}
      />

      <AddPinForm
        zones={zones}
        devices={devices}
        onAdd={addPin}
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

function PreviewWithPins({ location, pins, onMove, devices }) {
  const containerRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const view = VIEWS[location];

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
          devices={devices}
          dragging={draggingId === p.id}
          onPointerDown={(e) => { e.preventDefault(); setDraggingId(p.id); }}
        />
      ))}
    </div>
  );
}

function EditorPin({ pin, devices, dragging, onPointerDown }) {
  const meta = KIND_LABELS[pin.kind] || { label: pin.kind, Icon: MapPin };
  const Icon = meta.Icon;
  const labelText =
    (pin.kind === 'device' && devices?.[pin.deviceId]?.name) ||
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

function PinList({ pins, zones, devices, onCyclePlacement, onUpdate, onRemove }) {
  if (pins.length === 0) {
    return <p className="mt-3 text-xs text-nx-mute italic">Ingen pins her ennå. Legg til under.</p>;
  }
  return (
    <ul className="mt-3 divide-y divide-nx-line/40 border border-nx-line/40 rounded-lg overflow-hidden">
      {pins.map((p) => {
        const meta = KIND_LABELS[p.kind] || { label: p.kind, Icon: MapPin };
        const PlacementIcon = PLACEMENT_ICON[p.placement || 'top'] || ArrowUp;
        return (
          <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-nx-panel/40">
            <meta.Icon size={12} className="text-nx-cyan shrink-0" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-nx-mute w-24 shrink-0 truncate">
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
              title={`Label-side: ${p.placement || 'top'}`}
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

function PinIdentField({ pin, zones, devices, onUpdate }) {
  const allZones = useMemo(() => Object.values(zones || {}), [zones]);

  if (pin.kind === 'device') {
    return (
      <DevicePicker
        value={pin.deviceId}
        onChange={(id) => onUpdate({ deviceId: id })}
        devices={devices}
        zones={zones}
        className="flex-1 min-w-0"
      />
    );
  }

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

  return <span className="flex-1 min-w-0 text-xs text-nx-mute italic truncate">— auto —</span>;
}

function DevicePicker({ value, onChange, devices, zones, className = '' }) {
  // Grupper enheter per rom/sone
  const groups = useMemo(() => {
    const byZone = {};
    Object.values(devices || {}).forEach(d => {
      const zoneName = zones?.[d.zone]?.name || 'Uten sone';
      if (!byZone[zoneName]) byZone[zoneName] = [];
      byZone[zoneName].push(d);
    });
    Object.values(byZone).forEach(arr => arr.sort((a,b) => (a.name||'').localeCompare(b.name||'')));
    return Object.entries(byZone).sort((a,b) => a[0].localeCompare(b[0]));
  }, [devices, zones]);

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-nx-panel/60 border border-nx-line/60 rounded px-1.5 py-0.5 text-xs text-nx-text font-mono ${className}`}
    >
      <option value="">— velg enhet —</option>
      {groups.map(([zoneName, devs]) => (
        <optgroup key={zoneName} label={zoneName}>
          {devs.map(d => (
            <option key={d.id} value={d.id}>{d.name || '(uten navn)'}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function AddPinForm({ zones, devices, onAdd }) {
  const [kind, setKind] = useState('device');
  const [zoneName, setZoneName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceMatch, setDeviceMatch] = useState('');
  const [label, setLabel] = useState('');

  const allZones = useMemo(() => Object.values(zones || {}), [zones]);

  const needsZone = kind === 'zone' || kind === 'cabinZone';
  const needsDevice = kind === 'device';
  const needsCabinRegex = kind === 'cabinDevice';

  const canAdd = needsZone ? !!zoneName
    : needsDevice ? !!deviceId
    : needsCabinRegex ? !!deviceMatch
    : true;

  const handleAdd = () => {
    if (!canAdd) return;
    const pin = { kind };
    if (needsZone) pin.zoneName = zoneName;
    if (needsDevice) {
      pin.deviceId = deviceId;
      if (label) pin.label = label;
    }
    if (needsCabinRegex) {
      pin.deviceMatch = deviceMatch;
      pin.label = label || deviceMatch.toUpperCase();
    }
    onAdd(pin);
    setZoneName('');
    setDeviceId('');
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
            <DevicePicker
              value={deviceId}
              onChange={setDeviceId}
              devices={devices}
              zones={zones}
              className="flex-1 min-w-[200px]"
            />
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="LABEL (valgfri)"
              className="w-32 bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-text font-mono uppercase"
            />
          </>
        )}

        {needsCabinRegex && (
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
        Nye pins legges på midten av bildet — dra dem til riktig plass etterpå, og trykk Lagre.
      </p>
    </div>
  );
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}
