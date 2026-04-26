import { useMemo } from 'react';
import { AlertTriangle, BatteryLow, WifiOff, AlertOctagon, CheckCircle2, Droplets, Flame } from 'lucide-react';
import { capValue, hasCap, classLabel } from '../../lib/deviceUtils.js';

/**
 * Helse- / vedlikeholds-fane: filtrerer enheter på problem-status og
 * viser dem gruppert slik at man raskt ser hva som må byttes/fikses.
 *
 * Kategorier:
 *  - Offline (`available === false`)
 *  - Lavt batteri (alarm_battery true ELLER measure_battery < 20)
 *  - Aktive alarmer (røyk/vann/kontakt/bevegelse)
 *  - Lav signalstyrke ("warning" property hvis tilgjengelig)
 */

const BATTERY_LOW_PCT = 20;
const BATTERY_WARN_PCT = 40;

function classifyDevice(d) {
  const issues = [];

  // Offline / ikke tilgjengelig
  if (d.available === false) issues.push('offline');

  // Batteri
  const batteryAlarm = capValue(d, 'alarm_battery') === true;
  const batteryPct = capValue(d, 'measure_battery');
  if (batteryAlarm || (Number.isFinite(batteryPct) && batteryPct < BATTERY_LOW_PCT)) {
    issues.push('battery-low');
  } else if (Number.isFinite(batteryPct) && batteryPct < BATTERY_WARN_PCT) {
    issues.push('battery-warn');
  }

  // Aktive alarmer
  if (capValue(d, 'alarm_smoke') === true) issues.push('smoke');
  if (capValue(d, 'alarm_water') === true) issues.push('water');

  // Generell device-warning hvis serveren rapporterer det
  if (d.flags && Array.isArray(d.flags) && d.flags.includes('warning')) issues.push('warning');
  if (d.warning) issues.push('warning');

  return issues;
}

export function MaintenanceView({ devices, zones }) {
  const all = useMemo(() => Object.values(devices || {}), [devices]);

  const grouped = useMemo(() => {
    const offline = [];
    const batteryLow = [];
    const batteryWarn = [];
    const smokeAlarms = [];
    const waterAlarms = [];
    const warnings = [];

    for (const d of all) {
      const issues = classifyDevice(d);
      if (issues.includes('offline')) offline.push(d);
      if (issues.includes('battery-low')) batteryLow.push({ d, pct: capValue(d, 'measure_battery') });
      else if (issues.includes('battery-warn')) batteryWarn.push({ d, pct: capValue(d, 'measure_battery') });
      if (issues.includes('smoke')) smokeAlarms.push(d);
      if (issues.includes('water')) waterAlarms.push(d);
      if (issues.includes('warning') && !issues.includes('offline')) warnings.push(d);
    }

    // Batteri sorteres med lavest prosent først
    batteryLow.sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
    batteryWarn.sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));

    return { offline, batteryLow, batteryWarn, smokeAlarms, waterAlarms, warnings };
  }, [all]);

  const totalIssues = grouped.offline.length + grouped.batteryLow.length
                    + grouped.smokeAlarms.length + grouped.waterAlarms.length
                    + grouped.warnings.length;

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 panel p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="panel-title">Vedlikehold</p>
            <h1 className="text-xl font-semibold mt-1">
              {totalIssues === 0
                ? <span className="text-nx-green inline-flex items-center gap-2"><CheckCircle2 size={20}/> Alt fungerer</span>
                : <span>{totalIssues} {totalIssues === 1 ? 'sak' : 'saker'} trenger oppmerksomhet</span>}
            </h1>
            <p className="text-xs text-nx-mute mt-1">
              Oversikt over enheter som er offline, har lavt batteri, eller en aktiv alarm. Sjekkes hver gang dashbordet poller Homey.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge label="OK" count={all.length - totalIssues} tone="green" />
            <Badge label="Offline" count={grouped.offline.length} tone="red" />
            <Badge label="Lavt batteri" count={grouped.batteryLow.length} tone="amber" />
            <Badge label="Alarmer" count={grouped.smokeAlarms.length + grouped.waterAlarms.length} tone="red" />
          </div>
        </div>
      </div>

      {grouped.smokeAlarms.length > 0 && (
        <Section
          title="Aktiv røykalarm"
          subtitle="Sjekk umiddelbart!"
          icon={Flame}
          tone="red"
          devices={grouped.smokeAlarms}
          zones={zones}
          render={(d) => <span className="text-nx-red font-mono">RØYK</span>}
        />
      )}

      {grouped.waterAlarms.length > 0 && (
        <Section
          title="Vannlekkasje"
          subtitle="Lekkasje rapportert"
          icon={Droplets}
          tone="red"
          devices={grouped.waterAlarms}
          zones={zones}
          render={(d) => <span className="text-nx-red font-mono">VANN</span>}
        />
      )}

      {grouped.offline.length > 0 && (
        <Section
          title="Offline"
          subtitle="Enheter som ikke svarer"
          icon={WifiOff}
          tone="red"
          devices={grouped.offline}
          zones={zones}
          render={(d) => <span className="text-nx-red font-mono">offline</span>}
        />
      )}

      {grouped.batteryLow.length > 0 && (
        <Section
          title="Lavt batteri"
          subtitle="Bør byttes snart"
          icon={BatteryLow}
          tone="amber"
          devices={grouped.batteryLow.map(x => x.d)}
          zones={zones}
          render={(d) => {
            const pct = capValue(d, 'measure_battery');
            return Number.isFinite(pct)
              ? <span className="text-nx-red font-mono tabular-nums">{Math.round(pct)} %</span>
              : <span className="text-nx-red font-mono">lavt</span>;
          }}
        />
      )}

      {grouped.batteryWarn.length > 0 && (
        <Section
          title="Batteri 20-40%"
          subtitle="Følg med — bør planlegges bytte"
          icon={BatteryLow}
          tone="amber-soft"
          devices={grouped.batteryWarn.map(x => x.d)}
          zones={zones}
          render={(d) => {
            const pct = capValue(d, 'measure_battery');
            return <span className="text-nx-amber font-mono tabular-nums">{Math.round(pct)} %</span>;
          }}
        />
      )}

      {grouped.warnings.length > 0 && (
        <Section
          title="Andre advarsler"
          subtitle="Driftsadvarsler fra Homey"
          icon={AlertOctagon}
          tone="amber"
          devices={grouped.warnings}
          zones={zones}
          render={(d) => <span className="text-nx-amber font-mono">advarsel</span>}
        />
      )}

      {totalIssues === 0 && (
        <div className="col-span-12 panel p-8 text-center">
          <CheckCircle2 size={48} className="mx-auto text-nx-green mb-3" />
          <p className="text-lg font-semibold">Alle enheter ser bra ut</p>
          <p className="text-xs text-nx-mute mt-1 max-w-md mx-auto">
            Ingen enheter er offline, ingen har lavt batteri, og det er ingen aktive alarmer. Dette oppdateres automatisk hver gang dashbordet henter data fra Homey.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, icon: Icon, tone, devices, zones, render }) {
  const toneClasses = {
    red:        { border: 'border-nx-red/45', text: 'text-nx-red',    iconBg: 'bg-nx-red/15' },
    amber:      { border: 'border-nx-amber/45', text: 'text-nx-amber', iconBg: 'bg-nx-amber/15' },
    'amber-soft': { border: 'border-nx-amber/25', text: 'text-nx-amber', iconBg: 'bg-nx-amber/10' },
    cyan:       { border: 'border-nx-cyan/45', text: 'text-nx-cyan',  iconBg: 'bg-nx-cyan/15' }
  }[tone] || { border: 'border-nx-line/60', text: 'text-nx-mute', iconBg: 'bg-nx-panel/40' };

  return (
    <div className={`col-span-12 panel p-4 border ${toneClasses.border}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${toneClasses.iconBg} ${toneClasses.text}`}>
          <Icon size={18} aria-hidden="true" />
        </div>
        <div>
          <p className={`panel-title ${toneClasses.text}`}>{title} ({devices.length})</p>
          <p className="text-xs text-nx-mute">{subtitle}</p>
        </div>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {devices.map(d => (
          <li key={d.id} className="flex items-center gap-2 rounded-lg border border-nx-line/40 bg-nx-panel/40 px-2.5 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <div className="text-sm leading-tight truncate" title={d.name}>{d.name}</div>
              <div className="text-[10px] text-nx-mute font-mono truncate">
                {classLabel(d.class)}
                {d.zone && zones?.[d.zone]?.name && <span> · {zones[d.zone].name}</span>}
              </div>
            </div>
            <div className="text-xs shrink-0">{render(d)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Badge({ label, count, tone }) {
  const cls = {
    green: 'border-nx-green/40 text-nx-green',
    red:   'border-nx-red/40 text-nx-red',
    amber: 'border-nx-amber/40 text-nx-amber'
  }[tone] || 'border-nx-line/40 text-nx-mute';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] ${cls}`}>
      <span>{label}</span>
      <span className="tabular-nums">{count}</span>
    </span>
  );
}
