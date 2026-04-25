import { Activity, Lightbulb, Lock, Workflow, Thermometer } from 'lucide-react';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'nå';
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} t`;
  const d = Math.round(h / 24);
  return `${d} d`;
}

const ICONS = {
  flow: Workflow,
  light: Lightbulb,
  thermo: Thermometer,
  security: Lock,
  default: Activity
};

export function ActivityFeed({ activity }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="panel-title">Aktivitet</p>
        <span className="text-[10px] uppercase tracking-[0.18em] text-nx-mute font-mono">SE ALLE</span>
      </div>
      <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
        {(activity || []).map((ev, i) => {
          const Icon = ICONS[ev.type] || ICONS.default;
          return (
            <li key={i} className="flex items-start gap-2.5 rounded-lg border border-nx-line/40 bg-nx-panel/40 px-2.5 py-2">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-nx-cyan/10 text-nx-cyan shrink-0">
                <Icon size={14}/>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm leading-tight truncate">{ev.text}</div>
                <div className="mt-0.5 text-[11px] text-nx-mute font-mono">{timeAgo(ev.ts)}</div>
              </div>
            </li>
          );
        })}
        {(!activity || activity.length === 0) && (
          <li className="text-sm text-nx-mute">Ingen aktivitet enda.</li>
        )}
      </ul>
    </div>
  );
}
