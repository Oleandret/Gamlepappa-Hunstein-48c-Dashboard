import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';

/**
 * Iphone: iphone-remote vist i dashboardet, ferdig innlogget. Serveren holder
 * innloggingen mot iphone-remote; her hentes bare en kortlivet billett
 * (cookie for /iphone/) før rammen lastes.
 *
 * Zoom skalerer hele rammen med CSS (transform), så trykk og sveip fortsatt
 * treffer riktig inne i appen. «Tilpass» måler telefonbildet i rammen og
 * velger zoom slik at hele iPhonen får plass i høyden.
 */
const ZOOM_MIN = 0.3, ZOOM_MAX = 1.5, ZOOM_STEP = 0.1, ZOOM_KEY = 'nexora.iphone.zoom';
const clamp = z => Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 100) / 100;
function savedZoom() { try { const z = Number(localStorage.getItem(ZOOM_KEY)); return Number.isFinite(z) && z > 0 ? clamp(z) : null; } catch { return null; } }

export function IphoneView() {
  const [state, setState] = useState({ status: 'loading' });
  const [frameKey, setFrameKey] = useState(0);
  const [zoom, setZoom] = useState(() => savedZoom() ?? 1);
  const autoFit = useRef(savedZoom() === null);   // første gang: tilpass automatisk
  const stageRef = useRef(null), frameRef = useRef(null);

  useEffect(() => { try { localStorage.setItem(ZOOM_KEY, String(zoom)); } catch {} }, [zoom]);

  async function open() {
    setState({ status: 'loading' });
    try {
      const r = await apiFetch('/api/iphone/session', { method: 'POST' });
      if (r.status === 403) return setState({ status: 'forbidden' });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setState(d.configured ? { status: 'ready', path: d.path } : { status: 'not-configured' });
      setFrameKey(k => k + 1);
    } catch { setState({ status: 'error' }); }
  }
  useEffect(() => { open(); }, []);

  /** Zoom slik at telefonbildet (pluss toppfeltet over) passer i rammens høyde. */
  const measure = useCallback(() => {
    const stage = stageRef.current, doc = frameRef.current?.contentDocument;
    const phone = doc?.querySelector('.phone');
    // Bare når telefonbildet faktisk vises (ikke under innlogging eller før siden er bygd opp).
    if (!stage || !phone || phone.getBoundingClientRect().height < 100) return null;
    const rect = phone.getBoundingClientRect();          // i rammens egne (uskalerte) koordinater
    const scrollTop = doc.scrollingElement?.scrollTop || 0;
    const needed = rect.bottom + scrollTop + 16;
    if (!(needed > 0)) return null;
    return { stage: stage.clientHeight, needed };
  }, []);
  // Ny bredde kan endre appens oppsett, så mål én gang til etter første justering.
  const fit = useCallback(() => {
    const m = measure();
    if (!m) return false;
    setZoom(clamp(m.stage / m.needed));
    setTimeout(() => { const again = measure(); if (again) setZoom(clamp(again.stage / again.needed)); }, 350);
    return true;
  }, [measure]);

  const onLoad = () => {
    if (!autoFit.current) return;
    // Siden bygger seg opp etter innlasting; prøv igjen et par ganger til telefonbildet finnes.
    let tries = 0;
    const attempt = () => { if (fit() || ++tries > 10) { autoFit.current = false; return; } setTimeout(attempt, 300); };
    attempt();
  };

  const stageHeight = 'max(560px, calc(100vh - 230px))';

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="panel-title">Fjernstyring</p>
          <h1 className="text-2xl font-semibold mt-1">Iphone</h1>
        </div>
        {state.status === 'ready' && (
          <div className="flex gap-2 flex-wrap items-center">
            <div className="inline-flex items-center rounded-lg border border-nx-line/70 bg-nx-panel/40" role="group" aria-label="Zoom">
              <button className="px-2.5 py-1.5 text-nx-mute hover:text-nx-cyan disabled:opacity-40" onClick={() => setZoom(z => clamp(z - ZOOM_STEP))} disabled={zoom <= ZOOM_MIN} aria-label="Zoom ut"><ZoomOut size={16} /></button>
              <button className="min-w-[56px] px-1 py-1.5 font-mono text-xs text-nx-text hover:text-nx-cyan" onClick={() => setZoom(1)} title="Tilbake til 100 %">{Math.round(zoom * 100)} %</button>
              <button className="px-2.5 py-1.5 text-nx-mute hover:text-nx-cyan disabled:opacity-40" onClick={() => setZoom(z => clamp(z + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX} aria-label="Zoom inn"><ZoomIn size={16} /></button>
            </div>
            <button className="chip inline-flex items-center gap-1.5" onClick={fit} title="Tilpass slik at hele iPhonen synes"><Maximize size={14} /> Tilpass</button>
            <button className="chip inline-flex items-center gap-1.5" onClick={() => { autoFit.current = false; open(); }}><RefreshCw size={14} /> Last inn på nytt</button>
            <a className="chip inline-flex items-center gap-1.5" href={state.path} target="_blank" rel="noopener"><ExternalLink size={14} /> Eget vindu</a>
          </div>
        )}
      </header>
      {state.status === 'loading' && <p className="panel p-5 text-sm text-nx-mute">Kobler til telefonen …</p>}
      {state.status === 'forbidden' && <p className="panel p-5 text-sm">Iphone-fjernstyring krever administratorinnlogging i dashboardet.</p>}
      {state.status === 'not-configured' && <p className="panel p-5 text-sm">Iphone-fjernstyring er ikke satt opp på serveren ennå. Sett <code>IPHONE_REMOTE_URL</code>, <code>IPHONE_REMOTE_USER</code> og <code>IPHONE_REMOTE_PASSWORD</code> i Railway.</p>}
      {state.status === 'error' && <p className="panel p-5 text-sm">Fikk ikke kontakt med serveren. <button className="chip ml-2" onClick={open}>Prøv igjen</button></p>}
      {state.status === 'ready' && (
        <div ref={stageRef} className="relative w-full overflow-hidden rounded-2xl border border-nx-line/60 bg-black" style={{ height: stageHeight }}>
          <iframe
            key={frameKey}
            ref={frameRef}
            src={state.path}
            onLoad={onLoad}
            title="Iphone fjernstyring"
            className="block border-0 bg-black"
            // Rammen tegnes større/mindre og skaleres, så den alltid fyller flaten.
            style={{ width: `${100 / zoom}%`, height: `calc(${stageHeight} / ${zoom})`, transform: `scale(${zoom})`, transformOrigin: '0 0' }}
            allow="clipboard-write"
            referrerPolicy="same-origin"
          />
        </div>
      )}
    </section>
  );
}
