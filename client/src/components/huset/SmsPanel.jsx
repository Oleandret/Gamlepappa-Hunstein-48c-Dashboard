import { useState } from 'react';
import { Smartphone, PlugZap, Send, CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';

/**
 * «Send SMS med iPhone»: test koblingen mot iPhonens MCP (sender ingenting)
 * og send én SMS for å se at alt virker, med steg-logg fra serveren.
 * Bare for eieren (samme tilgang som Beboere).
 */
const field = 'rounded-lg border border-nx-line/60 bg-nx-bg px-3 py-2 text-sm text-nx-text';
const time = t => new Date(t).toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function SmsPanel() {
  const [til, setTil] = useState(''), [tekst, setTekst] = useState('Test fra Huset 👋');
  const [busy, setBusy] = useState(null), [result, setResult] = useState(null);

  async function run(kind) {
    setBusy(kind); setResult(null);
    try {
      const r = await apiFetch(`/api/huset/admin/sms/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: kind === 'send' ? JSON.stringify({ til, tekst }) : '{}' });
      const d = await r.json().catch(() => ({}));
      setResult({ kind, ...(r.ok ? d : { ok: false, steps: [], error: d.error || `Serveren svarte ${r.status}` }) });
    } catch { setResult({ kind, ok: false, steps: [], error: 'Fikk ikke kontakt med serveren' }); }
    finally { setBusy(null); }
  }

  return (
    <section className="panel p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Smartphone size={18} className="text-nx-cyan" />Send SMS med iPhone</h2>
        <p className="text-sm text-nx-mute mt-1">SMS-er fra Huset (avvik, påminnelser og koder) sendes fra «Mini sin iPhone» via iphone-remote. Her kan du teste koblingen og sende en SMS selv.</p>
      </div>

      <div className="rounded-xl border border-nx-line/60 p-4 space-y-2">
        <h3 className="text-sm font-medium">1. Test koblingen</h3>
        <p className="text-xs text-nx-mute">Logger inn hos iphone-remote, spør telefonens MCP hvilken telefon som er tilkoblet, og leser skjermen. Ingenting sendes.</p>
        <button type="button" onClick={() => run('test')} disabled={!!busy} className="chip inline-flex items-center gap-1.5"><PlugZap size={14} />{busy === 'test' ? 'Tester …' : 'Test koblingen'}</button>
      </div>

      <form className="rounded-xl border border-nx-line/60 p-4 space-y-3" onSubmit={e => { e.preventDefault(); run('send'); }}>
        <h3 className="text-sm font-medium">2. Send en SMS</h3>
        <label className="block"><span className="text-xs text-nx-mute">Til (8 siffer eller +landskode)</span>
          <input value={til} onChange={e => setTil(e.target.value)} inputMode="tel" placeholder="99 99 99 99" className={`${field} w-full mt-1`} required /></label>
        <label className="block"><span className="text-xs text-nx-mute">Melding</span>
          <textarea value={tekst} onChange={e => setTekst(e.target.value)} maxLength={1000} rows={3} className={`${field} w-full mt-1`} required /></label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={!!busy || !til.trim() || !tekst.trim()} className="chip inline-flex items-center gap-1.5 border-nx-cyan/50 text-nx-cyan"><Send size={14} />{busy === 'send' ? 'Sender … (tar noen sekunder)' : 'Send SMS'}</button>
          <span className="text-xs text-nx-mute">Telefonen gjør jobben på skjermen. Du kan følge med i telefonpanelet til høyre.</span>
        </div>
      </form>

      {result && (
        <div className={`rounded-xl border p-4 ${result.ok ? 'border-nx-green/40' : 'border-nx-amber/40'}`} role="status">
          <p className={`text-sm font-medium flex items-center gap-2 ${result.ok ? 'text-nx-green' : 'text-nx-amber'}`}>
            {result.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {result.ok ? (result.kind === 'send' ? `SMS sendt til ${result.til}` : 'Koblingen virker') : (result.error || 'Feilet')}
          </p>
          {result.steps?.length > 0 && (
            <ol className="mt-2 space-y-1 text-xs">
              {result.steps.map((s, i) => <li key={i} className="flex gap-2"><span className="font-mono text-nx-mute">{time(s.at)}</span><span>{s.tekst}</span></li>)}
              {!result.ok && <li className="flex gap-2 text-nx-amber"><span className="font-mono">—</span><span>Stoppet her: {result.error}</span></li>}
            </ol>
          )}
          {result.configured === false && <p className="text-xs text-nx-mute mt-2">Sett IPHONE_REMOTE_URL, IPHONE_REMOTE_USER, IPHONE_REMOTE_PASSWORD og IPHONE_MCP_TOKEN i Railway.</p>}
        </div>
      )}
    </section>
  );
}
