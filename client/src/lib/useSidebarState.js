import { useCallback, useEffect, useState } from 'react';

const KEY = 'nexora.sidebar.pinned';

function read() {
  try {
    const v = localStorage.getItem(KEY);
    return v === '1';
  } catch { return false; }
}

export function useSidebarPinned() {
  const [pinned, setPinned] = useState(read);
  const toggle = useCallback(() => {
    setPinned(prev => {
      const next = !prev;
      try { localStorage.setItem(KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);
  return { pinned, toggle };
}

const LOG_KEY = 'nexora.activitylog.pinned';

export function useLogPinned() {
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(LOG_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(LOG_KEY, pinned ? '1' : '0'); } catch {}
  }, [pinned]);
  const toggle = useCallback(() => setPinned(p => !p), []);
  return { pinned, toggle };
}
