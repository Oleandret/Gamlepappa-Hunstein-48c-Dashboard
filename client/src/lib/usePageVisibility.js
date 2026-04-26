import { useEffect, useState } from 'react';

/** Returns false while the tab is hidden — pause polling, animations etc. */
export function usePageVisibility() {
  const [visible, setVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
  );
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}
