import { Lock, ShieldCheck, DoorOpen, Activity, Camera } from 'lucide-react';

export function SecurityWidget({ security }) {
  const armed = security?.armed ?? false;
  const score = security?.healthScore ?? 96;
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="panel-title">Sikkerhet</p>
        <span className={[
          'chip text-[11px]',
          armed ? 'text-nx-green border-nx-green/40' : 'text-nx-amber border-nx-amber/40'
        ].join(' ')}>
          <span className={[
            'h-1.5 w-1.5 rounded-full animate-pulseGlow',
            armed ? 'bg-nx-green' : 'bg-nx-amber'
          ].join(' ')} />
          {armed ? 'Systemet er aktivt' : 'Inaktivt'}
        </span>
      </div>

      {/* Big radial */}
      <div className="relative mx-auto mt-3 h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#1c2a44" strokeWidth="6"/>
          <circle
            cx="60" cy="60" r="50" fill="none"
            stroke="url(#grSec)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 50}
            strokeDashoffset={2 * Math.PI * 50 * (1 - score / 100)}
          />
          <defs>
            <linearGradient id="grSec" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22e6ff"/>
              <stop offset="100%" stopColor="#3ddc84"/>
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <ShieldCheck size={20} className="text-nx-green mx-auto"/>
            <div className="font-mono text-xl mt-0.5">{score}<span className="text-nx-mute text-xs">/100</span></div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5 text-[11px]">
        <Tile Icon={DoorOpen}    label="Dører"      value="3" />
        <Tile Icon={Lock}        label="Vinduer"    value="8" />
        <Tile Icon={Activity}    label="Bevegelse"  value="2" />
        <Tile Icon={Camera}      label="Kamera"     value="1" />
      </div>

      <button className="btn w-full mt-3 justify-between text-xs">
        <span>SE KAMERAER</span>
        <span className="text-nx-cyan">→</span>
      </button>
    </div>
  );
}

function Tile({ Icon, label, value }) {
  return (
    <div className="rounded-lg border border-nx-line/60 bg-nx-panel/50 p-2 text-center">
      <Icon size={14} className="mx-auto text-nx-cyan"/>
      <div className="text-[9px] uppercase tracking-[0.16em] text-nx-mute mt-1">{label}</div>
      <div className="text-sm font-mono">{value}</div>
    </div>
  );
}
