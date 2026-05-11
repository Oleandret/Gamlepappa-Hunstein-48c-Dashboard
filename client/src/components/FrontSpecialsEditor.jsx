import { useMemo } from 'react';
import { Car, Zap, Activity } from 'lucide-react';
import { RichDevicePicker } from './RichDevicePicker.jsx';
import { SaveButton } from './SaveButton.jsx';

/**
 * UI i Innstillinger for å velge hvilke spesial-kort som vises på
 * Oversikt-fanen (Tesla, Tibber, Støvsuger). Tre slots — hver med tre
 * moduser: 'auto', 'none', eller en spesifikk deviceId.
 */

const SLOTS = [
  {
    id: 'tesla',
    label: 'Tesla',
    Icon: Car,
    description: 'Auto velger enhet med "Model X" i navnet, ellers første bil',
    filter: (d) => d.class === 'car' || /tesla/i.test(d.driverUri || '')
  },
  {
    id: 'tibber',
    label: 'Tibber',
    Icon: Zap,
    description: 'Auto velger første enhet med "tibber" i driver',
    filter: (d) => /tibber/i.test(d.driverUri || '')
  },
  {
    id: 'vacuum',
    label: 'Støvsuger',
    Icon: Activity,
    description: 'Velg hvilken støvsuger som skal vises på Oversikt',
    filter: (d) => d.class === 'vacuumcleaner'
  }
];

export function FrontSpecialsEditor({ specials, devices, zones }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p className="panel-title">Spesial-kort på framsiden</p>
        <SaveButton sync={specials.sync} />
      </div>
      <p className="text-xs text-nx-mute mb-3 leading-relaxed">
        Velg hvilke spesial-kort som vises på Oversikt-fanen. Sett til <strong>Skjul</strong> for å gjemme kortet helt, <strong>Auto</strong> for å la systemet plukke selv, eller plukk en spesifikk enhet.
      </p>

      <ul className="space-y-2">
        {SLOTS.map(slot => (
          <SlotRow
            key={slot.id}
            slot={slot}
            value={specials.config[slot.id]}
            onChange={(v) => specials.set(slot.id, v)}
            devices={devices}
            zones={zones}
          />
        ))}
      </ul>
    </div>
  );
}

function SlotRow({ slot, value, onChange, devices, zones }) {
  const Icon = slot.Icon;
  const filteredDevices = useMemo(() => {
    if (!devices) return {};
    const out = {};
    for (const [id, d] of Object.entries(devices)) {
      if (slot.filter(d)) out[id] = d;
    }
    return out;
  }, [devices, slot]);

  const mode = (value === 'auto' || value === 'none') ? value : 'custom';

  return (
    <li className="rounded-lg border border-nx-line/40 bg-nx-panel/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-nx-cyan shrink-0" aria-hidden="true" />
        <span className="font-semibold text-sm">{slot.label}</span>
        <span className="text-[10px] font-mono text-nx-mute ml-2">{slot.description}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" className="flex items-center gap-1 rounded-full border border-nx-line/60 p-0.5 text-[10px] font-mono">
          <button
            onClick={() => onChange('auto')}
            aria-pressed={mode === 'auto'}
            className={['px-2.5 py-0.5 rounded-full transition-colors',
              mode === 'auto' ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute hover:text-nx-text'].join(' ')}
          >Auto</button>
          <button
            onClick={() => onChange('none')}
            aria-pressed={mode === 'none'}
            className={['px-2.5 py-0.5 rounded-full transition-colors',
              mode === 'none' ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute hover:text-nx-text'].join(' ')}
          >Skjul</button>
          <button
            onClick={() => {
              // Hvis vi går til 'custom' uten verdi, sett til første tilgjengelige
              const firstId = Object.keys(filteredDevices)[0];
              if (firstId) onChange(firstId);
            }}
            aria-pressed={mode === 'custom'}
            disabled={Object.keys(filteredDevices).length === 0}
            className={['px-2.5 py-0.5 rounded-full transition-colors',
              mode === 'custom' ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute hover:text-nx-text',
              Object.keys(filteredDevices).length === 0 ? 'opacity-40 cursor-not-allowed' : ''
            ].join(' ')}
          >Velg enhet</button>
        </div>

        {mode === 'custom' && (
          <RichDevicePicker
            value={value}
            onChange={onChange}
            devices={filteredDevices}
            zones={zones}
            placeholder={`Velg ${slot.label.toLowerCase()}...`}
            className="flex-1 min-w-[260px]"
          />
        )}
      </div>
    </li>
  );
}
