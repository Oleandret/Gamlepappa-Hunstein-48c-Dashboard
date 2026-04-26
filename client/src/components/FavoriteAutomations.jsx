import { Play, Workflow } from 'lucide-react';

export function FavoriteAutomations({ flows, onRun }) {
  const list = Object.values(flows || {})
    .filter(f => f.enabled)
    .slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="panel-title">Favorittautomasjoner</p>
        <span className="text-[10px] uppercase tracking-[0.18em] text-nx-mute font-mono">SE ALLE</span>
      </div>

      <ul className="mt-3 space-y-2">
        {list.map(f => (
          <li
            key={f.id}
            className="group flex items-center gap-3 rounded-xl border border-nx-line/50 bg-nx-panel/40 px-2.5 py-2 hover:border-nx-cyan/50"
          >
            <div className="grid h-8 w-8 place-items-center rounded-md bg-nx-cyan/10 text-nx-cyan" aria-hidden="true">
              <Workflow size={14}/>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm leading-tight truncate">{f.name}</div>
              <div className="text-[11px] text-nx-mute font-mono">{f.folder || 'automasjon'}</div>
            </div>
            <button
              onClick={() => onRun(f.id)}
              aria-label={`Kjør ${f.name}`}
              className="grid h-7 w-7 place-items-center rounded-full bg-nx-cyan/10 text-nx-cyan opacity-70 group-hover:opacity-100 hover:bg-nx-cyan/20"
            >
              <Play size={12} aria-hidden="true"/>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="text-sm text-nx-mute">Ingen flows funnet.</li>}
      </ul>
    </div>
  );
}
