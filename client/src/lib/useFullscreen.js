import { useCallback, useEffect, useState } from 'react';

/**
 * Fullskjerm for ett element (skjermbildet i fjernstyringen): [erFullskjerm, veksle].
 * Nettleseren setter elementet til hele skjermen selv; Esc avslutter.
 */
export function useFullscreen(ref) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => { document.removeEventListener('fullscreenchange', on); document.removeEventListener('webkitfullscreenchange', on); };
  }, [ref]);
  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }, [ref]);
  return [full, toggle];
}
