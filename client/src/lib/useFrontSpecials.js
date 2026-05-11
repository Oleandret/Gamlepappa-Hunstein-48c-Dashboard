import { useCallback } from 'react';
import { useServerSyncedState } from './useServerSyncedState.js';

/**
 * Konfig for spesial-kortene på Oversikt (Tesla, Tibber, Støvsuger).
 *
 * Verdi per slot kan være:
 *   'auto'              — bruk auto-deteksjon (Tesla foretrekker Model X osv.)
 *   '<deviceId>'        — bruk akkurat denne enheten
 *   'none' | null       — skjul kortet
 *
 * Vacuum er default 'none' — brukeren ba eksplisitt om å fjerne den fra
 * framsiden og selv plukke. Tesla og Tibber er 'auto' for å bevare
 * eksisterende oppførsel.
 */

const DEFAULTS = {
  tesla:  'auto',
  tibber: 'auto',
  vacuum: 'none'
};

function sanitize(cfg) {
  const out = { ...DEFAULTS };
  if (!cfg || typeof cfg !== 'object') return out;
  for (const slot of Object.keys(DEFAULTS)) {
    const v = cfg[slot];
    if (v === 'auto' || v === 'none' || v === null || (typeof v === 'string' && v.length > 0)) {
      out[slot] = v === null ? 'none' : v;
    }
  }
  return out;
}

export function useFrontSpecials() {
  const [config, setConfig, sync] = useServerSyncedState('frontSpecials', DEFAULTS);
  const clean = sanitize(config);

  const set = useCallback((slot, value) => {
    setConfig(prev => ({ ...sanitize(prev), [slot]: value }));
  }, [setConfig]);

  const reset = useCallback(() => setConfig(DEFAULTS), [setConfig]);

  return { config: clean, set, reset, defaults: DEFAULTS, sync };
}
