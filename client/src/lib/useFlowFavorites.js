import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'nexora.flowFavorites.v1';

/**
 * Lokal stjerne-logikk for flows. Homey API eksponerer ikke en favorite-flag
 * på flow-objektet (flows er bare {id, name, enabled, folder}), så vi lagrer
 * en liste av favoritt-flow-IDer i localStorage.
 */

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [];
  } catch { return []; }
}

function write(ids) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); }
  catch {}
}

export function useFlowFavorites() {
  const [ids, setIds] = useState(read);

  useEffect(() => {
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setIds(read()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isFavorite = useCallback((id) => ids.includes(id), [ids]);

  const toggle = useCallback((id) => {
    setIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setIds([]);
    write([]);
  }, []);

  return { ids, isFavorite, toggle, clear };
}
