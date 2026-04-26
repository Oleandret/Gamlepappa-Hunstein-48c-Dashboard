import { useCallback } from 'react';
import { useServerSyncedState } from './useServerSyncedState.js';

/**
 * Per-plan favoritt-flows. Shape:
 *   { [planId]: string[] (flow-IDer) }
 *
 * Lagres på server (namespace 'floorPlanFlows'). Hver plan har sin egen
 * liste av flows som vises i høyre-panelet ved siden av canvas, slik at
 * man kan kjøre dem direkte fra plantegninga.
 */

function sanitize(cfg) {
  if (!cfg || typeof cfg !== 'object') return {};
  const out = {};
  for (const [planId, ids] of Object.entries(cfg)) {
    if (!Array.isArray(ids)) continue;
    out[planId] = ids.filter(x => typeof x === 'string');
  }
  return out;
}

export function useFloorPlanFlows() {
  const [config, setConfig, sync] = useServerSyncedState('floorPlanFlows', {});
  const cleanConfig = sanitize(config);

  const getFlows = useCallback((planId) => cleanConfig[planId] || [], [cleanConfig]);

  const isInPlan = useCallback((planId, flowId) =>
    (cleanConfig[planId] || []).includes(flowId), [cleanConfig]);

  const addFlow = useCallback((planId, flowId) => {
    setConfig(prev => {
      const list = (prev && prev[planId]) || [];
      if (list.includes(flowId)) return prev;
      return { ...(prev || {}), [planId]: [...list, flowId] };
    });
  }, [setConfig]);

  const removeFlow = useCallback((planId, flowId) => {
    setConfig(prev => {
      const list = (prev && prev[planId]) || [];
      return { ...(prev || {}), [planId]: list.filter(id => id !== flowId) };
    });
  }, [setConfig]);

  const reorderFlow = useCallback((planId, from, to) => {
    setConfig(prev => {
      const list = [...((prev && prev[planId]) || [])];
      if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return prev;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      return { ...(prev || {}), [planId]: list };
    });
  }, [setConfig]);

  return { config: cleanConfig, getFlows, isInPlan, addFlow, removeFlow, reorderFlow, sync };
}
