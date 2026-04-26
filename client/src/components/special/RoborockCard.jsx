import { Disc3, BatteryCharging, Battery, AlertTriangle, Play, Pause, Home as HomeIcon } from 'lucide-react';
import { capValue } from '../../lib/deviceUtils.js';

/** Custom widget for Roborock vacuums (Qrevo, Q7 Max). */
export function RoborockCard({ device, onSet }) {
  if (!device) return null;
  const isCleaning = capValue(device, 'is_cleaning');
  const battery = capValue(device, 'measure_battery');
  const charging = capValue(device, 'battery_charging_state');
  const cleanArea = capValue(device, 'clean_area');
  const cleanTime = capValue(device, 'clean_time');
  const stuck = capValue(device, 'alarm_stuck');
  const problem = capValue(device, 'alarm_problem');
  const binFull = capValue(device, 'alarm_bin_full');
  const docked = !!capValue(device, 'dock');

  const set = (cap, value) => onSet?.(device.id, cap, value);
  const status = problem ? 'Feil' : stuck ? 'Sittfast' : isCleaning ? 'Renser' : docked ? 'I dock' : 'Ledig';

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <span className={[
          'grid h-9 w-9 place-items-center rounded-lg shrink-0',
          isCleaning ? 'bg-nx-cyan/15 text-nx-cyan shadow-glow-soft animate-pulseGlow' : 'bg-nx-panel/60 text-nx-mute'
        ].join(' ')}>
          <Disc3 size={16} className={isCleaning ? 'animate-spin' : ''} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">{device.name}</div>
          <div className="text-[10px] text-nx-mute font-mono uppercase tracking-[0.18em]">{status}</div>
        </div>
        {(stuck || problem || binFull) && (
          <span className="chip text-[10px] text-nx-red border-nx-red/40">
            <AlertTriangle size={10} aria-hidden="true" /> {binFull ? 'Tøm beholder' : 'Trenger hjelp'}
          </span>
        )}
      </header>

      {battery != null && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-nx-mute flex items-center gap-1">
              {charging ? <BatteryCharging size={12} className="text-nx-green" aria-hidden="true" /> : <Battery size={12} aria-hidden="true" />}
              {charging ? 'Lader' : 'Batteri'}
            </span>
            <span className="font-mono text-nx-text">{Math.round(battery)}%</span>
          </div>
          <div className="relative h-2 rounded-full bg-nx-panel/60 border border-nx-line/40 overflow-hidden"
               role="progressbar" aria-valuenow={Math.round(battery)} aria-valuemin={0} aria-valuemax={100}>
            <div className="absolute inset-y-0 left-0 rounded-full"
                 style={{
                   width: `${battery}%`,
                   background: battery < 20 ? '#ff5c7a' : 'linear-gradient(90deg,#3ddc84,#22e6ff)'
                 }} />
          </div>
        </div>
      )}

      {(cleanArea != null || cleanTime != null) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {cleanArea != null && <Stat label="Areal" value={`${Number(cleanArea).toFixed(1)} m²`} />}
          {cleanTime != null && <Stat label="Tid" value={`${Math.round(cleanTime)} min`} />}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => set('is_cleaning', !isCleaning)}
          aria-label={isCleaning ? 'Pause rengjøring' : 'Start rengjøring'}
          aria-pressed={!!isCleaning}
          className={[
            'flex-1 inline-flex items-center justify-center gap-2 rounded-md py-2 text-xs font-mono transition-colors',
            isCleaning
              ? 'bg-nx-amber/15 text-nx-amber border border-nx-amber/45'
              : 'bg-nx-cyan/15 text-nx-cyan border border-nx-cyan/45 hover:bg-nx-cyan/25'
          ].join(' ')}
        >
          {isCleaning ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
          {isCleaning ? 'PAUSE' : 'START'}
        </button>
        <button
          onClick={() => set('dock', true)}
          aria-label="Send til dock"
          className="inline-flex items-center justify-center gap-2 rounded-md py-2 px-3 text-xs font-mono border border-nx-line/60 hover:border-nx-cyan/55 hover:text-nx-cyan transition-colors"
        >
          <HomeIcon size={12} aria-hidden="true" /> DOCK
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-nx-line/40 bg-nx-panel/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.18em] text-nx-mute">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
