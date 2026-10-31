import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RFB from '@novnc/novnc';
import { X, Keyboard, Maximize2, Minimize2, ExternalLink, RefreshCw } from 'lucide-react';
import { macName, macVncUrl } from '../lib/macs.js';
import { macApi } from '../lib/macRemote.js';
import { vncSocketUrl, keysymForChar, keysymForKey, KEY_BAR, XK, VNC_USER_KEY, vncStatusText, VNC_QUALITIES, VNC_QUALITY_KEY, validVncQuality, rateLabel, loadVncLogin, saveVncLogin, forgetVncLogin } from '../lib/vnc.js';
import { useFullscreen } from '../lib/useFullscreen.js';

/**
 * Skjermdeling (VNC) i nettleseren, med noVNC: hele vinduet, over alt annet. Går via
 * dashboardets /iphone-mellomtjener til iphone-remote, som kobler til Macens innebygde
 * Skjermdeling (port 5900) over tailnettet. Laget for mobil: skjermen skaleres til plassen,
 * ett fingertrykk er klikk, dra er mus, langt trykk er høyreklikk, to fingre ruller
 * (noVNC sine egne bevegelser). «Tastatur» henter fram mobilens tastatur gjennom et skjult
 * felt; tasteraden gir spesialtastene, ⌘/⌃/⌥ holdes til neste tast.
 * Brukernavn og passord på Macen hentes fra gatewayen når de er lagret der (MAC_<ID>_VNC_USER/PASSWORD),
 * ellers spørres det om dem når Macen ber om det (ARD/VNC-innlogging); bare brukernavnet huskes, i nettleseren.
 * Kvalitetsvelgeren setter noVNC sitt JPEG-/komprimeringsnivå (virker når Macen bruker Tight-koding), og
 * måleren viser mottatt datamengde per sekund, så en ser om valget gjør noe.
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

  const [quality, setQuality] = useState(() => { try { return validVncQuality(localStorage.getItem(VNC_QUALITY_KEY)); } catch { return 'normal'; } });
  const [rate, setRate] = useState(0);
  const [storedLogin, setStoredLogin] = useState(false);
  const [deviceLogin, setDeviceLogin] = useState(() => Boolean(loadVncLogin(macId)));   // passord husket på denne enheten
  const skipStored = useRef(false);   // lagret innlogging ble avvist: spør i stedet neste gang
  const typed = useRef(null);         // innlogging tastet nå; lagres på enheten når Macen godtar den

  // Koble til (på nytt ved «attempt»): hent lagret innlogging, åpne WebSocket (med byte-teller) og start noVNC.
  useEffect(() => {
    const target = screenRef.current;
    if (!target) return;
    setStatus('connecting'); setDetail(''); setRate(0);
    let rfb, ws, timer, cancelled = false, bytes = 0;
    (async () => {
      // Innlogging: først gatewayens (Railway), så den som er husket på denne enheten, ellers spørres det.
      let creds = null, source = '';
      if (!skipStored.current) {
        try { const c = await macApi('/vnc-credentials', undefined, macId); if (c.configured) { creds = { username: c.username, password: c.password }; source = 'gateway'; } } catch { /* spør i stedet */ }
        if (!creds) { const d = loadVncLogin(macId); if (d) { creds = d; source = 'enhet'; } }
      }
      if (cancelled) return;
      setStoredLogin(source === 'gateway'); setDeviceLogin(Boolean(loadVncLogin(macId)));
      try {
        ws = new WebSocket(vncSocketUrl(macId, window.location));
        ws.binaryType = 'arraybuffer';
        ws.addEventListener('message', e => { bytes += e.data?.byteLength || 0; });
        timer = setInterval(() => { setRate(bytes / 2); bytes = 0; }, 2000);
        rfb = new RFB(target, ws, { shared: true, credentials: creds || undefined });
      } catch (e) { setStatus('error'); setDetail(e.message); return; }
      rfb.scaleViewport = true; rfb.resizeSession = false; rfb.clipViewport = false;
      rfb.showDotCursor = true; rfb.background = '#000'; rfb.focusOnClick = true;
      const [, , q, c] = VNC_QUALITIES.find(x => x[0] === quality) || VNC_QUALITIES[1];
      rfb.qualityLevel = q; rfb.compressionLevel = c;
      rfb.addEventListener('connect', () => {
        setStatus('connected');
        // Macen godtok det som ble tastet: husk det på denne enheten til neste gang.
        if (typed.current) { setDeviceLogin(saveVncLogin(macId, typed.current)); typed.current = null; }
      });
      rfb.addEventListener('credentialsrequired', () => setStatus('credentials'));
      rfb.addEventListener('securityfailure', e => {
        if (creds) skipStored.current = true;
        if (source === 'enhet') { forgetVncLogin(macId); setDeviceLogin(false); }   // husket passord virker ikke lenger
        typed.current = null;
        setStatus('error'); setDetail(`${creds ? (source === 'gateway' ? 'Lagret innlogging i gatewayen' : 'Passordet husket på denne enheten') : 'Innlogging'} avvist${e.detail?.reason ? `: ${e.detail.reason}` : ''}`);
      });
      rfb.addEventListener('disconnect', e => setStatus(s => (s === 'error' ? s : e.detail?.clean ? 'closed' : 'error')));
      rfbRef.current = rfb;
    })();
    return () => { cancelled = true; clearInterval(timer); rfbRef.current = null; try { rfb?.disconnect(); } catch { /* allerede nede */ } try { if (!rfb) ws?.close(); } catch { /* ikke åpnet */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [macId, attempt]);

  // Kvalitet kan byttes mens økta går; noVNC sender nye kodingsvalg til Macen.
  useEffect(() => {
    try { localStorage.setItem(VNC_QUALITY_KEY, quality); } catch { /* privat modus */ }
    const rfb = rfbRef.current; if (!rfb) return;
    const [, , q, c] = VNC_QUALITIES.find(x => x[0] === quality) || VNC_QUALITIES[1];
    rfb.qualityLevel = q; rfb.compressionLevel = c;
  }, [quality, status]);

  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);
  useEffect(() => { const on = e => { if (e.key === 'Escape' && status !== 'connected') onClose(); }; document.addEventListener('keydown', on); return () => document.removeEventListener('keydown', on); }, [status, onClose]);

  const submitCredentials = e => {
    e.preventDefault();
    try { localStorage.setItem(VNC_USER_KEY(macId), user); } catch { /* privat modus */ }
    typed.current = { username: user, password };
    rfbRef.current?.sendCredentials({ username: user, password });
    setPassword(''); setStatus('connecting');
  };
  const forget = () => { forgetVncLogin(macId); setDeviceLogin(false); setDetail('Passordet er glemt på denne enheten.'); };

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
        {status === 'connected' && <span className="whitespace-nowrap font-mono text-[10px] text-nx-mute" title="Mottatt datamengde per sekund">{rateLabel(rate)}</span>}
        <span className="flex-1" />
        {status === 'connected' && (
          <select value={quality} onChange={e => setQuality(validVncQuality(e.target.value))} aria-label="Bildekvalitet"
            title="Bildekvalitet: Rask = mer komprimert og mindre data, Skarp = best bilde. Virker når Macen bruker JPEG-koding; følg med på måleren."
            className="chip !py-1 !px-2 bg-nx-bg text-xs cursor-pointer">
            {VNC_QUALITIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        )}
        {status === 'connected' && storedLogin && <span className="sr-only">Logget inn med lagret innlogging</span>}
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
              <p className="text-xs text-nx-mute">Brukernavn og passord på Macen (det du logger inn med der). Når Macen godtar det, huskes det på denne enheten, så du slipper å taste neste gang. Vil du ha det på alle enheter, legg det i gatewayen (MAC_…_VNC_PASSWORD på Railway).</p>
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
            {status === 'error' ? `${vncStatusText('error', detail)}. ${skipStored.current ? 'Prøv på nytt for å logge inn manuelt.' : 'Skjermdeling må være slått på på Macen (Systeminnstillinger → Generelt → Deling).'}` : 'Forbindelsen er avsluttet.'}
            {deviceLogin && <> <button type="button" onClick={forget} className="underline">Glem passordet på denne enheten</button></>}
          </div>
        )}
      </div>
    </div>
  );
  return createPortal(overlay, document.body);
}

export { XK };
