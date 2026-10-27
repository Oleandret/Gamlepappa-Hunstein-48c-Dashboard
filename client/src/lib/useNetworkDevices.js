import { useEffect, useState } from 'react';
import { apiFetch } from './api.js';
import { roomIdForName } from './networkDevices3d.js';
import { usePageVisibility } from './usePageVisibility.js';

/** Henter enhetslisten hvert 30. sekund mens laget er på og fanen er synlig. */
export function useNetworkDevices(enabled) {
  const visible = usePageVisibility();
  const [state, setState] = useState({ loading: false, connected: false, reason: null, devices: [], fetchedAt: null });
  useEffect(() => {
    if (!enabled || !visible) return;
    const ctrl = new AbortController();
    let timer;
    const load = async () => {
      setState(s => ({ ...s, loading: true }));
      try {
        const r = await apiFetch('/api/network/devices', { signal: ctrl.signal });
        if (!r.ok) throw new Error();
        const d = await r.json();
        setState({ loading: false, connected: d.connected, reason: d.reason || null, fetchedAt: d.fetchedAt || null,
          devices: (d.devices || []).map(x => ({ ...x, roomId: roomIdForName(x.room) })) });
      } catch (e) {
        if (e.name !== 'AbortError') setState(s => ({ ...s, loading: false, connected: false, reason: 'unavailable' }));
      }
      if (!ctrl.signal.aborted) timer = setTimeout(load, 30_000);
    };
    load();
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [enabled, visible]);
  return state;
}
