import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api.js';

const BASE = (import.meta.env?.VITE_API_BASE || '') + '/api/house3d/changes';

async function call(path = '', options = {}) {
  const r = await apiFetch(BASE + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const d = await r.json().catch(() => ({}));
  if (r.status === 403) throw new Error('Bare administrator kan legge inn endringsønsker');
  if (!r.ok) throw new Error(d.error || 'Noe gikk galt');
  return d;
}

/** Endringsønsker for 3D-modellen (liste, legg til, endre status, slett). */
export function useHouse3dChanges() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await call()).items || []); setError(''); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = useCallback(async (fn) => {
    setBusy(true); setError('');
    try { const r = await fn(); await load(); return r; } catch (e) { setError(e.message); return null; } finally { setBusy(false); }
  }, [load]);

  return {
    items, error, busy, reload: load,
    add: (target, text) => run(() => call('', { method: 'POST', body: JSON.stringify({ target, text }) })),
    setStatus: (id, status) => run(() => call(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) })),
    remove: (id) => run(() => call(`/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  };
}
