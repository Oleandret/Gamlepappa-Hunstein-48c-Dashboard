import { useMemo, useState } from 'react';
import { Lightbulb, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Belysning gruppert per rom med toggle og dim-slider per lampe.
 * Hver gruppe kan kollapses, og hele rommet kan slås av/på samlet.
 */
export function Lighting({ devices, zones, onSet }) {
  const [collapsed, setCollapsed] = useState(new Set());

  const groups = useMemo(() => {
    const all = Object.values(devices || {});
    const lights = all.filter(d => d.class === 'light' || d.capabilities?.dim != null);
    const byZone = new Map();
    for (const l of lights) {
      const zone = zones?.[l.zone];
      const key = zone?.id || '_none';
      const name = zone?.name || 'Uten rom';
      if (!byZone.has(key)) byZone.set(key, { id: key, name, lights: [] });
      byZone.get(key).lights.push(l);
    }
    return [...byZone.values()]
      .map(g => ({ ...g, lights: g.lights.sort((a, b) => (a.name || '').localeCompare(b.name || '')) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [devices, zones]);

  const totalOn = groups.reduce((s, g) => s + g.lights.filter(l => l.capabilities?.onoff).length, 0);
  const totalLights = groups.reduce((s, g) => s + g.lights.length, 0);

  function toggleAll(on) {
    groups.forEach(g => g.lights.forEach(l => onSet(l.id, 'onoff', on)));
  }

  function toggleZone(zoneId, on) {
    const g = groups.find(g => g.id === zoneId);
    if (!g) return;
    g.lights.forEach(l => onSet(l.id, 'onoff', on));
  }

  function toggleCollapsed(id) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="panel-title">Belysning</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-nx-mute">{totalOn}/{totalLights}</span>
          <div role="group" aria-label="Skru alle lys av eller på" className="flex items-center gap-1 rounded-full border border-nx-line/60 p-0.5 text-[10px] font-mono">
            <button
              onClick={() => toggleAll(false)}
              aria-pressed={totalOn === 0}
              className={['px-2 py-0.5 rounded-full transition-colors', totalOn === 0 ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute'].join(' ')}
            >Alle av</button>
            <button
              onClick={() => toggleAll(true)}
              aria-pressed={totalOn > 0}
              className={['px-2 py-0.5 rounded-full transition-colors', totalOn > 0 ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute'].join(' ')}
            >Alle på</button>
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
        {groups.map(g => {
          const onCount = g.lights.filter(l => l.capabilities?.onoff).length;
          const isCollapsed = collapsed.has(g.id);
          const allOn = onCount === g.lights.length;
          return (
            <div key={g.id} className="border border-nx-line/40 rounded-lg overflow-hidden">
              {/* Rom-header */}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-nx-panel/40">
                <button
                  onClick={() => toggleCollapsed(g.id)}
                  aria-label={isCollapsed ? `Vis lys i ${g.name}` : `Skjul lys i ${g.name}`}
                  className="text-nx-mute hover:text-nx-cyan"
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>
                <span className="text-xs font-mono uppercase tracking-[0.16em] text-nx-mute flex-1 truncate">
                  {g.name}
                </span>
                <span className="text-[10px] font-mono text-nx-cyan tabular-nums">
                  {onCount}/{g.lights.length}
                </span>
                <button
                  onClick={() => toggleZone(g.id, !allOn)}
                  aria-label={allOn ? `Skru av alle lys i ${g.name}` : `Skru på alle lys i ${g.name}`}
                  className={[
                    'h-5 px-2 rounded-full text-[9px] font-mono uppercase border transition-colors',
                    allOn
                      ? 'border-nx-cyan/60 bg-nx-cyan/15 text-nx-cyan'
                      : 'border-nx-line/60 text-nx-mute hover:border-nx-cyan/40 hover:text-nx-cyan'
                  ].join(' ')}
                >
                  {allOn ? 'av' : 'på'}
                </button>
              </div>

              {/* Lampe-liste */}
              {!isCollapsed && (
                <ul className="divide-y divide-nx-line/30">
                  {g.lights.map(l => <LightRow key={l.id} light={l} onSet={onSet} />)}
                </ul>
              )}
            </div>
          );
        })}
        {groups.length === 0 && (
          <p className="text-sm text-nx-mute">Fant ingen lys i Homey.</p>
        )}
      </div>
    </div>
  );
}

function LightRow({ light, onSet }) {
  const on = !!light.capabilities?.onoff;
  const dim = light.capabilities?.dim ?? 0;
  const supportsDim = light.capabilities?.dim != null || light.capabilitiesObj?.dim != null;

  return (
    <li className="flex items-center gap-2 px-2 py-1.5">
      <button
        onClick={() => onSet(light.id, 'onoff', !on)}
        aria-label={`${light.name} — ${on ? 'skru av' : 'skru på'}`}
        aria-pressed={on}
        className={[
          'grid h-6 w-6 place-items-center rounded-md border transition-colors shrink-0',
          on ? 'border-nx-cyan/60 text-nx-cyan bg-nx-cyan/10 shadow-glow-soft' : 'border-nx-line/60 text-nx-mute'
        ].join(' ')}
      >
        <Lightbulb size={11} aria-hidden="true" />
      </button>
      <span className="text-xs flex-1 truncate" title={light.name}>{light.name}</span>
      {supportsDim ? (
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(dim * 100)}
          onChange={(e) => {
            const v = Number(e.target.value) / 100;
            // Slå på lyset automatisk hvis det er av og brukeren drar opp
            if (!on && v > 0) onSet(light.id, 'onoff', true);
            onSet(light.id, 'dim', v);
          }}
          aria-label={`${light.name} dim-nivå`}
          className="w-20 accent-nx-cyan"
          disabled={!on}
        />
      ) : (
        <div className="w-20" />
      )}
      <span className="w-8 text-right text-[10px] font-mono text-nx-mute tabular-nums">
        {supportsDim && on ? `${Math.round(dim * 100)}%` : on ? 'PÅ' : '–'}
      </span>
    </li>
  );
}
