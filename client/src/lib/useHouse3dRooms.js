import { useCallback } from 'react';
import { useServerSyncedState } from './useServerSyncedState.js';

/**
 * Manuell kobling mellom rom i 3D-modellen og Homey-soner. Shape:
 *   { [roomId]: [zoneId, ...] }
 *
 * Rom uten eksplisitt kobling faller tilbake til navne-matching
 * (room.match mot sone-navnet).
 */
export function useHouse3dRooms() {
  const [config, setConfig, sync] = useServerSyncedState('house3dRooms', {});
  const clean = config && typeof config === 'object' ? config : {};

  const toggleZone = useCallback((roomId, zoneId, currentZoneIds) => {
    setConfig(prev => {
      const base = (prev && prev[roomId]) || currentZoneIds || [];
      const next = base.includes(zoneId) ? base.filter(z => z !== zoneId) : [...base, zoneId];
      return { ...(prev || {}), [roomId]: next };
    });
  }, [setConfig]);

  const resetRoom = useCallback((roomId) => {
    setConfig(prev => {
      const next = { ...(prev || {}) };
      delete next[roomId];
      return next;
    });
  }, [setConfig]);

  return { config: clean, toggleZone, resetRoom, sync };
}
