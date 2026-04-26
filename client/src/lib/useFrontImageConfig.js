import { useCallback } from 'react';
import { useServerSyncedState } from './useServerSyncedState.js';

const DEFAULTS = {
  maxHeight: 260,
  aspectRatio: '16/9'
};
const VALID_RATIOS = new Set(['16/9', '21/9', '4/3', '3/2']);

function sanitize(cfg) {
  if (!cfg || typeof cfg !== 'object') return DEFAULTS;
  return {
    maxHeight: Number.isFinite(cfg.maxHeight)
      ? Math.max(140, Math.min(520, cfg.maxHeight))
      : DEFAULTS.maxHeight,
    aspectRatio: VALID_RATIOS.has(cfg.aspectRatio) ? cfg.aspectRatio : DEFAULTS.aspectRatio
  };
}

export function useFrontImageConfig() {
  const [config, setConfig] = useServerSyncedState('frontImageConfig', DEFAULTS);
  const clean = sanitize(config);

  const set = useCallback((patch) => {
    setConfig(prev => ({ ...sanitize(prev), ...patch }));
  }, [setConfig]);

  const reset = useCallback(() => setConfig(DEFAULTS), [setConfig]);

  return { config: clean, set, reset, defaults: DEFAULTS };
}
