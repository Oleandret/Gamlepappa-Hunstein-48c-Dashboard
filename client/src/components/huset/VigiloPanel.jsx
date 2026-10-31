import { useEffect, useState } from 'react';
import { School, RefreshCw, Save, ChevronDown } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { field, primaryButton, time, dayLabel, osloDate } from './shared.js';

/**
 * Vigilo (skolens foreldreapp): telefonen går daglig inn i appen, leser meldingene til barna, lagrer
 * dem her og sender SMS til de som er valgt. Bare for eieren. Hver kjøring viser stegene og tekstene
 * på skjermene telefonen så, så leseren kan justeres hvis appen ser annerledes ut enn ventet.
 */
async function call(path = '', method = 'GET', body) {
  const r = await apiFetch(`/api/huset/admin/vigilo${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Noe gikk galt');
  return d;
}
const smallButton = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-nx-line/60 text-nx-mute hover:text-nx-text hover:border-nx-cyan/40 disabled:opacity-40';

export function VigiloPanel({ standalone }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(null);
  const [barnTekst, setBarnTekst] = useState('');
  useEffect(() => { call().then(d => { setData(d); setSettings(d.innstillinger); setBarnTekst(d.innstillinger.barn.join(', ')); }).catch(e => setError(e.message)); }, []);

  async function run(kind, fn) {
    setBusy(kind); setError(''); setNotice('');
    try { const d = await fn(); setData(d); setSettings(d.innstillinger); return d; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(null); }
  }
  const save = () => run('save', () => call('', 'PUT', { ...settings, barn: barnTekst.split(',').map(s => s.trim()).filter(Boolean) })).then(d => d && setNotice(d.innstillinger.aktiv ? `Vigilo leses hver dag kl. ${d.innstillinger.klokkeslett.replace(':', '.')}.` : 'Daglig lesing er av.'));
  const readNow = () => run('les', () => call('/les', 'POST')).then(d => { if (!d) return; const k = d.kjoring; setNotice(k.status === 'ok' ? `${k.nye} nye meldinger (${k.antall} på skjermen).` : `Stoppet: ${k.feil}`); setOpen(0); });
  const toggleRecipient = n => setSettings(s => ({ ...s, mottakere: s.mottakere.includes(n) ? s.mottakere.filter(x => x !== n) : [...s.mottakere, n] }));

  if (!data || !settings) return <p className={`panel p-4 text-sm ${error ? 'text-nx-amber' : 'text-nx-mute'}`}>{error || 'Laster …'}</p>;
  const pad = standalone ? 'p-4' : 'p-5';
  const byDay = data.meldinger.reduce((acc, m) => { const d = osloDate(m.funnet); (acc[d] ||= []).push(m); return acc; }, {});
  return (
    <div className="grid grid-cols-12 gap-3 lg:gap-4">
      <section className={`col-span-12 panel space-y-4 self-start ${pad} ${standalone ? 'order-2' : 'lg:col-span-5'}`}>
        <h2 className="panel-title flex items-center gap-2"><School size={16} className="text-nx-cyan" aria-hidden="true" />Vigilo · daglig lesing</h2>
        <p className="text-xs text-nx-mute">Telefonen åpner Vigilo, taster pinkoden, leser meldingene til barna og sender SMS om nye meldinger til de som er valgt. Pinkoden ligger på serveren som <code>VIGILO_PIN</code>, aldri her.</p>
        <p className="text-xs">iphone-remote: <strong>{data.configured ? 'satt opp' : 'ikke satt opp'}</strong> · Pinkode: <strong>{data.pinSet ? 'satt' : 'mangler (VIGILO_PIN)'}</strong> · SMS: <strong>{data.kanaler.sms ? 'satt opp' : 'ikke satt opp'}</strong></p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.aktiv} onChange={e => setSettings(s => ({ ...s, aktiv: e.target.checked }))} />Les Vigilo automatisk hver dag</label>
        <label className="block"><span className="text-xs text-nx-mute">Klokkeslett (norsk tid)</span><input type="time" value={settings.klokkeslett} onChange={e => setSettings(s => ({ ...s, klokkeslett: e.target.value }))} className={`${field} w-full mt-1`} /></label>
        <label className="block"><span className="text-xs text-nx-mute">Barn i Vigilo (kommaskilt, som navnene står i appen)</span><input value={barnTekst} onChange={e => setBarnTekst(e.target.value)} className={`${field} w-full mt-1`} /></label>
        <fieldset><legend className="text-xs text-nx-mute mb-2">Hvem skal få SMS om nye meldinger?</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{data.beboere.map(b => <label key={b.navn} className="flex items-center gap-2"><input type="checkbox" checked={settings.mottakere.includes(b.navn)} onChange={() => toggleRecipient(b.navn)} />{b.navn}{!b.telefon && <span className="text-xs text-nx-mute">(mangler mobil)</span>}</label>)}</div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryButton} disabled={!!busy} onClick={save}><Save size={14} aria-hidden="true" />Lagre</button>
          <button type="button" className={smallButton} disabled={!!busy || !data.configured} onClick={readNow}><RefreshCw size={14} aria-hidden="true" className={busy === 'les' ? 'animate-spin' : ''} />{busy === 'les' ? 'Leser … (tar et minutt)' : 'Les Vigilo nå'}</button>
        </div>
        {settings.sistKjort && <p className="text-xs text-nx-mute">Sist lest automatisk: {settings.sistKjort}</p>}
        {error && <p role="alert" className="text-sm text-nx-amber">{error}</p>}
        {notice && <p role="status" className="text-sm text-nx-cyan">{notice}</p>}
        <h3 className="text-xs uppercase tracking-[0.14em] text-nx-mute pt-2">Siste kjøringer</h3>
        {!data.logg.length ? <p className="text-xs text-nx-mute">Ingen kjøringer ennå.</p> : <ul className="space-y-1 text-xs">
          {data.logg.map((l, i) => <li key={l.at} className="rounded-lg border border-nx-line/40 p-2">
            <button type="button" className="w-full text-left flex items-center gap-2" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <ChevronDown size={12} className={open === i ? 'rotate-180' : ''} aria-hidden="true" /><span className="text-nx-mute">{time(l.at)}</span> · {l.kilde} · <span className={l.status === 'ok' ? 'text-nx-green' : 'text-nx-amber'}>{l.status === 'ok' ? `${l.nye} nye` : l.feil}</span>
            </button>
            {open === i && <div className="mt-2 space-y-2">
              <ol className="space-y-0.5">{l.steg.map((s, j) => <li key={j} className="flex gap-2"><span className="font-mono text-nx-mute">{new Date(s.at).toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span>{s.tekst}</span></li>)}</ol>
              {!!l.varsler?.length && <p>{l.varsler.map(v => `SMS ${v.navn}: ${v.status}${v.feil ? ` (${v.feil})` : ''}`).join(' · ')}</p>}
              {!!l.skjermer?.length && <details><summary className="cursor-pointer text-nx-mute">Skjermene telefonen så ({l.skjermer.length})</summary>
                {l.skjermer.map((s, j) => <div key={j} className="mt-1"><p className="font-semibold">{s.navn}</p><p className="text-nx-mute break-words">{s.tekster.join(' · ') || '(ingen tekst)'}</p></div>)}</details>}
            </div>}
          </li>)}
        </ul>}
      </section>

      <section className={`col-span-12 panel ${pad} ${standalone ? 'order-1' : 'lg:col-span-7'}`}>
        <h2 className="panel-title">Meldinger fra Vigilo · {data.meldinger.length}</h2>
        {!data.meldinger.length && <p className="text-sm text-nx-mute mt-3">Ingen meldinger lest ennå. Trykk «Les Vigilo nå» for å prøve.</p>}
        {Object.entries(byDay).map(([day, items]) => <div key={day} className="mt-4">
          <h3 className="text-xs uppercase tracking-[0.14em] text-nx-mute">{dayLabel(day)}</h3>
          <ul className="mt-1 divide-y divide-nx-line/40">
            {items.map(m => <li key={m.id} className="py-2.5">
              <p className="text-sm"><strong>{m.barn}</strong>{m.linjer[0] && <span className="text-nx-mute"> · {m.linjer[0]}</span>}</p>
              {m.linjer.slice(1).map((l, i) => <p key={i} className="text-sm mt-0.5 break-words">{l}</p>)}
              <p className="text-xs text-nx-mute mt-0.5">Lest {time(m.funnet)}</p>
            </li>)}
          </ul>
        </div>)}
      </section>
    </div>
  );
}
