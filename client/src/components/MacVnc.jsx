import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RFB from '@novnc/novnc';
import { X, Keyboard, Maximize2, Minimize2, ExternalLink, RefreshCw } from 'lucide-react';
import { macName, macVncUrl } from '../lib/macs.js';
import { vncSocketUrl, keysymForChar, keysymForKey, KEY_BAR, XK, VNC_USER_KEY, vncStatusText } from '../lib/vnc.js';
import { useFullscreen } from '../lib/useFullscreen.js';

/**
 * Skjermdeling (VNC) i nettleseren, med noVNC: hele vinduet, over alt annet. Går via
 * dashboardets /iphone-mellomtjener til iphone-remote, som kobler til Macens innebygde
 * Skjermdeling (port 5900) over tailnettet. Laget for mobil: skjermen skaleres til plassen,
 * ett fingertrykk er klikk, dra er mus, langt trykk er høyreklikk, to fingre ruller
 * (noVNC sine egne bevegelser). «Tastatur» henter fram mobilens tastatur gjennom et skjult
 * felt; tasteraden gir spesialtastene, ⌘/⌃/⌥ holdes til neste tast.
 * Brukernavn og passord på Macen spørres det om når Macen ber om det (ARD/VNC-innlogging);
 * bare brukernavnet huskes, i nettleseren.
 */
const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform || '');

export function MacVnc({ macId, onClose }) {
  const screenRef = useRef(null), rfbRef = useRef(null), inputRef = useRef(null), overlayRef = useRef(null);
  const [status, setStatus] = useState('connecting');
  const [detail, setDetail] = useState('');
  const [user, setUser] = useState(() => { try { return localStorage.getItem(VNC_USER_KEY(macId)) || ''; } catch { return ''; } });
  const [password, setPassword] = useState('');
  const [sticky, setSticky] = useState(() => new Set());
  const [attempt, setAttempt] = useState(0);
  const [full, toggleFull] = useFullscreen(overlayRef);

  // Koble til (på nytt ved «attempt»).
  useEffect(() => {
    const target = screenRef.current;
    if (!target) return;
    setStatus('connecting'); setDetail('');
    let rfb;
    try {
      rfb = new RFB(target, vncSocketUrl(macId, window.location), { shared: true, wsProtocols: [] });
    } catch (e) { setStatus('error'); setDetail(e.message); return; }
    rfb.scaleViewport = true; rfb.resizeSession = false; rfb.clipViewport = false;
    rfb.showDotCursor = true; rfb.background = '#000'; rfb.focusOnClick = true;
    rfb.addEventListener('connect', () => setStatus('connected'));
    rfb.addEventListener('credentialsrequired', () => setStatus('credentials'));
    rfb.addEventListener('securityfailure', e => { setStatus('error'); setDetail(e.detail?.reason ? `Innlogging avvist: ${e.detail.reason}` : 'Innlogging avvist'); });
    rfb.addEventListener('disconnect', e => setStatus(s => (s === 'error' ? s : e.detail?.clean ? 'closed' : 'error')));
    rfbRef.current = rfb;
    return () => { rfbRef.current = null; try { rfb.disconnect(); } catch { /* allerede nede */ } };
  }, [macId, attempt]);

  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);
  useEffect(() => { const on = e => { if (e.key === 'Escape' && status !== 'connected') onClose(); }; document.addEventListener('keydown', on); return () => document.removeEventListener('keydown', on); }, [status, onClose]);

  const submitCredentials = e => {
    e.preventDefault();
    try { localStorage.setItem(VNC_USER_KEY(macId), user); } catch { /* privat modus */ }
    rfbRef.current?.sendCredentials({ username: user, password });
    setPassword(''); setStatus('connecting');
  };

  // Tastetrykk: klebrige modifikatorer holdes nede rundt tasten og slippes etterpå.
  const press = useCallback(keysym => {
    const rfb = rfbRef.current; if (!rfb) return;
    const mods = [...sticky];
    for (const m of mods) rfb.sendKey(m, null, true);
    rfb.sendKey(keysym, null);
    for (const m of mods.reverse()) rfb.sendKey(m, null, false);
    if (mods.length) setSticky(new Set());
  }, [sticky]);
  const onBarKey = (keysym, isSticky) => {
    if (!isSticky) return press(keysym);
    setSticky(prev => { const next = new Set(prev); if (next.has(keysym)) next.delete(keysym); else next.add(keysym); return next; });
  };
  const onInput = e => { const v = e.target.value; e.target.value = ''; for (const ch of v) press(keysymForChar(ch)); };
  const onKeyDown = e => { const sym = keysymForKey(e.key); if (sym === null) return; e.preventDefault(); press(sym); };

  const overlay = (
    <div ref={overlayRef} className="fixed inset-0 z-[110] flex flex-col bg-black text-nx-text" role="dialog" aria-label={`Skjermdeling: ${macName(macId)}`}>
      <div className="flex items-center gap-1.5 overflow-x-auto px-2 py-1.5 bg-nx-bg/95 border-b border-nx-line/60 text-xs shrink-0">
        <span className="font-semibold whitespace-nowrap">{macName(macId)}</span>
        <span className={`whitespace-nowrap ${status === 'connected' ? 'text-nx-green' : status === 'error' ? 'text-nx-amber' : 'text-nx-mute'}`}>{vncStatusText(status, detail)}</span>
        <span className="flex-1" />
        {status === 'connected' && <button onClick={() => inputRef.current?.focus()} className="chip !py-1 !px-2 inline-flex items-center gap-1 whitespace-nowrap" title="Hent fram tastaturet"><Keyboard size={13} /> Tastatur</button>}
        {(status === 'error' || status === 'closed') && <button onClick={() => setAttempt(a => a + 1)} className="chip !py-1 !px-2 inline-flex items-center gap-1 whitespace-nowrap"><RefreshCw size={13} /> Koble til på nytt</button>}
        {isMac && macVncUrl(macId) && <a href={macVncUrl(macId)} className="chip !py-1 !px-2 inline-flex items-center gap-1 whitespace-nowrap" title="Åpne i Skjermdeling-appen på denne Macen"><ExternalLink size={13} /> Appen</a>}
        <button onClick={toggleFull} className="p-1 text-nx-mute hover:text-nx-cyan" aria-label={full ? 'Avslutt fullskjerm' : 'Fullskjerm'}>{full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
        <button onClick={onClose} className="p-1 text-nx-mute hover:text-nx-cyan" aria-label="Lukk skjermdeling"><X size={16} /></button>
      </div>
      {status === 'connected' && (
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-1 bg-nx-bg/90 border-b border-nx-line/40 shrink-0" role="toolbar" aria-label="Spesialtaster">
          {KEY_BAR.map(([label, keysym, isSticky]) => (
            <button key={label} onClick={() => onBarKey(keysym, isSticky)} aria-pressed={isSticky ? sticky.has(keysym) : undefined}
              className={`rounded border px-2 py-0.5 font-mono text-[11px] whitespace-nowrap ${isSticky && sticky.has(keysym) ? 'border-nx-cyan bg-nx-cyan/20 text-nx-cyan' : 'border-nx-line/60 text-nx-text hover:text-nx-cyan'}`}>{label}</button>
          ))}
        </div>
      )}
      <div className="relative flex-1 min-h-0">
        <div ref={screenRef} className="absolute inset-0" />
        {/* Skjult felt som henter fram mobilens tastatur; tegnene sendes som tastetrykk. */}
        <input ref={inputRef} onInput={onInput} onKeyDown={onKeyDown} aria-label="Skriv til Macen" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
          className="absolute left-0 top-0 h-px w-px opacity-0" />
        {status === 'credentials' && (
          <form onSubmit={submitCredentials} className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
            <div className="panel p-4 w-full max-w-xs space-y-2">
              <p className="panel-title">Logg inn på {macName(macId)}</p>
              <p className="text-xs text-nx-mute">Brukernavn og passord på Macen (det du logger inn med der). Passordet lagres ikke.</p>
              <input value={user} onChange={e => setUser(e.target.value)} placeholder="Brukernavn" autoCapitalize="off" autoCorrect="off" autoComplete="username" aria-label="Brukernavn"
                className="w-full rounded-lg border border-nx-line/60 bg-nx-bg px-2.5 py-2 text-sm text-nx-text" />
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Passord" autoComplete="current-password" aria-label="Passord" autoFocus
                className="w-full rounded-lg border border-nx-line/60 bg-nx-bg px-2.5 py-2 text-sm text-nx-text" />
              <div className="flex gap-2 justify-end"><button type="button" onClick={onClose} className="chip">Avbryt</button><button type="submit" className="chip">Logg inn</button></div>
            </div>
          </form>
        )}
        {(status === 'error' || status === 'closed') && (
          <div className="absolute inset-x-0 bottom-0 p-3 text-center text-xs text-nx-mute bg-black/70">
            {status === 'error' ? `${vncStatusText('error', detail)}. Skjermdeling må være slått på på Macen (Systeminnstillinger → Generelt → Deling).` : 'Forbindelsen er avsluttet.'}
          </div>
        )}
      </div>
    </div>
  );
  return createPortal(overlay, document.body);
}

export { XK };
