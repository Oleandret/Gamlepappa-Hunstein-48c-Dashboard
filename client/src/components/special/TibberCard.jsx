import { Zap, Coins, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { capValue } from '../../lib/deviceUtils.js';

/** Custom widget for Tibber Pulse — 3-phase live power, daily cost, totals. */
export function TibberCard({ device }) {
  if (!device) return null;
  const livePower = capValue(device, 'measure_power');
  const cost = capValue(device, 'accumulatedCost');
  const totalKwh = capValue(device, 'meter_power');
  const imported = capValue(device, 'meter_power.imported');
  const exported = capValue(device, 'meter_power.exported');
  const l1 = capValue(device, 'measure_current.L1');
  const l2 = capValue(device, 'measure_current.L2');
  const l3 = capValue(device, 'measure_current.L3');
  const phases = [l1, l2, l3].filter(v => v != null);

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-nx-cyan/15 text-nx-cyan shadow-glow-soft">
          <Zap size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">{device.name}</div>
          <div className="text-[10px] text-nx-mute font-mono uppercase tracking-[0.18em]">Tibber Pulse</div>
        </div>
      </header>

      {livePower != null && (
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl text-nx-cyan">{Math.round(livePower).toLocaleString('no-NO')}</span>
          <span className="text-nx-mute text-sm">W nå</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        {cost != null && (
          <Stat
            Icon={Coins}
            label="I dag"
            value={`${Number(cost).toFixed(2)} kr`}
            tone="green"
          />
        )}
        {totalKwh != null && (
          <Stat label="Forbruk i dag" value={`${Number(totalKwh).toFixed(1)} kWh`} />
        )}
        {imported != null && (
          <Stat
            Icon={ArrowDownRight}
            label="Totalt importert"
            value={`${Math.round(imported / 1000).toLocaleString('no-NO')} MWh`}
          />
        )}
        {exported != null && (
          <Stat
            Icon={ArrowUpRight}
            label="Totalt eksportert"
            value={`${Number(exported).toFixed(1)} kWh`}
            tone="green"
          />
        )}
      </div>

      {phases.length > 0 && (
        <div>
          <p className="panel-title">3-fase strøm (A)</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {[
              { label: 'L1', value: l1 },
              { label: 'L2', value: l2 },
              { label: 'L3', value: l3 }
            ].map(p => p.value != null && (
              <div key={p.label} className="rounded border border-nx-line/40 bg-nx-panel/40 px-2 py-1.5 text-center">
                <div className="text-[9px] uppercase tracking-[0.18em] text-nx-mute">{p.label}</div>
                <div className={[
                  'font-mono text-sm',
                  p.value < 0 ? 'text-nx-green' : 'text-nx-cyan'
                ].join(' ')}>
                  {Number(p.value).toFixed(1)}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-nx-mute font-mono">negative verdier = produksjon (sol)</p>
        </div>
      )}
    </div>
  );
}

function Stat({ Icon, label, value, tone }) {
  return (
    <div className="rounded border border-nx-line/40 bg-nx-panel/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.18em] text-nx-mute flex items-center gap-1">
        {Icon && <Icon size={10} aria-hidden="true" />}{label}
      </div>
      <div className={['font-mono text-sm', tone === 'green' ? 'text-nx-green' : 'text-nx-text'].join(' ')}>{value}</div>
    </div>
  );
}
