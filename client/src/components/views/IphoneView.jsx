import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';

/**
 * Iphone: iphone-remote vist i dashboardet, ferdig innlogget. Serveren holder
 * innloggingen mot iphone-remote; her hentes bare en kortlivet billett
 * (cookie for /iphone/) før rammen lastes.
 */
export function IphoneView() {
  const [state, setState] = useState({ status: 'loading' });
  const [frameKey, setFrameKey] = useState(0);

  async function open() {
    setState({ status: 'loading' });
    try {
      const r = await apiFetch('/api/iphone/session', { method: 'POST' });
      if (r.status === 403) return setState({ status: 'forbidden' });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setState(d.configured ? { status: 'ready', path: d.path } : { status: 'not-configured' });
      setFrameKey(k => k + 1);
    } catch { setState({ status: 'error' }); }
  }
  useEffect(() => { open(); }, []);

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="panel-title">Fjernstyring</p>
          <h1 className="text-2xl font-semibold mt-1">Iphone</h1>
        </div>
        {state.status === 'ready' && (
          <div className="flex gap-2">
            <button className="chip inline-flex items-center gap-1.5" onClick={open}><RefreshCw size={14} /> Last inn på nytt</button>
            <a className="chip inline-flex items-center gap-1.5" href={state.path} target="_blank" rel="noopener"><ExternalLink size={14} /> Eget vindu</a>
          </div>
        )}
      </header>
      {state.status === 'loading' && <p className="panel p-5 text-sm text-nx-mute">Kobler til telefonen …</p>}
      {state.status === 'forbidden' && <p className="panel p-5 text-sm">Iphone-fjernstyring krever administratorinnlogging i dashboardet.</p>}
      {state.status === 'not-configured' && <p className="panel p-5 text-sm">Iphone-fjernstyring er ikke satt opp på serveren ennå. Sett <code>IPHONE_REMOTE_URL</code>, <code>IPHONE_REMOTE_USER</code> og <code>IPHONE_REMOTE_PASSWORD</code> i Railway.</p>}
      {state.status === 'error' && <p className="panel p-5 text-sm">Fikk ikke kontakt med serveren. <button className="chip ml-2" onClick={open}>Prøv igjen</button></p>}
      {state.status === 'ready' && (
        <iframe
          key={frameKey}
          src={state.path}
          title="Iphone fjernstyring"
          className="w-full rounded-2xl border border-nx-line/60 bg-black"
          style={{ height: 'max(720px, calc(100vh - 260px))' }}
          allow="clipboard-write"
          referrerPolicy="same-origin"
        />
      )}
    </section>
  );
}
