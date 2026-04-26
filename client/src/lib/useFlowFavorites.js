import { useCallback } from 'react';
import { useServerSyncedState } from './useServerSyncedState.js';

/**
 * Lokal stjerne-logikk for flows, server-persistert.
 */
export function useFlowFavorites() {
  const [ids, setIds] = useServerSyncedState('flowFavorites', []);
  const safeIds = Array.isArray(ids) ? ids.filter(x => typeof x === 'string') : [];

  const isFavorite = useCallback((id) => safeIds.includes(id), [safeIds]);

  const toggle = useCallback((id) => {
    setIds(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
    });
  }, [setIds]);

  const clear = useCallback(() => setIds([]), [setIds]);

  return { ids: safeIds, isFavorite, toggle, clear };
}
