import { useCallback, useEffect, useState } from 'react';
import { VIEWS } from '../components/HouseView.jsx';

const STORAGE_KEY = 'nexora.pinConfig.v1';

/**
 * Pin-config er { home: Pin[], cabin: Pin[] } der hver Pin har minimum
 *   { id, kind, x, y, placement }
 * pluss kind-spesifikke felt (zoneName, deviceMatch, label).
 * Hvis ingen config er lagret, returnerer vi defaults fra HouseView.VIEWS.
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

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults();
    // Validere strukturen — alle pins må ha minimum kind+x+y
    const valid = (arr) => Array.isArray(arr) && arr.every(p =>
      p && typeof p.kind === 'string' && Number.isFinite(p.x) && Number.isFinite(p.y)
    );
    return {
      home:  valid(parsed.home)  ? withIds(parsed.home)  : defaults().home,
      cabin: valid(parsed.cabin) ? withIds(parsed.cabin) : defaults().cabin
    };
  } catch {
    return defaults();
  }
}

function write(cfg) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }
  catch { /* private mode etc. */ }
}

export function usePinConfig() {
  const [config, setConfig] = useState(read);

  // Sync på tvers av faner
  useEffect(() => {
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setConfig(read()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((next) => {
    setConfig(next);
    write(next);
  }, []);

  const setLocation = useCallback((location, pins) => {
    setConfig(prev => {
      const next = { ...prev, [location]: pins };
      write(next);
      return next;
    });
  }, []);

  const updatePin = useCallback((location, id, patch) => {
    setConfig(prev => {
      const list = (prev[location] || []).map(p => p.id === id ? { ...p, ...patch } : p);
      const next = { ...prev, [location]: list };
      write(next);
      return next;
    });
  }, []);

  const addPin = useCallback((location, pin) => {
    setConfig(prev => {
      const id = `${pin.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      const list = [...(prev[location] || []), { id, x: 50, y: 50, placement: 'top', ...pin }];
      const next = { ...prev, [location]: list };
      write(next);
      return next;
    });
  }, []);

  const removePin = useCallback((location, id) => {
    setConfig(prev => {
      const list = (prev[location] || []).filter(p => p.id !== id);
      const next = { ...prev, [location]: list };
      write(next);
      return next;
    });
  }, []);

  const reset = useCallback((location = null) => {
    if (!location) {
      const next = defaults();
      setConfig(next);
      write(next);
      return;
    }
    setConfig(prev => {
      const next = { ...prev, [location]: defaults()[location] };
      write(next);
      return next;
    });
  }, []);

  return { config, update, setLocation, updatePin, addPin, removePin, reset };
}
