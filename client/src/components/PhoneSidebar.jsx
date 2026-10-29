import { useEffect, useState } from 'react';
import { Smartphone, Monitor, X, RefreshCw } from 'lucide-react';
import { usePhoneRemote, PhoneScreen, PhoneButtons, PhoneKeyboard, PhoneSessionNotice } from './PhoneRemote.jsx';
import { useMacRemote, MacScreen, MacButtons, MacKeyboard, MacStatusLine, MacQualitySelect } from './MacRemote.jsx';
import { MACS, DEFAULT_MAC, validMac, macName, twoLines } from '../lib/macs.js';

/**
 * Telefonpanel til høyre på alle sider: iPhone-skjermen (trykk, sveip, langt
 * trykk), knapper og tastatur nederst. Smalt med et ikon når det er lukket;
 * åpnes og lukkes med klikk (ikke hover), og skjermstrømmen går bare mens
 * panelet er åpent. Samme tilgang som Iphone-fanen: administrator.
 * Lukket viser stolpen to valg under hverandre, «Iphone» og «Mac på Soverom»; klikk åpner
 * panelet med den enheten. Øverst i det åpne panelet kan en bytte: iPhone (smalt panel)
 * eller Mac på Soverom (bredere, 16:9-skjerm).
 */
export const MAC_NAME = macName(DEFAULT_MAC);
const DEVICE_KEY = 'nexora.phoneSidebar.device';
function useDevice() {
  // 'iphone' eller en Mac-id fra macs.js ('mac' fra før flere Macer = standard-Macen).
  const [device, setDevice] = useState(() => { try { const d = localStorage.getItem(DEVICE_KEY); return !d || d === 'iphone' ? 'iphone' : validMac(d === 'mac' ? DEFAULT_MAC : d); } catch { return 'iphone'; } });
  useEffect(() => { try { localStorage.setItem(DEVICE_KEY, device); } catch {} }, [device]);
  return [device, setDevice];
}
function useNarrow(query = '(max-width: 767px)') {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = e => setNarrow(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return narrow;
}

export function PhoneSidebar({ open, onToggle }) {
  const narrow = useNarrow();
  const [device, setDevice] = useDevice();
  const isMac = device !== 'iphone';
  const macId = isMac ? device : DEFAULT_MAC;
  const phone = usePhoneRemote(open && !isMac);
  const mac = useMacRemote(open && isMac, macId);
  const remote = isMac ? mac : phone;
  const ready = remote.status.ready;
  const width = isMac ? 'w-[560px]' : 'w-[340px]';

  const openWith = d => { setDevice(d); if (!open) onToggle(); };

  if (!open) {
    // Smal skjerm (mobil): flytende knapper i stedet for en stolpe til høyre.
    if (narrow) return (
      <div className="fixed left-3 bottom-16 z-40 flex flex-col gap-2">
        {MACS.map(m => <button key={m.id} onClick={() => openWith(m.id)} aria-label={`Åpne ${m.name}`} title={m.name}
          className="flex h-12 w-12 flex-col items-center justify-center rounded-full border border-nx-cyan/50 bg-nx-bg/90 text-nx-cyan shadow-lg backdrop-blur-md">
          <Monitor size={18} /><span className="text-[8px] uppercase tracking-wider">{m.short}</span>
        </button>)}
        <button onClick={() => openWith('iphone')} aria-label="Åpne telefonpanelet" title="Iphone"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-nx-cyan/50 bg-nx-bg/90 text-nx-cyan shadow-lg backdrop-blur-md">
          <Smartphone size={20} />
        </button>
      </div>
    );
    return (
      <aside aria-label="Fjernstyring" className="shrink-0 w-16 border-l border-nx-line/60 bg-nx-bg/80 backdrop-blur-md py-6 relative z-30 flex flex-col items-center gap-3">
        <button onClick={() => openWith('iphone')} className="mt-2 flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-nx-cyan hover:bg-nx-cyan/10" aria-label="Åpne telefonpanelet" title="Iphone">
          <Smartphone size={20} />
          <span className="text-[9px] uppercase tracking-[0.16em] text-nx-mute">Iphone</span>
        </button>
        {MACS.map(m => <button key={m.id} onClick={() => openWith(m.id)} className="flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-nx-cyan hover:bg-nx-cyan/10" aria-label={`Åpne ${m.name}`} title={m.name}>
          <Monitor size={20} />
          <span className="text-[9px] uppercase tracking-[0.12em] leading-tight text-center text-nx-mute whitespace-pre-line">{twoLines(m.name)}</span>
        </button>)}
      </aside>
    );
  }

  // Bred skjerm: festet til høyre kant så telefonen står i ro mens siden rulles; plassholderen holder av bredden.
  // Smal skjerm: hele skjermen, over dashboardet.
  return (<>
    {!narrow && <div className={`shrink-0 ${width}`} aria-hidden="true" />}
    <aside aria-label={isMac ? macName(macId) : 'Telefon'} className={narrow
      ? 'fixed inset-0 z-[60] bg-nx-bg pt-4 pb-24 px-3 flex flex-col gap-3'
      : `fixed right-0 top-0 bottom-0 ${width} border-l border-nx-line/60 bg-nx-bg/95 backdrop-blur-md pt-4 pb-24 px-3 z-40 flex flex-col gap-3`}>
      {/* pb-24: taleassistentens knapp ligger fast nede til høyre; tastaturet skal stå over den. */}
      <header className="flex items-center gap-2">
        <div className="flex rounded-lg border border-nx-line/60 overflow-hidden text-[11px]" role="tablist" aria-label="Enhet">
          <button role="tab" aria-selected={!isMac} onClick={() => setDevice('iphone')} className={`flex items-center gap-1 px-2 py-1 ${!isMac ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute hover:text-nx-cyan'}`}><Smartphone size={13} /> IPHONE</button>
          {MACS.map(m => <button key={m.id} role="tab" aria-selected={device === m.id} onClick={() => setDevice(m.id)} title={m.name} className={`flex items-center gap-1 px-2 py-1 ${device === m.id ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute hover:text-nx-cyan'}`}><Monitor size={13} /> {m.short.toUpperCase()}</button>)}
        </div>
        <span className={`ml-1 h-2 w-2 rounded-full ${ready ? 'bg-nx-green' : ready === false ? 'bg-nx-red' : 'bg-nx-mute'}`} title={ready ? (isMac ? 'Mac-agenten svarer' : 'WebDriverAgent klar') : ready === false ? (isMac ? 'Mac-agenten svarer ikke' : 'WebDriverAgent svarer ikke') : 'Kobler til'} />
        {isMac && <MacQualitySelect remote={remote} compact className="ml-auto !py-0.5 !px-1.5" />}
        <button onClick={remote.reconnect} className="ml-auto p-1 text-nx-mute hover:text-nx-cyan" aria-label="Koble til skjermen på nytt"><RefreshCw size={14} /></button>
        <button onClick={onToggle} className="p-1 text-nx-mute hover:text-nx-cyan" aria-label={isMac ? 'Lukk Mac-panelet' : 'Lukk telefonpanelet'}><X size={15} /></button>
      </header>
      <PhoneSessionNotice remote={remote} />
      {remote.session.status === 'ready' && !isMac && <>
        <div className="flex-1 min-h-0 flex items-center justify-center"><PhoneScreen remote={remote} className="rounded-[22px]" /></div>
        <PhoneButtons remote={remote} />
        <PhoneKeyboard remote={remote} />
        {remote.err && <p role="alert" className="text-[11px] text-nx-amber">{remote.err}</p>}
        <p className="text-[10px] text-nx-mute">Klikk = trykk · dra = sveip · hold = langt trykk. Tastaturet på telefonen må være synlig for at tekst skal gå inn.</p>
      </>}
      {remote.session.status === 'ready' && isMac && <>
        <MacStatusLine remote={remote} />
        <div className="flex-1 min-h-0"><MacScreen remote={remote} /></div>
        <MacButtons remote={remote} />
        <MacKeyboard remote={remote} />
        {remote.err && <p role="alert" className="text-[11px] text-nx-amber">{remote.err}</p>}
        <p className="text-[10px] text-nx-mute">Klikk = klikk · dra = dra · høyreklikk = meny · hjul = rull. Klikk i bildet og skriv for å sende tastetrykk.</p>
      </>}
    </aside>
  </>);
}
