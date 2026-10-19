import { useEffect, useState } from 'react';

/**
 * Innlogging for beboerne: e-post eller telefon + passord. Første gang (eller glemt
 * passord) får de en kode til e-posten/telefonen eieren har registrert, eller de
 * bruker en invitasjonslenke fra eieren.
 */
const input = 'block w-full bg-nx-bg border border-nx-line rounded-lg p-3 my-1 text-base';

async function post(path, body) {
  const r = await fetch(`/auth/beboer${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Noe gikk galt. Prøv igjen.');
  return d;
}

export function ResidentLogin({ onLoggedIn }) {
  const invitation = new URLSearchParams(window.location.search).get('invitasjon');
  const [mode, setMode] = useState(invitation ? 'invitasjon' : 'logginn');
  const [id, setId] = useState('');
  const [passord, setPassord] = useState('');
  const [kode, setKode] = useState('');
  const [navn, setNavn] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invitation) return;
    post('/invitasjon/sjekk', { token: invitation }).then(d => setNavn(d.navn)).catch(e => setError(e.message));
  }, [invitation]);

  async function run(fn) {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const done = () => { window.history.replaceState(null, '', '/huset'); onLoggedIn(); };
  const login = e => { e.preventDefault(); run(async () => { await post('/logginn', { identifikator: id, passord }); done(); }); };
  const sendCode = e => { e.preventDefault(); run(async () => { const d = await post('/kode', { identifikator: id }); setMessage(d.melding); setMode('kode'); }); };
  const setNew = e => { e.preventDefault(); run(async () => { await post('/passord', { identifikator: id, kode, passord }); done(); }); };
  const accept = e => { e.preventDefault(); run(async () => { await post('/invitasjon', { token: invitation, passord }); done(); }); };

  const idField = <label className="block text-sm">E-post eller mobilnummer<input value={id} onChange={e => setId(e.target.value)} required autoComplete="username" inputMode="email" className={input} /></label>;
  const passwordField = (label, auto) => <label className="block text-sm mt-3">{label}<input type="password" value={passord} onChange={e => setPassord(e.target.value)} required minLength={auto === 'new-password' ? 10 : undefined} autoComplete={auto} className={input} /></label>;

  return <div>
    <h2 className="text-lg">{mode === 'invitasjon' ? `Velkommen${navn ? `, ${navn}` : ''}!` : 'Beboere i Hunstein 48c'}</h2>
    {mode === 'logginn' && <form onSubmit={login} className="mt-3">
      {idField}{passwordField('Passord', 'current-password')}
      <button className="btn w-full mt-4" disabled={busy}>Logg inn</button>
      <button type="button" className="text-sm underline mt-3" onClick={() => { setMode('start'); setError(''); }}>Første gang, eller glemt passordet?</button>
    </form>}
    {mode === 'start' && <form onSubmit={sendCode} className="mt-3">
      <p className="text-sm mb-3">Skriv e-posten eller mobilnummeret som Ole Andre har registrert på deg. Du får en kode for å lage passord.</p>
      {idField}
      <button className="btn w-full mt-4" disabled={busy}>Send kode</button>
      <button type="button" className="text-sm underline mt-3" onClick={() => setMode('logginn')}>Tilbake til innlogging</button>
    </form>}
    {mode === 'kode' && <form onSubmit={setNew} className="mt-3">
      <p className="text-sm mb-3">{message}</p>
      <label className="block text-sm">Kode<input value={kode} onChange={e => setKode(e.target.value)} required inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={input} /></label>
      {passwordField('Nytt passord (minst 10 tegn)', 'new-password')}
      <button className="btn w-full mt-4" disabled={busy}>Lagre passord og logg inn</button>
      <button type="button" className="text-sm underline mt-3" onClick={() => setMode('start')}>Send ny kode</button>
    </form>}
    {mode === 'invitasjon' && <form onSubmit={accept} className="mt-3">
      <p className="text-sm mb-3">Lag et passord. Etterpå logger du inn med e-posten eller mobilnummeret ditt og dette passordet.</p>
      {passwordField('Nytt passord (minst 10 tegn)', 'new-password')}
      <button className="btn w-full mt-4" disabled={busy || !navn}>Lagre passord og logg inn</button>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-nx-amber">{error}</p>}
  </div>;
}
