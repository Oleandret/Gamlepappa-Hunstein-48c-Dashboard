import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'nexora.frontImageConfig.v1';

const DEFAULTS = {
  maxHeight: 260,        // px-cap på bildehøyden i wide-mode
  aspectRatio: '16/9'    // '16/9' | '21/9' | '4/3' | '3/2'
};

const VALID_RATIOS = new Set(['16/9', '21/9', '4/3', '3/2']);

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULTS;
    return {
      maxHeight: Number.isFinite(parsed.maxHeight)
        ? Math.max(140, Math.min(520, parsed.maxHeight))
        : DEFAULTS.maxHeight,
      aspectRatio: VALID_RATIOS.has(parsed.aspectRatio) ? parsed.aspectRatio : DEFAULTS.aspectRatio
    };
  } catch {
    return DEFAULTS;
  }
}

function write(cfg) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }
  catch { /* private mode etc. */ }
}

export function useFrontImageConfig() {
  const [config, setConfig] = useState(read);

  useEffect(() => {
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setConfig(read()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const set = useCallback((patch) => {
    setConfig(prev => {
      const next = { ...prev, ...patch };
      write(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setConfig(DEFAULTS);
    write(DEFAULTS);
  }, []);

  return { config, set, reset, defaults: DEFAULTS };
}
