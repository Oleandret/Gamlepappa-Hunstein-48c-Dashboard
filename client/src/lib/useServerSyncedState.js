import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/**
 * Hook som synkroniserer state mot server-config-endepunktet, med localStorage
 * som offline-cache så UI-en er rask og overlever om serveren er nede et øyeblikk.
 *
 * Flyten:
 *  1. Initial state lastes synkront fra localStorage (instant UI).
 *  2. På mount: GET /api/config/<ns>. Hvis server har en verdi som er
 *     forskjellig fra lokal, brukes server-versjonen som sannhet.
 *  3. Ved hver setState: skriver localStorage umiddelbart, og PUT-er til
 *     server med en debounce på 500ms (avoid hammering på drag-events).
 *
 * Setter man `value` til samme referanse som forrige verdi, hoppes write over.
 */
const DEBOUNCE_MS = 500;

export function useServerSyncedState(namespace, defaultValue, { storageKey = null } = {}) {
  const lsKey = storageKey || `nexora.${namespace}.v1`;

  // Initial state fra localStorage — synkront, ingen flicker
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed !== undefined && parsed !== null) return parsed;
      }
    } catch { /* ignore */ }
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  });

  const [synced, setSynced] = useState(false);   // har vi hentet fra server?
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const skipNextWriteRef = useRef(false);
  const mountedRef = useRef(true);

  // Hent fra server på mount
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const ctrl = new AbortController();
    api.config.get(namespace, ctrl.signal)
      .then(({ value: serverValue }) => {
        if (cancelled) return;
        if (serverValue !== null && serverValue !== undefined) {
          // Server har en verdi — den vinner
          skipNextWriteRef.current = true; // ikke push tilbake umiddelbart
          setValue(serverValue);
          try { localStorage.setItem(lsKey, JSON.stringify(serverValue)); } catch {}
        }
        setSynced(true);
      })
      .catch(err => {
        if (cancelled || err.name === 'AbortError') return;
        // Server er nede — vi kjører videre på localStorage-versjonen
        setError(err);
        setSynced(true);
      });
    return () => {
      cancelled = true;
      mountedRef.current = false;
      ctrl.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  // Lytt til localStorage-events for sync mellom faner i samme browser
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== lsKey || e.newValue == null) return;
      try {
        const parsed = JSON.parse(e.newValue);
        skipNextWriteRef.current = true;
        setValue(parsed);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [lsKey]);

  // Sync ved hver setState
  const setSyncedValue = useCallback((updater) => {
    setValue(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Skriv localStorage umiddelbart (rask, synkron)
      try { localStorage.setItem(lsKey, JSON.stringify(next)); } catch {}
      // Debounced PUT til server
      if (skipNextWriteRef.current) {
        skipNextWriteRef.current = false;
        return next;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        api.config.put(namespace, next).catch(err => {
          if (mountedRef.current) setError(err);
          console.warn(`[server-sync] failed to save ${namespace}:`, err.message);
        });
      }, DEBOUNCE_MS);
      return next;
    });
  }, [namespace, lsKey]);

  return [value, setSyncedValue, { synced, error }];
}
