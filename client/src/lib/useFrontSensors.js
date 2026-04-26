import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'nexora.frontSensors.v1';

/**
 * Brukerstyrt liste med små sensor-widgets på framsiden.
 * Hvert element: { id, deviceId, capability, label }
 *
 * deviceId og capability bestemmer hvilken verdi som vises.
 * label er en valgfri kort tittel — fallback er enhetens navn.
 */

function newId() {
  return `sw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(s => s && typeof s.deviceId === 'string' && typeof s.capability === 'string')
      .map(s => ({
        id: typeof s.id === 'string' ? s.id : newId(),
        deviceId: s.deviceId,
        capability: s.capability,
        label: typeof s.label === 'string' ? s.label : ''
      }));
  } catch { return []; }
}

function write(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
  catch { /* private mode etc. */ }
}

export function useFrontSensors() {
  const [list, setList] = useState(read);

  useEffect(() => {
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setList(read()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((sensor) => {
    setList(prev => {
      const next = [...prev, { id: newId(), label: '', ...sensor }];
      write(next);
      return next;
    });
  }, []);

  const update = useCallback((id, patch) => {
    setList(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...patch } : s);
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setList(prev => {
      const next = prev.filter(s => s.id !== id);
      write(next);
      return next;
    });
  }, []);

  const reorder = useCallback((from, to) => {
    setList(prev => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      write(next);
      return next;
    });
  }, []);

  return { list, add, update, remove, reorder };
}
