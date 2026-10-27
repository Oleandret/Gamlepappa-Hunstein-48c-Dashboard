import { useCallback } from 'react';
import { useServerSyncedState } from './useServerSyncedState.js';

/**
 * Hvem er hjemme: nettverksenheter (MAC) som er valgt for topplinja, med
 * hvilken person de hører til. Shape: { devices: { [mac]: { person } } }.
 * Lagres på serveren, så valget gjelder på alle skjermer.
 */
export function useHomePresence() {
  const [config, setConfig, sync] = useServerSyncedState('homePresence', { devices: {} });
  const devices = config?.devices && typeof config.devices === 'object' ? config.devices : {};

  const toggle = useCallback((device) => {
    setConfig(prev => {
      const next = { ...(prev?.devices || {}) };
      if (next[device.id]) delete next[device.id];
      else next[device.id] = { person: (device.owner || device.name || '').slice(0, 40) };
      return { ...(prev || {}), devices: next };
    });
  }, [setConfig]);

  const setPerson = useCallback((mac, person) => {
    setConfig(prev => {
      const cur = prev?.devices?.[mac];
      if (!cur) return prev;
      return { ...(prev || {}), devices: { ...prev.devices, [mac]: { ...cur, person: person.slice(0, 40) } } };
    });
  }, [setConfig]);

  return { devices, toggle, setPerson, sync };
}

export { presencePeople } from './homePresence.js';
