import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'nexora.favorites.v1';

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
  catch { /* private mode etc. */ }
}

export function useFavorites() {
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
