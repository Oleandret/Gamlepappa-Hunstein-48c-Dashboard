import { useCallback, useMemo } from 'react';
import { useServerSyncedState } from './useServerSyncedState.js';
import { sanitizeEdits, applyEdit, resetEdit } from './house3dEdits.js';

/** Server-lagrede endringer med hjelpefunksjoner for 3D-visningen. */
export function useHouse3dEdits() {
  const [raw, setRaw, sync] = useServerSyncedState('house3dEdits', {});
  const edits = useMemo(() => sanitizeEdits(raw), [raw]);
  const update = useCallback((key, change) => setRaw(prev => applyEdit(sanitizeEdits(prev), key, change)), [setRaw]);
  const reset = useCallback((key) => setRaw(prev => resetEdit(sanitizeEdits(prev), key)), [setRaw]);
  const resetAll = useCallback(() => setRaw({}), [setRaw]);
  return { edits, update, reset, resetAll, sync };
}
