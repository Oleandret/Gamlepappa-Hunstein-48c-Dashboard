import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, X, Home, ArrowLeft, LayoutGrid, SlidersHorizontal, Lock, Unlock, Volume1, Volume2, ChevronUp, ChevronDown, RefreshCw, CornerDownLeft, Delete, Send } from 'lucide-react';
import { openIphoneSession, phoneApi, gestures, pointerAction, typeText } from '../lib/iphoneRemote.js';

/**
 * Telefonpanel til høyre på alle sider: iPhone-skjermen (trykk, sveip, langt
 * trykk), knapper og tastatur nederst. Smalt med et ikon når det er lukket;
 * åpnes og lukkes med klikk (ikke hover), og skjermstrømmen går bare mens
 * panelet er åpent. Samme tilgang som Iphone-fanen: administrator.
 */
const BUTTONS = [
  ['home', 'Hjem', Home], ['back', 'Tilbake', ArrowLeft], ['switcher', 'Apper', LayoutGrid], ['control', 'Kontroll', SlidersHorizontal],
  ['scrollUp', 'Rull opp', ChevronUp], ['scrollDown', 'Rull ned', ChevronDown], ['lock', 'Lås', Lock], ['unlock', 'Lås opp', Unlock],
  ['volumeDown', 'Volum ned', Volume1], ['volumeUp', 'Volum opp', Volume2]
];

export function PhoneSidebar({ open, onToggle }) {
  const [session, setSession] = useState({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);         // ny billett ved «Prøv igjen» eller utløpt billett
  const [size, setSize] = useState({ width: 375, height: 812 });
  const [ready, setReady] = useState(null);           // WebDriverAgent klar?
  const [mode, setMode] = useState('stream');          // 'stream' | 'shots'
  const [frame, setFrame] = useState(0);
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const overlayRef = useRef(null), down = useRef(null), streamErrors = useRef(0);

  // Billett og skjermstørrelse når panelet åpnes.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setSession({ status: 'loading' });
      const s = await openIphoneSession();
      if (!alive) return;
      setSession(s);
      if (s.status === 'ready') { streamErrors.current = 0; setMode('stream'); setFrame(f => f + 1); phoneApi('/api/size').then(v => alive && v?.width && setSize(v)).catch(() => {}); }
    })();
    return () => { alive = false; };
  }, [open, attempt]);

  // Status hvert 5. sekund mens panelet er åpent.
  useEffect(() => {
    if (!open || session.status !== 'ready') return;
    let alive = true;
    const tick = () => phoneApi('/api/status').then(s => alive && setReady(!!s?.wda?.ready)).catch(e => { if (alive) { setReady(false); if (e.status === 401) setAttempt(a => a + 1); } });
    tick(); const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [open, session.status]);

  // Skjermbilder i stedet for strøm når strømmen ikke holder.
  useEffect(() => {
    if (!open || mode !== 'shots') return;
    const t = setInterval(() => setFrame(f => f + 1), 1000);
    return () => clearInterval(t);
  }, [open, mode]);

  const run = useCallback(async (fn) => {
    setErr('');
    try { await fn(); } catch (e) { setErr(e.message); }
  }, []);

  const toPoint = ev => {
    const r = overlayRef.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(size.width, (ev.clientX - r.left) / r.width * size.width)), y: Math.max(0, Math.min(size.height, (ev.clientY - r.top) / r.height * size.height)) };
  };
  const onDown = ev => { ev.currentTarget.setPointerCapture(ev.pointerId); down.current = { p: toPoint(ev), t: Date.now() }; };
  const onUp = ev => {
    const d = down.current; down.current = null;
    if (!d) return;
    const [path, body] = pointerAction(d.p, toPoint(ev), (Date.now() - d.t) / 1000);
    run(() => phoneApi(path, body));
  };

  async function send(value) {
    setBusy(true);
    await run(() => typeText(value));
    setBusy(false);
  }

  const src = session.status !== 'ready' ? '' : mode === 'stream' ? `/iphone/api/stream?t=${frame}` : `/iphone/api/screenshot?t=${frame}`;
  const g = gestures(size);

  if (!open) {
    return (
      <aside aria-label="Telefon" className="shrink-0 w-14 border-l border-nx-line/60 bg-nx-bg/80 backdrop-blur-md py-6 relative z-30 flex flex-col items-center">
        <button onClick={onToggle} className="mt-2 flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-nx-cyan hover:bg-nx-cyan/10" aria-label="Åpne telefonpanelet" title="Iphone">
          <Smartphone size={20} />
          <span className="text-[9px] uppercase tracking-[0.16em] text-nx-mute">Iphone</span>
        </button>
      </aside>
    );
  }

  // Festet til høyre kant så telefonen står i ro mens siden rulles; plassholderen holder av bredden.
  return (<>
    <div className="shrink-0 w-[340px]" aria-hidden="true" />
    <aside aria-label="Telefon" className="fixed right-0 top-0 bottom-0 w-[340px] border-l border-nx-line/60 bg-nx-bg/95 backdrop-blur-md pt-4 pb-24 px-3 z-40 flex flex-col gap-3">
      {/* pb-24: taleassistentens knapp ligger fast nede til høyre; tastaturet skal stå over den. */}
      <header className="flex items-center gap-2">
        <Smartphone size={15} className="text-nx-cyan" />
        <div className="font-display font-semibold tracking-wide text-sm">IPHONE</div>
        <span className={`ml-1 h-2 w-2 rounded-full ${ready ? 'bg-nx-green' : ready === false ? 'bg-nx-red' : 'bg-nx-mute'}`} title={ready ? 'WebDriverAgent klar' : ready === false ? 'WebDriverAgent svarer ikke' : 'Kobler til'} />
        <button onClick={() => { streamErrors.current = 0; setMode('stream'); setFrame(f => f + 1); }} className="ml-auto p-1 text-nx-mute hover:text-nx-cyan" aria-label="Koble til skjermen på nytt"><RefreshCw size={14} /></button>
        <button onClick={onToggle} className="p-1 text-nx-mute hover:text-nx-cyan" aria-label="Lukk telefonpanelet"><X size={15} /></button>
      </header>

      {session.status === 'loading' && <p className="text-xs text-nx-mute">Kobler til telefonen …</p>}
      {session.status === 'forbidden' && <p className="text-xs text-nx-mute">Telefonen kan bare styres av administrator.</p>}
      {session.status === 'not-configured' && <p className="text-xs text-nx-mute">Iphone-fjernstyring er ikke satt opp på serveren.</p>}
      {session.status === 'error' && <p className="text-xs text-nx-mute">Fikk ikke kontakt. <button className="underline" onClick={() => setAttempt(a => a + 1)}>Prøv igjen</button></p>}

      {session.status === 'ready' && <>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="relative h-full max-w-full rounded-[22px] overflow-hidden border border-nx-line/70 bg-black select-none" style={{ aspectRatio: `${size.width} / ${size.height}`, touchAction: 'none' }}>
            {src && <img src={src} alt="iPhone-skjerm" className="absolute inset-0 h-full w-full object-contain pointer-events-none"
              onError={() => { if (mode === 'stream' && ++streamErrors.current > 3) setMode('shots'); else if (mode === 'stream') setTimeout(() => setFrame(f => f + 1), 1000 * streamErrors.current); }} />}
            <div ref={overlayRef} className="absolute inset-0 cursor-crosshair" onPointerDown={onDown} onPointerUp={onUp}
              onDoubleClick={ev => run(() => phoneApi('/api/doubletap', toPoint(ev)))} onContextMenu={ev => ev.preventDefault()} />
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Telefonknapper">
          {BUTTONS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => run(g[id])} title={label} aria-label={label}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-nx-line/60 bg-nx-panel/40 py-1.5 text-nx-mute hover:text-nx-cyan hover:border-nx-cyan/40">
              <Icon size={15} /><span className="text-[9px] leading-none">{label}</span>
            </button>
          ))}
        </div>

        <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); if (text) send(text).then(() => setText('')); }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Skriv på telefonen …" aria-label="Tekst til telefonen"
            className="min-w-0 flex-1 rounded-lg border border-nx-line/60 bg-nx-bg px-2.5 py-2 text-sm text-nx-text" />
          <button type="submit" disabled={busy || !text} className="rounded-lg border border-nx-cyan/50 bg-nx-cyan/15 px-2.5 text-nx-cyan disabled:opacity-40" aria-label="Skriv"><Send size={15} /></button>
          <button type="button" disabled={busy} onClick={() => send('\n')} className="rounded-lg border border-nx-line/60 px-2.5 text-nx-mute hover:text-nx-cyan" aria-label="Enter" title="Enter"><CornerDownLeft size={15} /></button>
          <button type="button" disabled={busy} onClick={() => send('\b')} className="rounded-lg border border-nx-line/60 px-2.5 text-nx-mute hover:text-nx-cyan" aria-label="Slett" title="Slett"><Delete size={15} /></button>
        </form>
        {err && <p role="alert" className="text-[11px] text-nx-amber">{err}</p>}
        <p className="text-[10px] text-nx-mute">Klikk = trykk · dra = sveip · hold = langt trykk. Tastaturet på telefonen må være synlig for at tekst skal gå inn.</p>
      </>}
    </aside>
  </>);
}
