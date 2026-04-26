import { useEffect, useState } from 'react';
import { Download, Copy, RefreshCw, Check, Cpu, Layers, Zap as ZapIcon, Boxes } from 'lucide-react';
import { api } from '../lib/api.js';

/**
 * Lets the user run a full Homey discovery from the dashboard itself.
 * Replaces the need for the local CLI script — they can download the
 * inventory JSON directly or copy a summary, then share with Claude.
 */
export function DiscoveryPanel() {
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const data = await api.inventory();
      setInv(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function downloadFull() {
    setDownloading(true);
    try {
      const r = await fetch(`/api/homey/inventory?full=true`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homey-inventory-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    finally { setDownloading(false); }
  }

  async function copySummary() {
    if (!inv) return;
    const lines = [
      `# Gamlepappa Smarthus — Homey Inventory`,
      ``,
      `Generated: ${inv.generatedAt}`,
      ``,
      `## Sammendrag`,
      `- Enheter: ${inv.summary.devices}`,
      `- Rom: ${inv.summary.zones}`,
      `- Flows: ${inv.summary.flows} (${inv.summary.flowsEnabled} aktive)`,
      `- Unike drivere: ${inv.summary.uniqueDrivers}`,
      `- Unike capabilities: ${inv.summary.uniqueCapabilities}`,
      ``,
      `## Feature-flagg`,
      ...Object.entries(inv.featureFlags).map(([k, v]) => `- ${k}: ${v ? 'ja' : 'nei'}`),
      ``,
      `## Topp 15 enhetsklasser`,
      ...inv.classes.slice(0, 15).map(c => `- ${c.class}: ${c.count}`),
      ``,
      `## Topp 15 capabilities`,
      ...inv.capabilities.slice(0, 15).map(c => `- ${c.capability}: ${c.count}`),
      ``,
      `## Rom (${inv.zones.length})`,
      ...inv.zones.map(z => `- ${z.name}: ${z.deviceCount} enheter`),
      ``,
      `## Drivere (${inv.drivers.length})`,
      ...inv.drivers.slice(0, 20).map(d => `- ${d.driver}: ${d.count}`),
      ``,
      `## Spesielle enheter (${inv.specialDevices.length})`,
      ...inv.specialDevices.map(d => `- ${d.name} (class=${d.class}) caps=${d.capabilities.join(',')}`)
    ].join('\n');

    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError('Kunne ikke kopiere: ' + e.message);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="panel-title">Discovery</p>
          <h3 className="mt-1 text-lg font-semibold">Full kartlegging av Homey</h3>
          <p className="mt-1 text-xs text-nx-mute max-w-xl">
            Last ned hele enhetslisten og del med Claude for skreddersydde widgets.
            Krever ingen lokal terminal — alt skjer rett her.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={load} disabled={loading} className="btn text-xs" aria-label="Last inn på nytt">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            OPPDATER
          </button>
          <button onClick={copySummary} disabled={!inv} className="btn text-xs" aria-label="Kopier sammendrag">
            {copied ? <Check size={13} className="text-nx-green" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            {copied ? 'KOPIERT' : 'KOPIER SAMMENDRAG'}
          </button>
          <button
            onClick={downloadFull}
            disabled={downloading || !inv}
            className="btn-primary text-xs"
            aria-label="Last ned full inventar-JSON"
          >
            <Download size={13} aria-hidden="true" />
            {downloading ? 'PAKKER...' : 'LAST NED JSON'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-nx-red/40 bg-nx-red/10 px-3 py-2 text-sm text-nx-red">
          {error}
        </div>
      )}

      {loading && !inv && (
        <p className="mt-6 text-sm text-nx-mute">Henter inventar...</p>
      )}

      {inv && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SumCard Icon={Cpu}     label="Enheter"       value={inv.summary.devices} />
            <SumCard Icon={Layers}  label="Rom"           value={inv.summary.zones} />
            <SumCard Icon={Boxes}   label="Flows aktive"  value={`${inv.summary.flowsEnabled}/${inv.summary.flows}`} />
            <SumCard Icon={ZapIcon} label="Capabilities"  value={inv.summary.uniqueCapabilities} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BreakdownList title="Topp enhetsklasser" items={inv.classes.slice(0, 8)}
                           render={c => `${c.class}`} value={c => c.count} />
            <BreakdownList title="Topp capabilities" items={inv.capabilities.slice(0, 8)}
                           render={c => c.capability} value={c => c.count} />
          </div>

          <div>
            <h4 className="panel-title">Feature-flagg</h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(inv.featureFlags).map(([k, v]) => (
                <span key={k} className={[
                  'chip text-[11px]',
                  v ? 'text-nx-green border-nx-green/40' : 'text-nx-mute'
                ].join(' ')}>
                  <span className={['h-1.5 w-1.5 rounded-full', v ? 'bg-nx-green' : 'bg-nx-mute/40'].join(' ')} aria-hidden="true" />
                  {k}
                </span>
              ))}
            </div>
          </div>

          {inv.specialDevices.length > 0 && (
            <div>
              <h4 className="panel-title">
                Spesielle enheter ({inv.specialDevices.length}) — kandidater for egne widgets
              </h4>
              <ul className="mt-2 panel p-2 max-h-56 overflow-y-auto divide-y divide-nx-line/40">
                {inv.specialDevices.map(d => (
                  <li key={d.id} className="flex items-center gap-3 px-2 py-1.5">
                    <span className="text-sm flex-1 truncate" title={d.name}>{d.name}</span>
                    <span className="chip text-[10px] text-nx-cyan">{d.class}</span>
                    <span className="text-[10px] text-nx-mute font-mono truncate max-w-xs" title={d.capabilities.join(',')}>
                      {d.capabilities.length} caps
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-nx-mute font-mono">
            Generert {new Date(inv.generatedAt).toLocaleString('no-NO')}
          </p>
        </div>
      )}
    </div>
  );
}

function SumCard({ Icon, label, value }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-nx-cyan">
        <Icon size={14} aria-hidden="true" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-nx-mute">{label}</span>
      </div>
      <div className="mt-2 font-mono text-2xl">{value}</div>
    </div>
  );
}

function BreakdownList({ title, items, render, value }) {
  const max = Math.max(1, ...items.map(value));
  return (
    <div className="panel p-4">
      <h4 className="panel-title">{title}</h4>
      <ul className="mt-3 space-y-2">
        {items.map((it, i) => {
          const v = value(it);
          const pct = (v / max) * 100;
          return (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="w-32 truncate text-nx-text">{render(it)}</span>
              <div className="flex-1 h-1.5 rounded-full bg-nx-line/40 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#22e6ff,#7d5cff)' }}
                />
              </div>
              <span className="w-10 text-right font-mono text-nx-cyan">{v}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
