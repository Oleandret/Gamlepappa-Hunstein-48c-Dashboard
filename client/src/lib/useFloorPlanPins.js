import { useCallback } from 'react';
import { useServerSyncedState } from './useServerSyncedState.js';

/**
 * Pin-config per plantegning. Shape:
 *   { [planId]: [{ id, deviceId, x, y, placement, label, category }, ...] }
 *
 * Lagres på server (namespace 'floorPlanPins') med localStorage som
 * offline-cache.
 */

function newId() {
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function sanitizePin(p) {
  if (!p || typeof p !== 'object') return null;
  if (typeof p.deviceId !== 'string' || !p.deviceId) return null;
  const placements = ['top', 'bottom', 'left', 'right'];
  const categories = ['auto', 'light', 'security', 'temp', 'music', 'wifi', 'tech'];
  return {
    id: typeof p.id === 'string' ? p.id : newId(),
    deviceId: p.deviceId,
    x: Number.isFinite(p.x) ? Math.max(0, Math.min(100, p.x)) : 50,
    y: Number.isFinite(p.y) ? Math.max(0, Math.min(100, p.y)) : 50,
    placement: placements.includes(p.placement) ? p.placement : 'top',
    label: typeof p.label === 'string' ? p.label : '',
    category: categories.includes(p.category) ? p.category : 'auto'
  };
}

function sanitize(cfg) {
  if (!cfg || typeof cfg !== 'object') return {};
  const out = {};
  for (const [planId, pins] of Object.entries(cfg)) {
    if (!Array.isArray(pins)) continue;
    out[planId] = pins.map(sanitizePin).filter(Boolean);
  }
  return out;
}

export function useFloorPlanPins() {
  const [config, setConfig] = useServerSyncedState('floorPlanPins', {});
  const cleanConfig = sanitize(config);

  const getPins = useCallback((planId) => cleanConfig[planId] || [], [cleanConfig]);

  const addPin = useCallback((planId, pin) => {
    setConfig(prev => {
      const list = (prev && prev[planId]) || [];
      const newPin = sanitizePin({
        id: newId(), x: 50, y: 50, placement: 'top', label: '', category: 'auto', ...pin
      });
      return { ...(prev || {}), [planId]: [...list, newPin] };
    });
  }, [setConfig]);

  const updatePin = useCallback((planId, id, patch) => {
    setConfig(prev => {
      const list = ((prev && prev[planId]) || []).map(p => p.id === id ? { ...p, ...patch } : p);
      return { ...(prev || {}), [planId]: list };
    });
  }, [setConfig]);

  const removePin = useCallback((planId, id) => {
    setConfig(prev => {
      const list = ((prev && prev[planId]) || []).filter(p => p.id !== id);
      return { ...(prev || {}), [planId]: list };
    });
  }, [setConfig]);

  const resetPlan = useCallback((planId) => {
    setConfig(prev => {
      const next = { ...(prev || {}) };
      delete next[planId];
      return next;
    });
  }, [setConfig]);

  return { config: cleanConfig, getPins, addPin, updatePin, removePin, resetPlan };
}
