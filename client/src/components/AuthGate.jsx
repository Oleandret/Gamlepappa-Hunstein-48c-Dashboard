import { useEffect, useState } from 'react';
import { apiFetch, setCsrfToken } from '../lib/api.js';

export function AuthGate({ children }) {
  const [ready, setReady] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  async function check(showError = false) {
    try {
      const response = await apiFetch('/api/session');
      if (!response.ok) {
        setReady(false); setCsrfToken('');
        if (showError) setError('Tilgangsnøkkelen ble ikke godkjent.');
        return;
      }
      const session = await response.json();
      setCsrfToken(session.csrfToken); setError(''); setReady(true);
    } catch { setError('Serveren er utilgjengelig. Prøv igjen.'); }
  }
  useEffect(() => {
    check();
    fetch('/auth/config', { credentials: 'same-origin' }).then(r => r.json()).then(c => setGoogleEnabled(c.googleEnabled === true)).catch(() => {});
    if (new URLSearchParams(window.location.search).get('login') === 'failed') {
      setError('Google-innloggingen ble ikke godkjent. Bruk eierens Google-konto og prøv igjen.');
      window.history.replaceState(null, '', window.location.pathname);
    }
    const reset = () => { setReady(false); setCsrfToken(''); };
    window.addEventListener('dashboard-auth-required', reset);
    return () => window.removeEventListener('dashboard-auth-required', reset);
  }, []);
  async function logout() {
    try {
      let response = await apiFetch('/api/logout', { method: 'POST' });
      if (response.status === 401) {
        // A revoked reserve key must not leave an independently valid Google session behind.
        sessionStorage.removeItem('dashboard.session');
        const session = await apiFetch('/api/session');
        if (session.ok) {
          setCsrfToken((await session.json()).csrfToken);
          response = await apiFetch('/api/logout', { method: 'POST' });
        } else if (session.status !== 401) throw new Error('Session check failed');
      }
      if (!response.ok && response.status !== 401) throw new Error('Logout failed');
      sessionStorage.removeItem('dashboard.session'); setCsrfToken(''); setReady(false);
    } catch { setError('Kunne ikke logge ut. Prøv igjen.'); }
  }
  if (ready) return <><button className="btn fixed bottom-2 left-2 z-50 text-xs" onClick={logout}>Logg ut</button>{error && <p role="alert" className="fixed bottom-12 left-2 z-50 panel p-2">{error}</p>}{children}</>;
  return <main className="min-h-screen grid place-items-center bg-nx-bg text-nx-text"><section className="panel p-8 max-w-md">
    <h1 className="text-xl">Logg inn i dashboardet</h1>
    {googleEnabled && <><p className="my-3 text-sm">Logg inn med eierens Google-konto.</p><button className="btn w-full" onClick={() => { sessionStorage.removeItem('dashboard.session'); setCsrfToken(''); window.location.assign('/auth/google'); }}>Fortsett med Google</button></>}
    <details className="mt-4" open={!googleEnabled}><summary>Administratortilgang</summary><form onSubmit={e => {
      e.preventDefault(); sessionStorage.setItem('dashboard.session', token); setToken(''); setError(''); check(true);
    }}><p className="my-3 text-sm">Tilgangsnøkkelen brukes bare i denne nettleserøkten.</p><label>Tilgangsnøkkel<input type="password" required autoComplete="off" value={token} onChange={e => setToken(e.target.value)} className="block w-full bg-nx-bg border p-2 my-2" /></label><button className="btn">Logg inn med nøkkel</button></form></details>
    <p role="status" className="mt-3 text-sm">{error}</p>
  </section></main>;
}
