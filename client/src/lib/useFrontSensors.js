import { useCallback } from 'react';
import { useServerSyncedState } from './useServerSyncedState.js';

function newId() {
  return `sw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function sanitize(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(s => s && typeof s.deviceId === 'string' && typeof s.capability === 'string')
    .map(s => ({
      id: typeof s.id === 'string' ? s.id : newId(),
      deviceId: s.deviceId,
      capability: s.capability,
      label: typeof s.label === 'string' ? s.label : ''
    }));
}

export function useFrontSensors() {
  const [list, setList] = useServerSyncedState('frontSensors', []);
  const cleanList = sanitize(list);

  const add = useCallback((sensor) => {
    setList(prev => [...(Array.isArray(prev) ? prev : []), { id: newId(), label: '', ...sensor }]);
  }, [setList]);

  const update = useCallback((id, patch) => {
    setList(prev => (Array.isArray(prev) ? prev : []).map(s => s.id === id ? { ...s, ...patch } : s));
  }, [setList]);

  const remove = useCallback((id) => {
    setList(prev => (Array.isArray(prev) ? prev : []).filter(s => s.id !== id));
  }, [setList]);

  const reorder = useCallback((from, to) => {
    setList(prev => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  }, [setList]);

  return { list: cleanList, add, update, remove, reorder };
}
