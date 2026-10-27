import { Activity, Lightbulb, Lock, Workflow, Thermometer, Footprints, DoorOpen, Siren } from 'lucide-react';

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

/** Klokkeslett, med dato når det ikke er i dag. */
function clock(ts) {
  const d = new Date(ts), now = new Date();
  const opts = { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' };
  const sameDay = d.toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo' }) === now.toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo' });
  return sameDay ? d.toLocaleTimeString('nb-NO', opts) : d.toLocaleString('nb-NO', { ...opts, day: 'numeric', month: 'short' });
}

const ICONS = {
  motion: Footprints,
  door: DoorOpen,
  alarm: Siren,
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
        <span className="text-[10px] uppercase tracking-[0.18em] text-nx-mute font-mono">Sensorer · 7 dager</span>
      </div>
      <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
        {(activity || []).map((ev, i) => {
          const Icon = ICONS[ev.type] || ICONS.default;
          const tone = ev.type === 'alarm' && ev.active ? 'bg-nx-red/15 text-nx-red' : ev.type === 'door' && ev.active ? 'bg-nx-amber/15 text-nx-amber' : 'bg-nx-cyan/10 text-nx-cyan';
          return (
            <li key={ev.id || i} className="flex items-start gap-2.5 rounded-lg border border-nx-line/40 bg-nx-panel/40 px-2.5 py-2">
              <div className={`grid h-7 w-7 place-items-center rounded-md shrink-0 ${tone}`}>
                <Icon size={14}/>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm leading-tight truncate">{ev.text}</div>
                <div className="mt-0.5 text-[11px] text-nx-mute font-mono" title={ev.timeSource === 'observert' ? 'Tidspunktet dashboardet så endringen' : 'Sensorens tidspunkt'}>
                  {clock(ev.ts)} · {timeAgo(ev.ts) === 'nå' ? 'nå' : `${timeAgo(ev.ts)} siden`}
                </div>
              </div>
            </li>
          );
        })}
        {(!activity || activity.length === 0) && (
          <li className="text-sm text-nx-mute">Ingen sensorhendelser registrert ennå. Bevegelse, dører, lås og alarmer logges fra nå av.</li>
        )}
      </ul>
    </div>
  );
}
