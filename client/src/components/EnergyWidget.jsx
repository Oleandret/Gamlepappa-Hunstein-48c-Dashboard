import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingDown, TrendingUp, Zap } from 'lucide-react';

export function EnergyWidget({ energy }) {
  if (!energy) {
    return (
      <div>
        <p className="panel-title">Energiforbruk</p>
        <div className="mt-3 text-sm text-nx-mute">Ingen energidata tilgjengelig.</div>
      </div>
    );
  }
  const points = (energy.points || []).map(p => ({ ...p, hour: p.hour ?? '' }));
  const trendDown = (energy.today?.trend ?? 0) <= 0;
  const TrendIcon = trendDown ? TrendingDown : TrendingUp;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="panel-title">Energiforbruk</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-3xl font-semibold font-mono">{energy.today?.kwh ?? '—'}</span>
            <span className="text-xs text-nx-mute">kWh i dag</span>
            <span className={[
              'flex items-center gap-1 text-xs font-mono',
              trendDown ? 'text-nx-green' : 'text-nx-amber'
            ].join(' ')}>
              <TrendIcon size={12} /> {Math.abs(energy.today?.trend ?? 0)}%
            </span>
          </div>
          <p className="text-xs text-nx-mute mt-1">vs. samme dag forrige uke</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="chip text-xs">
            <Zap size={12} className="text-nx-cyan" />
            <span className="font-mono">{energy.live?.watts ?? '—'} W</span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-nx-mute">Sol: {energy.live?.solar ?? 0} W</span>
        </div>
      </div>

      <div className="mt-3 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ left: -20, right: 0, top: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="enArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22e6ff" stopOpacity={0.5}/>
                <stop offset="100%" stopColor="#22e6ff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#7c8aa8' }} axisLine={false} tickLine={false}/>
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#0b1322', border: '1px solid #1c2a44', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#7c8aa8' }}
              formatter={(v) => [`${(+v).toFixed(2)} kWh`, 'forbruk']}
              labelFormatter={(h) => `kl. ${String(h).padStart(2, '0')}`}
            />
            <Area type="monotone" dataKey="kwh" stroke="#22e6ff" strokeWidth={2} fill="url(#enArea)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
