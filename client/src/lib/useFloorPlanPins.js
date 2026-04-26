import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'nexora.floorPlanPins.v1';

/**
 * Pin-config per plantegning. Shape:
 *   { [planId]: [{ id, deviceId, x, y, placement, label }, ...] }
 *
 * Hver pin er knyttet til én Homey-enhet (deviceId), pluss posisjon (x/y i %),
 * eventuell custom label, og placement (hvor info-bobla flyter).
 */

function newId() {
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function sanitizePin(p) {
  if (!p || typeof p !== 'object') return null;
  if (typeof p.deviceId !== 'string' || !p.deviceId) return null;
  const placements = ['top', 'bottom', 'left', 'right'];
  return {
    id: typeof p.id === 'string' ? p.id : newId(),
    deviceId: p.deviceId,
    x: Number.isFinite(p.x) ? Math.max(0, Math.min(100, p.x)) : 50,
    y: Number.isFinite(p.y) ? Math.max(0, Math.min(100, p.y)) : 50,
    placement: placements.includes(p.placement) ? p.placement : 'top',
    label: typeof p.label === 'string' ? p.label : ''
  };
}

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    for (const [planId, pins] of Object.entries(parsed)) {
      if (!Array.isArray(pins)) continue;
      out[planId] = pins.map(sanitizePin).filter(Boolean);
    }
    return out;
  } catch { return {}; }
}

function write(cfg) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }
  catch {}
}

export function useFloorPlanPins() {
  const [config, setConfig] = useState(read);

  useEffect(() => {
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setConfig(read()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const getPins = useCallback((planId) => config[planId] || [], [config]);

  const addPin = useCallback((planId, pin) => {
    setConfig(prev => {
      const list = prev[planId] || [];
      const newPin = {
        id: newId(),
        x: 50, y: 50,
        placement: 'top',
        label: '',
        ...pin
      };
      const next = { ...prev, [planId]: [...list, newPin] };
      write(next);
      return next;
    });
  }, []);

  const updatePin = useCallback((planId, id, patch) => {
    setConfig(prev => {
      const list = (prev[planId] || []).map(p => p.id === id ? { ...p, ...patch } : p);
      const next = { ...prev, [planId]: list };
      write(next);
      return next;
    });
  }, []);

  const removePin = useCallback((planId, id) => {
    setConfig(prev => {
      const list = (prev[planId] || []).filter(p => p.id !== id);
      const next = { ...prev, [planId]: list };
      write(next);
      return next;
    });
  }, []);

  const resetPlan = useCallback((planId) => {
    setConfig(prev => {
      const next = { ...prev };
      delete next[planId];
      write(next);
      return next;
    });
  }, []);

  return { config, getPins, addPin, updatePin, removePin, resetPlan };
}
