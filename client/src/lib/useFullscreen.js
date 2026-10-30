import { useCallback, useEffect, useState } from 'react';

const current = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const canNative = el => !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));

/**
 * Fullskjerm for ett element (skjermbildet i fjernstyringen): [erFullskjerm, veksle, uekte].
 * Nettleseren setter elementet til hele skjermen selv; Esc avslutter. Der nettleseren ikke kan det
 * (Safari på iPhone har fullskjerm bare for video), legges elementet i stedet over hele vinduet –
 * «uekte» fullskjerm – og den som tegner elementet legger på FAKE_FULLSCREEN_STYLE.
 */
export function useFullscreen(ref) {
  const [full, setFull] = useState(false);
  const [fake, setFake] = useState(false);
  useEffect(() => {
    const on = () => setFull(!!current() && current() === ref.current);
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => { document.removeEventListener('fullscreenchange', on); document.removeEventListener('webkitfullscreenchange', on); };
  }, [ref]);
  useEffect(() => {
    if (!fake) return;
    const onKey = e => { if (e.key === 'Escape') setFake(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fake]);
  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (fake) { setFake(false); return; }
    if (!canNative(el)) { setFake(true); return; }
    if (current()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  }, [ref, fake]);
  return [full || fake, toggle, fake];
}

/** Uekte fullskjerm: elementet legges over hele vinduet, uten runde hjørner og uten sideforholdet som ellers styrer størrelsen. */
export const FAKE_FULLSCREEN_STYLE = { position: 'fixed', inset: 0, width: '100%', height: '100%', maxWidth: 'none', aspectRatio: 'auto', borderRadius: 0, zIndex: 100 };
