import { Lightbulb, Power } from 'lucide-react';

export function Lighting({ devices, onSet }) {
  const lights = Object.values(devices).filter(d => d.class === 'light').slice(0, 4);
  const onCount = lights.filter(l => l.capabilities?.onoff).length;
  const anyOn = onCount > 0;

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
        <div role="group" aria-label="Skru alle lys av eller på" className="flex items-center gap-1 rounded-full border border-nx-line/60 p-0.5 text-[11px] font-mono">
          <button
            onClick={() => toggleAll(false)}
            aria-pressed={!anyOn}
            className={['px-2 py-0.5 rounded-full transition-colors', !anyOn ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute'].join(' ')}
          >Av</button>
          <button
            onClick={() => toggleAll(true)}
            aria-pressed={anyOn}
            className={['px-2 py-0.5 rounded-full transition-colors', anyOn ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute'].join(' ')}
          >På</button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => toggleAll(true)}
          aria-label="Skru på alle lys"
          className="rounded-xl border border-nx-line/60 bg-nx-panel/40 p-3 text-left"
        >
          <Power size={14} className="text-nx-cyan" aria-hidden="true" />
          <div className="mt-1 text-sm">Alle lys</div>
          <div className="text-[10px] text-nx-mute">{onCount}/{lights.length} på</div>
        </button>
        <button
          aria-label="Aktiver scene Hyggelig"
          className="rounded-xl border border-nx-cyan/40 bg-nx-cyan/10 p-3 text-left"
        >
          <div className="text-xs text-nx-cyan">Aktivitet</div>
          <div className="mt-1 text-sm">Hyggelig</div>
          <div className="text-[10px] text-nx-mute">forhåndsinnstilt scene</div>
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {lights.map(l => {
          const on = !!l.capabilities?.onoff;
          const dim = Math.round(((l.capabilities?.dim ?? 0) * 100));
          return (
            <li key={l.id} className="flex items-center gap-2">
              <button
                onClick={() => toggleOne(l)}
                aria-label={`${l.name} — ${on ? 'skru av' : 'skru på'}`}
                aria-pressed={on}
                className={[
                  'grid h-7 w-7 place-items-center rounded-md border transition-colors',
                  on ? 'border-nx-cyan/60 text-nx-cyan bg-nx-cyan/10 shadow-glow-soft' : 'border-nx-line/60 text-nx-mute'
                ].join(' ')}
              >
                <Lightbulb size={14} aria-hidden="true"/>
              </button>
              <span className="text-xs flex-1 truncate">{l.name}</span>
              <div
                className="w-24 h-1 rounded-full bg-nx-line/50 overflow-hidden"
                role="progressbar"
                aria-valuenow={on ? dim : 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${l.name} dim-nivå`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: on ? `${dim}%` : '0%',
                    background: 'linear-gradient(90deg,#22e6ff,#7d5cff)'
                  }}
                />
              </div>
              <span className="w-8 text-right text-[11px] font-mono text-nx-mute">
                {on ? `${dim}` : '–'}
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
