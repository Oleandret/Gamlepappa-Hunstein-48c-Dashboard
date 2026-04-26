import { Car, Battery, BatteryLow, Plug, Gauge } from 'lucide-react';
import { capValue } from '../../lib/deviceUtils.js';

/** Custom widget for Tesla Model 3 — battery, charging, software, tyre pressure. */
export function TeslaCard({ device }) {
  if (!device) return null;
  const battery = capValue(device, 'measure_battery');
  const charging = capValue(device, 'ev_charging_state');
  const carState = capValue(device, 'car_state');
  const odo = capValue(device, 'meter_car_odo');
  const speed = capValue(device, 'measure_car_drive_speed');
  const swVer = capValue(device, 'car_software_version');
  const swUpd = capValue(device, 'car_software_update_state');
  const tyres = ['fl', 'fr', 'rl', 'rr'].map(p => ({
    pos: p,
    bar: capValue(device, `measure_car_tpms_pressure_${p}`)
  }));

  const isCharging = String(charging || '').toLowerCase().includes('charging');
  const BatteryIcon = (battery != null && battery < 20) ? BatteryLow : Battery;

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-nx-cyan/15 text-nx-cyan shadow-glow-soft">
          <Car size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">{device.name}</div>
          <div className="text-[10px] text-nx-mute font-mono uppercase tracking-[0.18em]">
            {carState || 'parkert'}{swVer ? ` · v${swVer}` : ''}
          </div>
        </div>
        {isCharging && (
          <span className="chip text-[10px] text-nx-green border-nx-green/40 animate-pulseGlow">
            <Plug size={10} aria-hidden="true" /> LADER
          </span>
        )}
      </header>

      {battery != null && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-nx-mute flex items-center gap-1">
              <BatteryIcon size={12} aria-hidden="true" /> Batteri
            </span>
            <span className="font-mono text-nx-text">{Math.round(battery)}%</span>
          </div>
          <div
            className="relative h-2 rounded-full bg-nx-panel/60 border border-nx-line/40 overflow-hidden"
            role="progressbar" aria-valuenow={Math.round(battery)} aria-valuemin={0} aria-valuemax={100}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${battery}%`,
                background: battery < 20 ? '#ff5c7a' : 'linear-gradient(90deg,#3ddc84,#22e6ff)'
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        {odo != null && (
          <Stat label="Kilometerstand" value={`${Math.round(odo / 1000).toLocaleString('no-NO')} km`} />
        )}
        {speed != null && (
          <Stat label="Hastighet" value={`${Math.round(speed)} km/h`} />
        )}
      </div>

      {tyres.some(t => t.bar != null) && (
        <div>
          <p className="panel-title flex items-center gap-1">
            <Gauge size={11} aria-hidden="true" /> Dekktrykk
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {tyres.map(t => (
              <div key={t.pos} className="rounded border border-nx-line/40 bg-nx-panel/40 px-2 py-1 flex items-center justify-between">
                <span className="text-[10px] text-nx-mute font-mono uppercase">{labelTyre(t.pos)}</span>
                <span className="font-mono text-xs">
                  {t.bar != null ? `${Number(t.bar).toFixed(1)} bar` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {swUpd && String(swUpd).toLowerCase() !== 'idle' && (
        <div className="text-[11px] text-nx-amber font-mono">
          ⚙ Software: {swUpd}
        </div>
      )}
    </div>
  );
}

function labelTyre(p) {
  return ({ fl: 'FV', fr: 'FH', rl: 'BV', rr: 'BH' })[p] || p;
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-nx-line/40 bg-nx-panel/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.18em] text-nx-mute">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
