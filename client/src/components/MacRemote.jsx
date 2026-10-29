import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Search, ArrowLeftRight, LayoutGrid, X, CornerDownLeft, XSquare, Copy, ClipboardPaste, Undo2, Lock, Sun, Send, Keyboard, AppWindow } from 'lucide-react';
import { openIphoneSession, macApi, macType, macKey, macActivate, macPointerAction, keyEventAction, eventModifiers } from '../lib/macRemote.js';
import { pointInScreen } from '../lib/macGestures.js';
import { useFullscreen } from '../lib/useFullscreen.js';
import { FullscreenButton } from './FullscreenButton.jsx';
import { createFmp4Player, mseSupported } from '../lib/fmp4Player.js';

/**
 * Felles fjernstyring av Macen (Mac Studio) for Mac-panelet og Mac-fanen:
 * billett (samme som telefonen), skjermstørrelse, status, skjermbilde som
 * H.264-video (MSE) med MJPEG-strøm og skjermbilder som reserve,
 * klikk/dobbeltklikk/høyreklikk/dra/rull, tastatur-fangst, snarveiknapper og apper.
 */
export const MAC_BUTTONS = [
  ['cmd+space', 'Spotlight', Search], ['cmd+tab', 'Bytt app', ArrowLeftRight], ['ctrl+up', 'Oversikt', LayoutGrid], ['escape', 'Esc', X], ['return', 'Enter', CornerDownLeft],
  ['cmd+w', 'Lukk vindu', XSquare], ['cmd+c', 'Kopier', Copy], ['cmd+v', 'Lim inn', ClipboardPaste], ['cmd+z', 'Angre', Undo2], ['ctrl+cmd+q', 'Lås', Lock]
];

export function useMacRemote(active) {
  const [session, setSession] = useState({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const [size, setSize] = useState({ width: 1920, height: 1080 });
  const [status, setStatus] = useState({ ready: null, permissions: {}, frontmost: '', locked: false, activity: [], error: '' });
  const [mode, setMode] = useState(() => mseSupported() ? 'video' : 'stream');   // video → stream (MJPEG) → shots
  const [frame, setFrame] = useState(0);
  const [videoStats, setVideoStats] = useState(null);
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
      if (s.status === 'ready') { streamErrors.current = 0; setMode(mseSupported() ? 'video' : 'stream'); setFrame(f => f + 1); }
    })();
    return () => { alive = false; };
  }, [active, attempt]);

  useEffect(() => {
    if (!active || session.status !== 'ready') return;
    let alive = true;
    const tick = () => macApi('/status')
      .then(s => {
        if (!alive) return;
        const a = s?.agent || {};
        if (a.display?.width) setSize({ width: a.display.width, height: a.display.height });
        setStatus({ ready: a.ok === true, permissions: a.permissions || {}, frontmost: a.frontmost?.name || '', locked: !!a.screenLocked, activity: Array.isArray(s?.activity) ? s.activity.slice(0, 12) : [], error: a.ok ? '' : (a.error || (s?.enabled === false ? 'Mac-fjernstyring er ikke satt opp i iphone-remote.' : 'Mac-agenten svarer ikke.')) });
      })
      .catch(e => { if (alive) { setStatus(v => ({ ...v, ready: false, error: e.message })); if (e.status === 401) setAttempt(a => a + 1); } });
    tick(); const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [active, session.status]);

  useEffect(() => {
    if (!active || mode !== 'shots') return;
    const t = setInterval(() => setFrame(f => f + 1), 1000);
    return () => clearInterval(t);
  }, [active, mode]);

  const run = useCallback(async fn => { setErr(''); try { await fn(); } catch (e) { setErr(e.message); } }, []);
  const send = useCallback(async text => { setBusy(true); await run(() => macType(text)); setBusy(false); }, [run]);
  const key = useCallback(combo => run(() => macKey(combo)), [run]);
  const reconnect = useCallback(() => { streamErrors.current = 0; setMode(mseSupported() ? 'video' : 'stream'); setVideoStats(null); setFrame(f => f + 1); }, []);
  const retry = useCallback(() => setAttempt(a => a + 1), []);
  // Tre forsøk på nytt, så ett hakk ned: video → MJPEG → skjermbilder.
  const onStreamError = useCallback(() => {
    if (mode === 'shots') return;
    if (++streamErrors.current > 3) { streamErrors.current = 0; setMode(mode === 'video' ? 'stream' : 'shots'); setVideoStats(null); }
    else setTimeout(() => setFrame(f => f + 1), 1000 * streamErrors.current);
  }, [mode]);

  const src = session.status !== 'ready' || mode === 'video' ? '' : mode === 'stream' ? `/iphone/api/mac/stream?w=1280&fps=8&t=${frame}` : `/iphone/api/mac/screenshot?w=1280&t=${frame}`;
  const videoUrl = session.status === 'ready' && mode === 'video' ? `/iphone/api/mac/video?t=${frame}` : '';
  return { session, size, status, mode, src, videoUrl, videoStats, setVideoStats, busy, err, run, send, key, reconnect, retry, onStreamError };
}

/** Mac-skjermen: så stor som plassen tillater i skjermens sideforhold. Klikk i bildet og skriv for å sende tastetrykk. Knappen nede til høyre gir fullskjerm (Esc avslutter). */
export function MacScreen({ remote, className = '' }) {
  const { size, src, videoUrl, run, onStreamError, setVideoStats } = remote;
  const wrapRef = useRef(null), screenRef = useRef(null), overlayRef = useRef(null), videoRef = useRef(null), down = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [focused, setFocused] = useState(false);
  const [full, toggleFull] = useFullscreen(screenRef);

  // Bildet skal fylle boksen helt (pekerkoordinatene regner med det), så boksen får skjermens sideforhold innenfor plassen den har.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight, r = size.width / size.height;
      if (!w || !h) return;
      const width = Math.min(w, h * r);
      setBox({ width, height: width / r });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size.width, size.height]);

  // I fullskjerm fyller ikke bildet hele boksen (object-fit: contain), så punktet regnes fra bildets område.
  const toPoint = ev => pointInScreen(ev, overlayRef.current.getBoundingClientRect(), size);
  const onDown = ev => { ev.currentTarget.focus(); if (ev.button !== 0) return; ev.currentTarget.setPointerCapture(ev.pointerId); down.current = { p: toPoint(ev), t: Date.now() }; };
  const onUp = ev => {
    const d = down.current; down.current = null;
    if (!d || ev.button !== 0) return;
    const [path, body] = macPointerAction(d.p, toPoint(ev), (Date.now() - d.t) / 1000, ev.detail, eventModifiers(ev));
    run(() => macApi(path.replace('/api/mac', ''), body));
  };
  const onContext = ev => { ev.preventDefault(); const p = toPoint(ev); run(() => macApi('/click', { x: p.x, y: p.y, button: 'right' })); };
  const wheel = useRef({ dx: 0, dy: 0, pos: null, busy: false });
  const flushWheel = async () => {
    const w = wheel.current;
    if (w.busy) return;
    w.busy = true;
    await new Promise(r => setTimeout(r, 80));
    const dx = Math.round(w.dx), dy = Math.round(w.dy); w.dx = 0; w.dy = 0;
    const p = w.pos || { x: size.width / 2, y: size.height / 2 };
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) await run(() => macApi('/scroll', { x: p.x, y: p.y, dx, dy }));
    w.busy = false;
    if (Math.abs(w.dx) > 2 || Math.abs(w.dy) > 2) flushWheel();
  };
  const onWheel = ev => { ev.preventDefault(); wheel.current.dx += ev.deltaX; wheel.current.dy += ev.deltaY; wheel.current.pos = toPoint(ev); flushWheel(); };
  const onKey = ev => {
    if (ev.key === 'Escape' && full) return; // nettleseren avslutter fullskjerm; ikke send Esc til Macen i tillegg
    const action = keyEventAction(ev);
    if (!action) return;
    ev.preventDefault();
    run(() => macApi(action[0].replace('/api/mac', ''), action[1]));
  };
  // Videoen (H.264 over MSE) startes når adressen settes; feil gir ett hakk ned til MJPEG via onStreamError.
  useEffect(() => {
    const v = videoRef.current;
    if (!videoUrl || !v) return;
    const p = createFmp4Player(v, videoUrl, { onError: onStreamError, onStats: setVideoStats });
    return () => p.stop();
  }, [videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  // Hjul-hendelsen må registreres uten passive for at preventDefault skal virke.
  useEffect(() => { const el = overlayRef.current; if (!el) return; el.addEventListener('wheel', onWheel, { passive: false }); return () => el.removeEventListener('wheel', onWheel); });

  return (
    <div ref={wrapRef} className={`h-full w-full flex items-center justify-center min-h-0 min-w-0 ${className}`}>
      <div ref={screenRef} className={`relative rounded-xl overflow-hidden border bg-black select-none shadow-[0_10px_40px_#0008] outline-none ${focused ? 'border-nx-cyan/70' : 'border-nx-line/70'}`}
        style={{ width: box.width || '100%', height: box.height || undefined, aspectRatio: box.width ? undefined : `${size.width} / ${size.height}`, touchAction: 'none' }}
        tabIndex={0} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={onKey} aria-label="Mac-skjerm, tastetrykk sendes til Macen når den har fokus">
        {videoUrl && <video ref={videoRef} muted autoPlay playsInline aria-label="Mac-skjerm (video)" className="absolute inset-0 h-full w-full object-contain pointer-events-none bg-black" />}
        {src && <img src={src} alt="Mac-skjerm" className="absolute inset-0 h-full w-full object-contain pointer-events-none" onError={onStreamError} />}
        <div ref={overlayRef} className="absolute inset-0 cursor-crosshair" onPointerDown={onDown} onPointerUp={onUp} onContextMenu={onContext} />
        {focused && <span className="absolute right-2 top-2 rounded-md bg-nx-bg/70 px-1.5 py-0.5 text-[10px] text-nx-cyan flex items-center gap-1"><Keyboard size={11} /> tastatur til Macen</span>}
        <FullscreenButton full={full} onToggle={toggleFull} />
      </div>
    </div>
  );
}

/** Snarveiknappene. `vertical` gir én kolonne med etikett ved siden av ikonet. */
export function MacButtons({ remote, vertical = false }) {
  return (
    <div className={vertical ? 'flex flex-col gap-1.5' : 'grid grid-cols-5 gap-1.5'} role="group" aria-label="Mac-snarveier">
      {MAC_BUTTONS.map(([combo, label, Icon]) => (
        <button key={combo} onClick={() => remote.key(combo)} title={`${label} (${combo})`} aria-label={label}
          className={vertical
            ? 'flex items-center gap-2 rounded-lg border border-nx-line/60 bg-nx-panel/40 px-3 py-2 text-sm text-nx-mute hover:text-nx-cyan hover:border-nx-cyan/40'
            : 'flex flex-col items-center gap-0.5 rounded-lg border border-nx-line/60 bg-nx-panel/40 py-1.5 text-nx-mute hover:text-nx-cyan hover:border-nx-cyan/40'}>
          <Icon size={vertical ? 16 : 15} /><span className={vertical ? '' : 'text-[9px] leading-none'}>{label}</span>
        </button>
      ))}
    </div>
  );
}

/** Tastatur: skriv tekst, Enter, og en snarvei som tekst (f.eks. cmd+shift+4). */
export function MacKeyboard({ remote }) {
  const [text, setText] = useState('');
  const [combo, setCombo] = useState('');
  return (
    <div className="space-y-1.5">
      <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); if (text) remote.send(text).then(() => setText('')); }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Skriv på Macen …" aria-label="Tekst til Macen"
          className="min-w-0 flex-1 rounded-lg border border-nx-line/60 bg-nx-bg px-2.5 py-2 text-sm text-nx-text" />
        <button type="submit" disabled={remote.busy || !text} className="rounded-lg border border-nx-cyan/50 bg-nx-cyan/15 px-2.5 text-nx-cyan disabled:opacity-40" aria-label="Skriv"><Send size={15} /></button>
        <button type="button" disabled={remote.busy} onClick={() => remote.key('return')} className="rounded-lg border border-nx-line/60 px-2.5 text-nx-mute hover:text-nx-cyan" aria-label="Enter" title="Enter"><CornerDownLeft size={15} /></button>
      </form>
      <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); if (combo.trim()) remote.key(combo.trim()); }}>
        <input value={combo} onChange={e => setCombo(e.target.value)} placeholder="Snarvei, f.eks. cmd+shift+4" aria-label="Snarvei"
          className="min-w-0 flex-1 rounded-lg border border-nx-line/60 bg-nx-bg px-2.5 py-2 text-sm text-nx-text" />
        <button type="submit" disabled={!combo.trim()} className="chip">Trykk</button>
      </form>
    </div>
  );
}

/** Kjørende apper; klikk henter appen fram. */
export function MacApps({ remote, active = true }) {
  const [apps, setApps] = useState(null);
  const load = useCallback(() => macApi('/apps').then(r => setApps(r.apps || [])).catch(() => setApps([])), []);
  useEffect(() => { if (!active || remote.session.status !== 'ready') return; load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [active, remote.session.status, load]);
  if (apps === null) return <p className="text-xs text-nx-mute">Henter apper …</p>;
  if (!apps.length) return <p className="text-xs text-nx-mute">Ingen apper med vindu.</p>;
  return (
    <ul className="space-y-1 text-xs">
      {apps.map(a => (
        <li key={a.pid}>
          <button onClick={() => remote.run(() => macActivate(a.bundleId || a.name)).then(() => setTimeout(load, 800))} className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-nx-cyan/10 ${a.active ? 'text-nx-green' : 'text-nx-text'}`}>
            <AppWindow size={12} className="shrink-0 text-nx-mute" /><span className="truncate">{a.name}</span>{a.hidden && <span className="ml-auto text-[10px] text-nx-mute">skjult</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Statuslinje: tillatelser som mangler, låst skjerm, app i front. */
export function MacStatusLine({ remote }) {
  const s = remote.status;
  if (s.ready === null) return <span className="text-xs text-nx-mute">Kobler til Macen …</span>;
  if (!s.ready) return <span className="text-xs text-nx-amber">{s.error || 'Macen svarer ikke'}</span>;
  const parts = [];
  if (s.permissions.screenRecording === false) parts.push('mangler Skjermopptak-tillatelse');
  if (s.permissions.accessibility === false) parts.push('mangler Tilgjengelighet (mus og tastatur virker ikke)');
  if (s.locked) parts.push('skjermen er låst');
  const v = remote.videoStats;
  const tail = remote.mode === 'video' && v ? ` · video ${v.fps} b/s, ${v.kbps >= 1000 ? `${(v.kbps / 1000).toFixed(1)} Mbit/s` : `${v.kbps} kbit/s`}` : remote.mode === 'stream' ? ' · MJPEG' : remote.mode === 'shots' ? ' · skjermbilder' : '';
  return <span className={`text-xs ${parts.length ? 'text-nx-amber' : 'text-nx-mute'}`}>{(parts.length ? parts.join(' · ') : (s.frontmost ? `Foran: ${s.frontmost}` : 'Macen er klar')) + tail}</span>;
}

/** Vekk skjermen. */
export const macWake = () => macApi('/wake', {});
export { Sun as WakeIcon };
