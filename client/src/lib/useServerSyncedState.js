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
// Andre komponenter i samme fane som bruker samme namespace (f.eks. topplinja
// og nettverkspanelet) får endringen via denne hendelsen; `storage` gjelder bare andre faner.
const SAME_TAB_EVENT = 'server-synced-state';

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
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const debounceRef = useRef(null);
  const editedRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const mountedRef = useRef(true);
  const valueRef = useRef(value);
  valueRef.current = value;
  const instanceRef = useRef(Symbol(namespace));

  // Hent fra server på mount
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const ctrl = new AbortController();
    api.config.get(namespace, ctrl.signal)
      .then(({ value: serverValue }) => {
        if (cancelled) return;
        if (editedRef.current) { setSynced(true); return; }
        if (serverValue !== null && serverValue !== undefined) {
          // Server har en verdi — den vinner
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
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(() => api.config.put(namespace, valueRef.current)).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  // Lytt til localStorage-events for sync mellom faner i samme browser
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== lsKey || e.newValue == null) return;
      try {
        const parsed = JSON.parse(e.newValue);
        setValue(parsed);
      } catch {}
    };
    const onSameTab = (e) => {
      if (e.detail?.key !== lsKey || e.detail.source === instanceRef.current) return;
      setValue(e.detail.value);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(SAME_TAB_EVENT, onSameTab);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(SAME_TAB_EVENT, onSameTab); };
  }, [lsKey]);

  // Felles save-funksjon — flush() bruker den uten debounce, setSyncedValue
  // bruker den via debouncet timeout.
  const doSave = useCallback(async (next) => {
    if (mountedRef.current) setSaving(true);
    setError(null);
    try {
      const task = saveQueueRef.current.catch(() => {}).then(() => api.config.put(namespace, next));
      saveQueueRef.current = task;
      await task;
      if (mountedRef.current) {
        setLastSavedAt(Date.now());
        setSaving(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setSaving(false);
      }
      console.warn(`[server-sync] failed to save ${namespace}:`, err.message);
      throw err;
    }
  }, [namespace]);

  // Sync ved hver setState
  const setSyncedValue = useCallback((updater) => {
    editedRef.current = true;
    setValue(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      valueRef.current = next;
      // Skriv localStorage umiddelbart (rask, synkron)
      try { localStorage.setItem(lsKey, JSON.stringify(next)); } catch {}
      if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        Promise.resolve().then(() => window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: { key: lsKey, value: next, source: instanceRef.current } })));
      }
      // Debounced PUT til server
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => { doSave(next).catch(() => {}); }, DEBOUNCE_MS);
      return next;
    });
  }, [lsKey, doSave]);

  // Force-flush nå (kanselerer pending debounce og PUT-er umiddelbart)
  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    return doSave(valueRef.current);
  }, [doSave]);

  return [value, setSyncedValue, { synced, error, saving, lastSavedAt, flush }];
}
