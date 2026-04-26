import { useEffect, useRef, useState } from 'react';
import { Lightbulb, Lock, Unlock, Thermometer, Activity, DoorOpen, Camera, Power, X, Music, Zap } from 'lucide-react';
import { capValue, hasCap, classLabel, formatCapability } from '../lib/deviceUtils.js';

/**
 * Pin på en plantegning. To moduser:
 *  - Visning: liten markør med farge etter status. Klikk åpner popover med
 *    info og kontroller (toggle lys, lås opp/lås, justere termostat, osv.)
 *  - Edit-modus: pin er draggable, og popover gir tilleggsknapper for
 *    label-redigering og slett.
 */
export function FloorPlanPin({
  pin, device, editing,
  onMoveStart, onMove, onUpdate, onRemove, onSet,
  isDragging
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Lukk popover når man klikker utenfor
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const meta = deviceMeta(device);
  const labelText = pin.label || device?.name || 'Enhet';

  return (
    <div
      ref={ref}
      className="absolute"
      style={{
        left: `${pin.x}%`,
        top: `${pin.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: open || isDragging ? 30 : 10
      }}
    >
      <button
        type="button"
        onPointerDown={editing ? (e) => { e.preventDefault(); onMoveStart?.(pin.id); } : undefined}
        onClick={editing ? undefined : (e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={[
          'relative grid place-items-center rounded-full border-2 border-nx-bg shadow-[0_0_12px_rgba(34,230,255,0.7)] transition-transform',
          editing ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer hover:scale-110',
          meta.bg
        ].join(' ')}
        style={{ width: 22, height: 22 }}
        aria-label={`${labelText} — ${meta.statusText}`}
      >
        <meta.Icon size={11} className="text-nx-bg" aria-hidden="true" />
      </button>

      {/* Liten label under pin-en. I edit-modus skjules den fordi EditTools-
          komponenten viser label-input på samme posisjon. */}
      {!editing && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap rounded border border-nx-cyan/40 bg-nx-bg/85 backdrop-blur-sm px-1 py-0.5 text-[9px] font-mono text-nx-cyan"
          style={{ top: '100%' }}
        >
          {labelText}
        </div>
      )}

      {/* Popover med kontroller / info */}
      {open && !editing && (
        <PinPopover
          pin={pin}
          device={device}
          onSet={onSet}
          onClose={() => setOpen(false)}
        />
      )}

      {editing && (
        <EditTools pin={pin} onUpdate={onUpdate} onRemove={onRemove} />
      )}
    </div>
  );
}

function deviceMeta(device) {
  if (!device) {
    return {
      Icon: X,
      bg: 'bg-nx-red',
      statusText: 'enhet finnes ikke'
    };
  }
  // Velg ikon + farge basert på device-class og state
  if (device.class === 'lock') {
    const locked = capValue(device, 'locked');
    return {
      Icon: locked ? Lock : Unlock,
      bg: locked ? 'bg-nx-green' : 'bg-nx-amber',
      statusText: locked ? 'låst' : 'ulåst'
    };
  }
  if (device.class === 'light' || hasCap(device, 'dim')) {
    const on = capValue(device, 'onoff');
    return {
      Icon: Lightbulb,
      bg: on ? 'bg-nx-amber' : 'bg-nx-mute',
      statusText: on ? 'på' : 'av'
    };
  }
  if (device.class === 'thermostat' || hasCap(device, 'target_temperature')) {
    return { Icon: Thermometer, bg: 'bg-nx-cyan', statusText: 'termostat' };
  }
  if (device.class === 'camera') {
    return { Icon: Camera, bg: 'bg-nx-purple', statusText: 'kamera' };
  }
  if (hasCap(device, 'alarm_motion')) {
    const motion = capValue(device, 'alarm_motion');
    return {
      Icon: Activity,
      bg: motion ? 'bg-nx-red' : 'bg-nx-cyan',
      statusText: motion ? 'bevegelse!' : 'rolig'
    };
  }
  if (hasCap(device, 'alarm_contact')) {
    const open = capValue(device, 'alarm_contact');
    return {
      Icon: DoorOpen,
      bg: open ? 'bg-nx-amber' : 'bg-nx-cyan',
      statusText: open ? 'åpen' : 'lukket'
    };
  }
  if (device.class === 'speaker' || hasCap(device, 'speaker_playing')) {
    return { Icon: Music, bg: 'bg-nx-purple', statusText: 'høyttaler' };
  }
  if (hasCap(device, 'measure_power')) {
    return { Icon: Zap, bg: 'bg-nx-cyan', statusText: 'strøm' };
  }
  if (hasCap(device, 'onoff')) {
    const on = capValue(device, 'onoff');
    return {
      Icon: Power,
      bg: on ? 'bg-nx-green' : 'bg-nx-mute',
      statusText: on ? 'på' : 'av'
    };
  }
  return { Icon: Activity, bg: 'bg-nx-cyan', statusText: classLabel(device.class) };
}

function PinPopover({ pin, device, onSet, onClose }) {
  if (!device) {
    return (
      <Popover>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-nx-red mb-1">
          Enhet ikke funnet
        </div>
        <div className="text-xs text-nx-mute">deviceId: <span className="font-mono">{pin.deviceId}</span></div>
      </Popover>
    );
  }

  return (
    <Popover onClose={onClose}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-nx-mute">
            {classLabel(device.class)}
          </div>
          <div className="text-sm font-semibold leading-tight truncate" title={device.name}>
            {pin.label || device.name}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Lukk"
          className="text-nx-mute hover:text-nx-cyan p-0.5"
        >
          <X size={12} />
        </button>
      </div>

      <DeviceControls device={device} onSet={onSet} />
    </Popover>
  );
}

function DeviceControls({ device, onSet }) {
  const onoff = capValue(device, 'onoff');
  const dim = capValue(device, 'dim');
  const locked = capValue(device, 'locked');
  const target = capValue(device, 'target_temperature');
  const measured = capValue(device, 'measure_temperature');
  const battery = capValue(device, 'measure_battery');
  const power = capValue(device, 'measure_power');
  const motion = capValue(device, 'alarm_motion');
  const contact = capValue(device, 'alarm_contact');

  return (
    <div className="space-y-2">
      {/* Status-rader */}
      {Number.isFinite(measured) && (
        <Row label="Måler">
          <span className="font-mono text-nx-cyan">{measured.toFixed(1)}°C</span>
        </Row>
      )}
      {Number.isFinite(battery) && (
        <Row label="Batteri">
          <span className={[
            'font-mono tabular-nums',
            battery < 20 ? 'text-nx-red' : battery < 40 ? 'text-nx-amber' : 'text-nx-green'
          ].join(' ')}>{Math.round(battery)}%</span>
        </Row>
      )}
      {Number.isFinite(power) && !hasCap(device, 'onoff') && (
        <Row label="Effekt">
          <span className="font-mono text-nx-cyan">{Math.round(power)} W</span>
        </Row>
      )}
      {motion === true && (
        <Row label="Status"><span className="text-nx-red font-mono">BEVEGELSE</span></Row>
      )}
      {contact === true && (
        <Row label="Status"><span className="text-nx-amber font-mono">ÅPEN</span></Row>
      )}

      {/* Kontroller */}
      {hasCap(device, 'onoff') && (
        <Row label="Av/på">
          <div className="flex items-center gap-1 rounded-full border border-nx-line/60 p-0.5 text-[10px] font-mono">
            <button
              onClick={() => onSet(device.id, 'onoff', false)}
              aria-pressed={onoff === false}
              className={['px-2 py-0.5 rounded-full', onoff === false ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute'].join(' ')}
            >Av</button>
            <button
              onClick={() => onSet(device.id, 'onoff', true)}
              aria-pressed={onoff === true}
              className={['px-2 py-0.5 rounded-full', onoff === true ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute'].join(' ')}
            >På</button>
          </div>
        </Row>
      )}

      {hasCap(device, 'dim') && (
        <Row label="Dim">
          <input
            type="range"
            min={0} max={100} step={1}
            value={Math.round((dim ?? 0) * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              if (!onoff && v > 0) onSet(device.id, 'onoff', true);
              onSet(device.id, 'dim', v);
            }}
            className="w-32 accent-nx-cyan"
            aria-label="Dim-nivå"
          />
          <span className="font-mono text-[10px] text-nx-mute tabular-nums w-8 text-right">
            {Math.round((dim ?? 0) * 100)}%
          </span>
        </Row>
      )}

      {hasCap(device, 'locked') && (
        <Row label={locked ? 'Låst' : 'Ulåst'}>
          <button
            onClick={() => onSet(device.id, 'locked', !locked)}
            className={[
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono uppercase tracking-[0.16em]',
              locked ? 'bg-nx-amber/15 text-nx-amber' : 'bg-nx-green/15 text-nx-green'
            ].join(' ')}
          >
            {locked ? <Unlock size={11} /> : <Lock size={11} />}
            {locked ? 'Lås opp' : 'Lås'}
          </button>
        </Row>
      )}

      {hasCap(device, 'target_temperature') && (
        <Row label="Mål">
          <input
            type="range"
            min={5} max={30} step={0.5}
            value={Number.isFinite(target) ? target : 21}
            onChange={(e) => onSet(device.id, 'target_temperature', Number(e.target.value))}
            className="w-32 accent-nx-cyan"
            aria-label="Måltemperatur"
          />
          <span className="font-mono text-[10px] text-nx-cyan tabular-nums w-12 text-right">
            {Number.isFinite(target) ? `${target.toFixed(1)}°` : '—'}
          </span>
        </Row>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-nx-mute font-mono text-[10px] uppercase tracking-[0.16em]">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function Popover({ children, onClose }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full min-w-[220px] max-w-[260px] rounded-xl border border-nx-cyan/45 bg-nx-bg/95 backdrop-blur-md shadow-glow-soft p-3 z-40"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      {/* Pil ned mot pin-en */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 -translate-x-1/2 -bottom-2 h-3 w-3 rotate-45 border-r border-b border-nx-cyan/45 bg-nx-bg/95"
      />
    </div>
  );
}

function EditTools({ pin, onUpdate, onRemove }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 mt-2 -bottom-2 translate-y-full flex items-center gap-1 bg-nx-bg/95 border border-nx-cyan/45 rounded-md px-1 py-0.5 z-30"
      style={{ top: '100%' }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={pin.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        placeholder="label"
        className="w-20 bg-transparent border-none text-[10px] font-mono text-nx-cyan focus:outline-none placeholder:text-nx-mute"
      />
      <button
        type="button"
        onClick={() => {
          const placements = ['top', 'right', 'bottom', 'left'];
          const next = placements[(placements.indexOf(pin.placement || 'top') + 1) % placements.length];
          onUpdate({ placement: next });
        }}
        className="text-[10px] font-mono text-nx-mute hover:text-nx-cyan px-1"
        title="Roter info-side"
      >↻</button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Fjern pin"
        className="text-nx-mute hover:text-nx-red"
      >
        <X size={10} />
      </button>
    </div>
  );
}
