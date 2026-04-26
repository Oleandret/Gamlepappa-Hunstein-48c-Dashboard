import { useMemo } from 'react';
import { Thermometer, Droplets, Sun, Lightbulb, Battery, Zap, Activity, Lock, Unlock, DoorOpen } from 'lucide-react';
import { capValue, formatCapability } from '../lib/deviceUtils.js';

/**
 * Liten widget-rad som viser brukervalgte sensor-verdier på framsiden.
 * Hver widget = { deviceId, capability, label }.
 * Kolapser til ingenting hvis listen er tom.
 */

const ICON_FOR_CAP = {
  measure_temperature: Thermometer,
  target_temperature:  Thermometer,
  measure_humidity:    Droplets,
  measure_luminance:   Sun,
  measure_power:       Zap,
  meter_power:         Zap,
  measure_battery:     Battery,
  onoff:               Lightbulb,
  dim:                 Lightbulb,
  locked:              Lock,
  alarm_motion:        Activity,
  alarm_contact:       DoorOpen
};

export function FrontSensors({ sensors, devices }) {
  const items = useMemo(() => sensors.map(s => {
    const dev = devices?.[s.deviceId];
    const value = capValue(dev, s.capability);
    return {
      ...s,
      device: dev,
      value,
      formatted: formatCapability(s.capability, value),
      Icon: ICON_FOR_CAP[s.capability] || Activity
    };
  }), [sensors, devices]);

  if (items.length === 0) return null;

  return (
    <div className="col-span-12">
      <div className="flex flex-wrap gap-2">
        {items.map(item => <SensorChip key={item.id} item={item} />)}
      </div>
    </div>
  );
}

function SensorChip({ item }) {
  const { Icon, value, formatted, device, label, capability } = item;
  const name = label || device?.name || 'Sensor mangler';
  const missing = !device || value == null;

  // Bestem farge basert på capability og verdi
  let valueClass = 'text-nx-cyan';
  if (capability === 'measure_battery' && Number.isFinite(value)) {
    valueClass = value < 20 ? 'text-nx-red'
              : value < 40 ? 'text-nx-amber'
              : 'text-nx-green';
  } else if (capability === 'alarm_motion' && value === true) {
    valueClass = 'text-nx-red';
  } else if (capability === 'alarm_contact' && value === true) {
    valueClass = 'text-nx-amber';
  } else if (capability === 'locked') {
    valueClass = value ? 'text-nx-green' : 'text-nx-amber';
  } else if (missing) {
    valueClass = 'text-nx-mute';
  }

  return (
    <div
      className={[
        'panel px-3 py-2 flex items-center gap-2 min-w-[140px]',
        missing ? 'border-nx-line/30 opacity-60' : 'border-nx-cyan/25'
      ].join(' ')}
      title={device?.name ? `${device.name} · ${capability}` : `Mangler enhet · ${capability}`}
    >
      <Icon size={16} className={missing ? 'text-nx-mute' : 'text-nx-cyan'} aria-hidden="true" />
      <div className="min-w-0 leading-tight">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-nx-mute truncate max-w-[120px]">
          {name}
        </div>
        <div className={['text-sm font-semibold tabular-nums', valueClass].join(' ')}>
          {missing ? '—' : formatted}
        </div>
      </div>
    </div>
  );
}
