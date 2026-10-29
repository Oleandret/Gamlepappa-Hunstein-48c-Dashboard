import { useCallback, useEffect, useRef, useState } from 'react';
import { Home, ArrowLeft, LayoutGrid, SlidersHorizontal, Lock, Unlock, Volume1, Volume2, ChevronUp, ChevronDown, CornerDownLeft, Delete, Send } from 'lucide-react';
import { openIphoneSession, phoneApi, gestures, pointerAction, typeText } from '../lib/iphoneRemote.js';
import { pointInScreen } from '../lib/macGestures.js';
import { useFullscreen } from '../lib/useFullscreen.js';
import { FullscreenButton } from './FullscreenButton.jsx';

/**
 * Felles fjernstyring av iPhonen for telefonpanelet og Iphone-fanen:
 * billett, skjermstørrelse, status, skjermstrøm (med skjermbilder som
 * reserve), trykk/sveip/langt trykk, knapper og tastatur.
 */
export const BUTTONS = [
  ['home', 'Hjem', Home], ['back', 'Tilbake', ArrowLeft], ['switcher', 'Apper', LayoutGrid], ['control', 'Kontroll', SlidersHorizontal],
  ['scrollUp', 'Rull opp', ChevronUp], ['scrollDown', 'Rull ned', ChevronDown], ['lock', 'Lås', Lock], ['unlock', 'Lås opp', Unlock],
  ['volumeDown', 'Volum ned', Volume1], ['volumeUp', 'Volum opp', Volume2]
];

export function usePhoneRemote(active) {
  const [session, setSession] = useState({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);         // ny billett ved «Prøv igjen» eller utløpt billett
  const [size, setSize] = useState({ width: 375, height: 812 });
  const [status, setStatus] = useState({ ready: null, activity: [] });
  const [mode, setMode] = useState('stream');          // 'stream' | 'shots'
  const [frame, setFrame] = useState(0);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const streamErrors = useRef(0);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    (async () => {
      setSession({ status: 'loading' });
      const s = await openIphoneSession();
      if (!alive) return;
      setSession(s);
      if (s.status === 'ready') { streamErrors.current = 0; setMode('stream'); setFrame(f => f + 1); phoneApi('/api/size').then(v => alive && v?.width && setSize(v)).catch(() => {}); }
    })();
    return () => { alive = false; };
  }, [active, attempt]);

  useEffect(() => {
    if (!active || session.status !== 'ready') return;
    let alive = true;
    const tick = () => phoneApi('/api/status')
      .then(s => alive && setStatus({ ready: !!s?.wda?.ready, activity: Array.isArray(s?.activity) ? s.activity.slice(0, 12) : [] }))
      .catch(e => { if (alive) { setStatus(v => ({ ...v, ready: false })); if (e.status === 401) setAttempt(a => a + 1); } });
    tick(); const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [active, session.status]);

  useEffect(() => {
    if (!active || mode !== 'shots') return;
    const t = setInterval(() => setFrame(f => f + 1), 1000);
    return () => clearInterval(t);
  }, [active, mode]);

  const run = useCallback(async fn => {
    setErr('');
    try { await fn(); } catch (e) { setErr(e.message); }
  }, []);
  const send = useCallback(async value => { setBusy(true); await run(() => typeText(value)); setBusy(false); }, [run]);
  const reconnect = useCallback(() => { streamErrors.current = 0; setMode('stream'); setFrame(f => f + 1); }, []);
  const retry = useCallback(() => setAttempt(a => a + 1), []);
  const onStreamError = useCallback(() => {
    if (mode !== 'stream') return;
    if (++streamErrors.current > 3) setMode('shots');
    else setTimeout(() => setFrame(f => f + 1), 1000 * streamErrors.current);
  }, [mode]);

  const src = session.status !== 'ready' ? '' : mode === 'stream' ? `/iphone/api/stream?t=${frame}` : `/iphone/api/screenshot?t=${frame}`;
  return { session, size, status, src, busy, err, run, send, reconnect, retry, onStreamError, gestures: gestures(size) };
}

/** Telefonskjermen: fyller høyden den får, med telefonens sideforhold. */
export function PhoneScreen({ remote, className = '' }) {
  const { size, src, run, onStreamError } = remote;
  const screenRef = useRef(null), overlayRef = useRef(null), down = useRef(null);
  const [full, toggleFull] = useFullscreen(screenRef);
  // I fullskjerm fyller ikke bildet hele boksen (object-fit: contain), så punktet regnes fra bildets område.
  const toPoint = ev => pointInScreen(ev, overlayRef.current.getBoundingClientRect(), size);
  const onDown = ev => { ev.currentTarget.setPointerCapture(ev.pointerId); down.current = { p: toPoint(ev), t: Date.now() }; };
  const onUp = ev => {
    const d = down.current; down.current = null;
    if (!d) return;
    const [path, body] = pointerAction(d.p, toPoint(ev), (Date.now() - d.t) / 1000);
    run(() => phoneApi(path, body));
  };
  return (
    <div ref={screenRef} className={`relative h-full max-w-full rounded-[26px] overflow-hidden border border-nx-line/70 bg-black select-none shadow-[0_10px_40px_#0008] ${className}`} style={{ aspectRatio: `${size.width} / ${size.height}`, touchAction: 'none' }}>
      {src && <img src={src} alt="iPhone-skjerm" className="absolute inset-0 h-full w-full object-contain pointer-events-none" onError={onStreamError} />}
      <div ref={overlayRef} className="absolute inset-0 cursor-crosshair" onPointerDown={onDown} onPointerUp={onUp}
        onDoubleClick={ev => run(() => phoneApi('/api/doubletap', toPoint(ev)))} onContextMenu={ev => ev.preventDefault()} />
      <FullscreenButton full={full} onToggle={toggleFull} />
    </div>
  );
}

/** Knappene. `vertical` gir én kolonne med etikett ved siden av ikonet. */
export function PhoneButtons({ remote, vertical = false }) {
  return (
    <div className={vertical ? 'flex flex-col gap-1.5' : 'grid grid-cols-5 gap-1.5'} role="group" aria-label="Telefonknapper">
      {BUTTONS.map(([id, label, Icon]) => (
        <button key={id} onClick={() => remote.run(remote.gestures[id])} title={label} aria-label={label}
          className={vertical
            ? 'flex items-center gap-2 rounded-lg border border-nx-line/60 bg-nx-panel/40 px-3 py-2 text-sm text-nx-mute hover:text-nx-cyan hover:border-nx-cyan/40'
            : 'flex flex-col items-center gap-0.5 rounded-lg border border-nx-line/60 bg-nx-panel/40 py-1.5 text-nx-mute hover:text-nx-cyan hover:border-nx-cyan/40'}>
          <Icon size={vertical ? 16 : 15} /><span className={vertical ? '' : 'text-[9px] leading-none'}>{label}</span>
        </button>
      ))}
    </div>
  );
}

/** Tastatur: skriv tekst, Enter og Slett. */
export function PhoneKeyboard({ remote }) {
  const [text, setText] = useState('');
  return (
    <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); if (text) remote.send(text).then(() => setText('')); }}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Skriv på telefonen …" aria-label="Tekst til telefonen"
        className="min-w-0 flex-1 rounded-lg border border-nx-line/60 bg-nx-bg px-2.5 py-2 text-sm text-nx-text" />
      <button type="submit" disabled={remote.busy || !text} className="rounded-lg border border-nx-cyan/50 bg-nx-cyan/15 px-2.5 text-nx-cyan disabled:opacity-40" aria-label="Skriv"><Send size={15} /></button>
      <button type="button" disabled={remote.busy} onClick={() => remote.send('\n')} className="rounded-lg border border-nx-line/60 px-2.5 text-nx-mute hover:text-nx-cyan" aria-label="Enter" title="Enter"><CornerDownLeft size={15} /></button>
      <button type="button" disabled={remote.busy} onClick={() => remote.send('\b')} className="rounded-lg border border-nx-line/60 px-2.5 text-nx-mute hover:text-nx-cyan" aria-label="Slett" title="Slett"><Delete size={15} /></button>
    </form>
  );
}

/** Melding om billettstatus når telefonen ikke er klar. */
export function PhoneSessionNotice({ remote, className = 'text-xs text-nx-mute' }) {
  const s = remote.session.status;
  if (s === 'loading') return <p className={className}>Kobler til telefonen …</p>;
  if (s === 'forbidden') return <p className={className}>Telefonen kan bare styres av administrator.</p>;
  if (s === 'not-configured') return <p className={className}>Iphone-fjernstyring er ikke satt opp på serveren.</p>;
  if (s === 'error') return <p className={className}>Fikk ikke kontakt. <button className="underline" onClick={remote.retry}>Prøv igjen</button></p>;
  return null;
}
