import { useCallback } from 'react';
import { VIEWS } from '../components/HouseView.jsx';
import { useServerSyncedState } from './useServerSyncedState.js';

/**
 * Pin-config { home: Pin[], cabin: Pin[] } for hovedbildene på framsiden.
 * Server-persistert under namespace 'pinConfig' med localStorage som cache.
 */

function withIds(pins) {
  return pins.map((p, i) => ({
    id: p.id || `${p.kind}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    ...p
  }));
}

function defaults() {
  return {
    home:  withIds(VIEWS.home.pins),
    cabin: withIds(VIEWS.cabin.pins)
  };
}

function sanitizePin(p) {
  if (!p || typeof p !== 'object') return null;
  if (typeof p.kind !== 'string' || !p.kind) return null;
  const placements = ['top', 'bottom', 'left', 'right'];
  return {
    ...p,
    kind: p.kind,
    x: Number.isFinite(p.x) ? Math.max(0, Math.min(100, p.x)) : 50,
    y: Number.isFinite(p.y) ? Math.max(0, Math.min(100, p.y)) : 50,
    placement: placements.includes(p.placement) ? p.placement : 'top',
    id: typeof p.id === 'string' ? p.id : undefined
  };
}

function sanitize(cfg) {
  if (!cfg || typeof cfg !== 'object') return defaults();
  const sanArr = (arr) => Array.isArray(arr) ? arr.map(sanitizePin).filter(Boolean) : null;
  const home  = sanArr(cfg.home);
  const cabin = sanArr(cfg.cabin);
  return {
    home:  home  != null ? withIds(home)  : defaults().home,
    cabin: cabin != null ? withIds(cabin) : defaults().cabin
  };
}

function newId(kind) {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export function usePinConfig() {
  const [config, setConfig] = useServerSyncedState('pinConfig', defaults);
  const clean = sanitize(config);

  const update = useCallback((next) => setConfig(sanitize(next)), [setConfig]);

  const setLocation = useCallback((location, pins) => {
    setConfig(prev => ({ ...sanitize(prev), [location]: pins }));
  }, [setConfig]);

  const updatePin = useCallback((location, id, patch) => {
    setConfig(prev => {
      const c = sanitize(prev);
      return { ...c, [location]: c[location].map(p => p.id === id ? { ...p, ...patch } : p) };
    });
  }, [setConfig]);

  const addPin = useCallback((location, pin) => {
    setConfig(prev => {
      const c = sanitize(prev);
      const id = newId(pin.kind);
      const list = [...c[location], { id, x: 50, y: 50, placement: 'top', ...pin }];
      return { ...c, [location]: list };
    });
  }, [setConfig]);

  const removePin = useCallback((location, id) => {
    setConfig(prev => {
      const c = sanitize(prev);
      return { ...c, [location]: c[location].filter(p => p.id !== id) };
    });
  }, [setConfig]);

  const reset = useCallback((location = null) => {
    if (!location) {
      setConfig(defaults());
      return;
    }
    setConfig(prev => ({ ...sanitize(prev), [location]: defaults()[location] }));
  }, [setConfig]);

  return { config: clean, update, setLocation, updatePin, addPin, removePin, reset };
}
