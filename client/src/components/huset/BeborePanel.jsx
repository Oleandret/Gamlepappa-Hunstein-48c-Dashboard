import { useEffect, useState } from 'react';
import { Link2, Send, Save, KeyRound } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { field, primaryButton, time } from './shared.js';

// Bare for eieren: beboernes e-post/telefon, innlogging og daglige påminnelser.
async function call(path = '', method = 'GET', body) {
  const r = await apiFetch(`/api/huset/admin${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Noe gikk galt');
  return d;
}
const smallButton = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-nx-line/60 text-nx-mute hover:text-nx-text hover:border-nx-cyan/40 disabled:opacity-40';

function ResidentCard({ b, busy, onSave, onInvite, onRemovePassword, onTest, kanaler }) {
  const [f, setF] = useState(b);
  useEffect(() => setF(b), [b]);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const dirty = ['epost', 'telefon', 'epostVarsel', 'smsVarsel'].some(k => f[k] !== b[k]);
  return <li className="py-4">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <p className="font-semibold">{b.navn}</p>
      <p className="text-xs text-nx-mute">{b.harPassord ? 'Har innlogging' : b.invitasjonAktiv ? 'Invitasjon sendt' : 'Ingen innlogging ennå'}</p>
    </div>
    <div className="grid sm:grid-cols-2 gap-3 mt-2">
      <label className="block"><span className="text-xs text-nx-mute">E-post</span><input type="email" value={f.epost} onChange={e => set('epost', e.target.value)} className={`${field} w-full mt-1`} /></label>
      <label className="block"><span className="text-xs text-nx-mute">Mobil</span><input type="tel" value={f.telefon} onChange={e => set('telefon', e.target.value)} placeholder="8 siffer eller +landskode" className={`${field} w-full mt-1`} /></label>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-nx-mute">
      <label className="flex items-center gap-2"><input type="checkbox" checked={f.epostVarsel} disabled={!f.epost} onChange={e => set('epostVarsel', e.target.checked)} />Påminnelse på e-post{!kanaler.epost && ' (ikke satt opp)'}</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={f.smsVarsel} disabled={!f.telefon} onChange={e => set('smsVarsel', e.target.checked)} />Påminnelse på SMS{!kanaler.sms && ' (ikke satt opp)'}</label>
    </div>
    <div className="flex flex-wrap gap-2 mt-3">
      <button type="button" className={smallButton} disabled={busy || !dirty} onClick={() => onSave(f)}><Save size={14} aria-hidden="true" />Lagre</button>
      <button type="button" className={smallButton} disabled={busy} onClick={() => onInvite(b.navn)}><Link2 size={14} aria-hidden="true" />Invitasjonslenke</button>
      <button type="button" className={smallButton} disabled={busy || (!b.epostVarsel && !b.smsVarsel)} onClick={() => onTest(b.navn)}><Send size={14} aria-hidden="true" />Send testpåminnelse</button>
      {b.harPassord && <button type="button" className={smallButton} disabled={busy} onClick={() => onRemovePassword(b.navn)}><KeyRound size={14} aria-hidden="true" />Fjern passord</button>}
    </div>
  </li>;
}

export function BeborePanel({ standalone }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [settings, setSettings] = useState({ aktiv: false, klokkeslett: '07:30' });
  useEffect(() => { call().then(d => { setData(d); setSettings(d.paaminnelser); }).catch(e => setError(e.message)); }, []);

  async function run(fn, done) {
    setBusy(true); setError(''); setNotice(null);
    try { const d = await fn(); if (d.beboere) { setData(d); setSettings(d.paaminnelser); } done?.(d); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const save = f => run(() => call(`/beboer/${encodeURIComponent(f.navn)}`, 'PUT', f), () => setNotice({ text: `${f.navn} er lagret.` }));
  const invite = navn => run(() => call(`/beboer/${encodeURIComponent(navn)}/invitasjon`, 'POST'), d => { setNotice({ text: `Invitasjonslenke for ${navn} (gjelder i 7 dager, kan brukes én gang). Send den til ${navn}:`, link: d.lenke }); call().then(setData); });
  const removePassword = navn => { if (window.confirm(`Fjerne passordet til ${navn}? ${navn} blir logget ut og må lage nytt passord.`)) run(() => call(`/beboer/${encodeURIComponent(navn)}/passord`, 'DELETE')); };
  const test = navn => run(() => call('/paaminnelser/test', 'POST', { navn }), d => setNotice({ text: (d.sendt || []).map(s => `${s.kanal}: ${s.status}${s.feil ? ` (${s.feil})` : ''}`).join(' · ') || 'Ingenting å sende.' }));
  const saveSettings = () => run(() => call('/paaminnelser', 'PUT', settings), () => setNotice({ text: settings.aktiv ? `Påminnelser sendes hver dag kl. ${settings.klokkeslett}.` : 'Påminnelser er slått av.' }));
  const runNow = () => { if (window.confirm('Sende dagens påminnelser til alle som har noe som forfaller nå?')) run(() => call('/paaminnelser/kjor', 'POST'), d => setNotice({ text: `${(d.sendt || []).filter(s => s.status === 'sendt').length} sendt.` })); };

  if (!data) return <p className={`panel p-4 text-sm ${error ? 'text-nx-amber' : 'text-nx-mute'}`}>{error || 'Laster …'}</p>;
  return <div className="grid grid-cols-12 gap-3 lg:gap-4">
    <section className={`col-span-12 panel ${standalone ? 'p-4' : 'lg:col-span-7 p-5'}`}>
      <h2 className="panel-title">Beboere · kontaktinfo og innlogging</h2>
      <p className="text-xs text-nx-mute mt-1">Bare du ser dette. Beboerne logger inn med Google-kontoen sin hvis e-posten her er Google-e-posten deres, ellers med e-posten eller mobilnummeret her og et passord de lager selv (kode på e-post/SMS eller invitasjonslenke). De får bare tilgang til Trivsel.</p>
      {error && <p role="alert" className="text-sm text-nx-amber mt-3">{error}</p>}
      {notice && <div role="status" className="text-sm text-nx-cyan mt-3 break-words">{notice.text}{notice.link && <><input readOnly value={notice.link} onFocus={e => e.target.select()} className={`${field} w-full mt-2`} /><button type="button" className={`${smallButton} mt-2`} onClick={() => navigator.clipboard?.writeText(notice.link)}>Kopier lenke</button></>}</div>}
      <ul className="divide-y divide-nx-line/40 mt-2">{data.beboere.map(b => <ResidentCard key={b.navn} b={b} busy={busy} kanaler={data.kanaler} onSave={save} onInvite={invite} onRemovePassword={removePassword} onTest={test} />)}</ul>
    </section>
    <section className={`col-span-12 panel space-y-4 self-start ${standalone ? 'p-4' : 'lg:col-span-5 p-5'}`}>
      <h2 className="panel-title">Daglige påminnelser</h2>
      <p className="text-xs text-nx-mute">Hver beboer får en melding når de har gjøremål som er forfalt eller skal gjøres i dag, sammen med antall åpne avvik. Ingen melding sendes når det ikke er noe å si.</p>
      <p className="text-xs">E-post: <strong>{data.kanaler.epost ? 'satt opp' : 'ikke satt opp'}</strong> · SMS: <strong>{data.kanaler.sms ? 'satt opp' : 'ikke satt opp'}</strong></p>
      {(!data.kanaler.epost || !data.kanaler.sms) && <p className="text-xs text-nx-mute">E-post settes opp med SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS og SMTP_FROM i Railway. SMS sendes fra iPhonen via iphone-remote: IPHONE_REMOTE_URL, IPHONE_REMOTE_USER, IPHONE_REMOTE_PASSWORD og IPHONE_MCP_TOKEN.</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.aktiv} onChange={e => setSettings(s => ({ ...s, aktiv: e.target.checked }))} />Send påminnelser automatisk</label>
      <label className="block"><span className="text-xs text-nx-mute">Klokkeslett (norsk tid)</span><input type="time" value={settings.klokkeslett} onChange={e => setSettings(s => ({ ...s, klokkeslett: e.target.value }))} className={`${field} w-full mt-1`} /></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryButton} disabled={busy} onClick={saveSettings}>Lagre</button>
        <button type="button" className={smallButton} disabled={busy} onClick={runNow}>Send dagens nå</button>
      </div>
      {settings.sistKjort && <p className="text-xs text-nx-mute">Sist sendt automatisk: {settings.sistKjort}</p>}
      <h3 className="text-xs uppercase tracking-[0.14em] text-nx-mute pt-2">Utsendingslogg · også faste påminnelser og gjøremål</h3>
      {!data.logg.length ? <p className="text-xs text-nx-mute">Ingen påminnelser sendt ennå.</p> :
        <ul className="text-xs space-y-1">{data.logg.slice(0, 20).map((l, i) => <li key={i}><span className="text-nx-mute">{time(l.at)}</span> · {l.navn} · {l.kanal}{l.emne ? ` · «${l.emne}»` : ''}{l.kilde && l.kilde !== 'daglig' ? ` (${{ planlagt: 'fast påminnelse', gjoremal: 'gjøremål', manuell: 'sendt manuelt', test: 'test' }[l.kilde] || l.kilde})` : ''} · <span className={l.status === 'sendt' ? 'text-nx-cyan' : 'text-nx-amber'}>{l.status}</span>{l.feil ? ` (${l.feil})` : ''}</li>)}</ul>}
    </section>
  </div>;
}
