import { useMemo, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { allCaps, classLabel } from '../lib/deviceUtils.js';
import { RichDevicePicker } from './RichDevicePicker.jsx';
import { SaveButton } from './SaveButton.jsx';

const READABLE_CAPS = {
  measure_temperature: 'Temperatur',
  target_temperature:  'Måltemperatur',
  measure_humidity:    'Luftfuktighet',
  measure_luminance:   'Lys (lx)',
  measure_power:       'Effekt nå',
  meter_power:         'Energi totalt',
  measure_battery:     'Batteri',
  onoff:               'Av/på',
  dim:                 'Dimmer',
  locked:              'Låst-status',
  alarm_motion:        'Bevegelse',
  alarm_contact:       'Dør/vindu',
  alarm_smoke:         'Røyk',
  alarm_water:         'Vann',
  volume_set:          'Volum',
  windowcoverings_set: 'Persienne'
};

/**
 * UI for å velge hvilke sensorer som vises som små chips på framsiden.
 * Hver rad: enhet + capability + valgfri kort label.
 */
export function FrontSensorEditor({ sensors, devices, zones }) {
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedCap, setSelectedCap] = useState('');
  const [label, setLabel] = useState('');

  // Grupper enheter per rom for dropdown
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

  // Capabilities for valgt enhet
  const selectedDevice = selectedDeviceId ? devices?.[selectedDeviceId] : null;
  const availableCaps = useMemo(() => {
    if (!selectedDevice) return [];
    return allCaps(selectedDevice).filter(c => READABLE_CAPS[c] !== undefined || true);
  }, [selectedDevice]);

  const canAdd = selectedDeviceId && selectedCap;

  const handleAdd = () => {
    if (!canAdd) return;
    sensors.add({
      deviceId: selectedDeviceId,
      capability: selectedCap,
      label: label.trim()
    });
    setSelectedDeviceId('');
    setSelectedCap('');
    setLabel('');
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="panel-title">Sensor-widgets på framsiden</p>
        <SaveButton sync={sensors.sync} />
      </div>
      <p className="text-xs text-nx-mute mb-3">
        Små chips øverst på Oversikt som viser verdien til en valgt sensor — temp i hagen, batteri på røykvarsler, osv.
      </p>

      {/* Liste over eksisterende */}
      {sensors.list.length > 0 ? (
        <ul className="mb-3 divide-y divide-nx-line/40 border border-nx-line/40 rounded-lg">
          {sensors.list.map((s, i) => {
            const dev = devices?.[s.deviceId];
            return (
              <li key={s.id} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-nx-panel/40">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-nx-cyan w-6 shrink-0 text-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 flex flex-wrap gap-1 items-center">
                  <span className="text-nx-text truncate max-w-[180px]">
                    {dev?.name || <span className="text-nx-red italic">Mangler enhet</span>}
                  </span>
                  <span className="text-nx-mute">·</span>
                  <span className="text-nx-cyan font-mono">{READABLE_CAPS[s.capability] || s.capability}</span>
                  {dev?.zone && zones?.[dev.zone] && (
                    <span className="text-nx-mute font-mono text-[10px]">({zones[dev.zone].name})</span>
                  )}
                </div>
                <input
                  type="text"
                  value={s.label}
                  onChange={(e) => sensors.update(s.id, { label: e.target.value })}
                  placeholder="vist navn"
                  className="w-28 shrink-0 bg-nx-panel/60 border border-nx-line/60 rounded px-1.5 py-0.5 text-xs text-nx-text font-mono"
                />
                <button
                  type="button"
                  onClick={() => sensors.reorder(i, i - 1)}
                  disabled={i === 0}
                  className="p-1 rounded hover:bg-nx-cyan/10 text-nx-mute hover:text-nx-cyan disabled:opacity-30"
                  title="Flytt opp"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => sensors.reorder(i, i + 1)}
                  disabled={i === sensors.list.length - 1}
                  className="p-1 rounded hover:bg-nx-cyan/10 text-nx-mute hover:text-nx-cyan disabled:opacity-30"
                  title="Flytt ned"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => sensors.remove(s.id)}
                  className="p-1 rounded hover:bg-nx-red/10 text-nx-mute hover:text-nx-red"
                  title="Fjern"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-nx-mute italic">Ingen sensor-widgets ennå. Legg til under.</p>
      )}

      {/* Legg til-form */}
      <div className="panel p-3 border border-nx-line/40">
        <p className="panel-title mb-2">Legg til sensor</p>
        <div className="flex flex-wrap items-center gap-2">
          <RichDevicePicker
            value={selectedDeviceId}
            onChange={(id) => { setSelectedDeviceId(id); setSelectedCap(''); }}
            devices={devices}
            zones={zones}
            placeholder="— velg enhet —"
            className="flex-1 min-w-[260px]"
          />

          <select
            value={selectedCap}
            onChange={(e) => setSelectedCap(e.target.value)}
            disabled={!selectedDevice}
            className="bg-nx-panel/60 border border-nx-line/60 rounded px-2 py-1 text-xs text-nx-text font-mono disabled:opacity-50"
          >
            <option value="">— velg verdi —</option>
            {availableCaps.map(c => (
              <option key={c} value={c}>{READABLE_CAPS[c] || c}</option>
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
            disabled={!canAdd}
            className={[
              'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-[0.16em] transition-colors',
              canAdd ? 'bg-nx-cyan/15 text-nx-cyan hover:bg-nx-cyan/25' : 'text-nx-mute opacity-50 cursor-not-allowed'
            ].join(' ')}
          >
            <Plus size={12} /> Legg til
          </button>
        </div>
      </div>
    </div>
  );
}
