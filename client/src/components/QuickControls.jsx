import { Home, LogOut, Moon, Plane, Sun, Sunrise } from 'lucide-react';

const QUICK = [
  { match: ['hjemmemodus','hjem'],     label: 'Hjemmemodus',  Icon: Home },
  { match: ['bortemodus','borte'],     label: 'Bortemodus',   Icon: LogOut },
  { match: ['nattmodus','natt'],       label: 'Nattmodus',    Icon: Moon },
  { match: ['feriemodus','ferie'],     label: 'Feriemodus',   Icon: Plane },
  { match: ['god morgen','morgen'],    label: 'God morgen',   Icon: Sunrise },
  { match: ['god natt'],               label: 'God natt',     Icon: Sun }
];

export function QuickControls({ flows, onRun }) {
  const list = Object.values(flows || {});
  function findFlow(matches) {
    return list.find(f => matches.some(m => (f.name || '').toLowerCase().includes(m)));
  }
  return (
    <div>
      <p className="panel-title">Hurtigkontroller</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {QUICK.map(({ match, label, Icon }) => {
          const flow = findFlow(match);
          return (
            <button
              key={label}
              onClick={() => flow && onRun(flow.id)}
              className={[
                'group flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all',
                flow
                  ? 'border-nx-line/70 bg-nx-panel/60 hover:border-nx-cyan/60 hover:text-nx-cyan'
                  : 'border-nx-line/40 bg-nx-panel/30 text-nx-mute opacity-60'
              ].join(' ')}
            >
              <Icon size={16} className="text-nx-cyan group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
