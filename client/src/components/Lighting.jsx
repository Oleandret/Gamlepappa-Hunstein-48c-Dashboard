import { Lightbulb, Power } from 'lucide-react';

export function Lighting({ devices, onSet }) {
  const lights = Object.values(devices).filter(d => d.class === 'light').slice(0, 4);
  const anyOn = lights.some(l => l.capabilities?.onoff);

  function toggleAll(on) {
    lights.forEach(l => onSet(l.id, 'onoff', on));
  }
  function toggleOne(l) {
    const next = !(l.capabilities?.onoff);
    onSet(l.id, 'onoff', next);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="panel-title">Belysning</p>
        <div className="flex items-center gap-1 rounded-full border border-nx-line/60 p-0.5 text-[11px] font-mono">
          <button
            onClick={() => toggleAll(false)}
            className={['px-2 py-0.5 rounded-full transition-colors', !anyOn ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute'].join(' ')}
          >Av</button>
          <button
            onClick={() => toggleAll(true)}
            className={['px-2 py-0.5 rounded-full transition-colors', anyOn ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute'].join(' ')}
          >På</button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => toggleAll(true)}
          className="rounded-xl border border-nx-line/60 bg-nx-panel/40 p-3 text-left"
        >
          <Power size={14} className="text-nx-cyan"/>
          <div className="mt-1 text-sm">Alle lys</div>
          <div className="text-[10px] text-nx-mute">{lights.filter(l=>l.capabilities?.onoff).length}/{lights.length} på</div>
        </button>
        <button className="rounded-xl border border-nx-cyan/40 bg-nx-cyan/10 p-3 text-left">
          <div className="text-xs text-nx-cyan">Aktivitet</div>
          <div className="mt-1 text-sm">Hyggelig</div>
          <div className="text-[10px] text-nx-mute">forhåndsinnstilt scene</div>
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {lights.map(l => {
          const on = !!l.capabilities?.onoff;
          const dim = (l.capabilities?.dim ?? 0) * 100;
          return (
            <li key={l.id} className="flex items-center gap-2">
              <button
                onClick={() => toggleOne(l)}
                className={[
                  'grid h-7 w-7 place-items-center rounded-md border transition-colors',
                  on ? 'border-nx-cyan/60 text-nx-cyan bg-nx-cyan/10 shadow-glow-soft' : 'border-nx-line/60 text-nx-mute'
                ].join(' ')}
              >
                <Lightbulb size={14}/>
              </button>
              <span className="text-xs flex-1 truncate">{l.name}</span>
              <div className="w-24 h-1 rounded-full bg-nx-line/50 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: on ? `${dim}%` : '0%',
                    background: 'linear-gradient(90deg,#22e6ff,#7d5cff)'
                  }}
                />
              </div>
              <span className="w-8 text-right text-[11px] font-mono text-nx-mute">
                {on ? `${Math.round(dim)}` : '–'}
              </span>
            </li>
          );
        })}
        {lights.length === 0 && (
          <li className="text-sm text-nx-mute">Fant ingen lys i Homey.</li>
        )}
      </ul>
    </div>
  );
}
