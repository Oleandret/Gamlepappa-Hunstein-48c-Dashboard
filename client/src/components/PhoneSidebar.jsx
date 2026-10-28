import { useEffect, useState } from 'react';
import { Smartphone, X, RefreshCw } from 'lucide-react';
import { usePhoneRemote, PhoneScreen, PhoneButtons, PhoneKeyboard, PhoneSessionNotice } from './PhoneRemote.jsx';

/**
 * Telefonpanel til høyre på alle sider: iPhone-skjermen (trykk, sveip, langt
 * trykk), knapper og tastatur nederst. Smalt med et ikon når det er lukket;
 * åpnes og lukkes med klikk (ikke hover), og skjermstrømmen går bare mens
 * panelet er åpent. Samme tilgang som Iphone-fanen: administrator.
 */
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
  const remote = usePhoneRemote(open);
  const ready = remote.status.ready;

  if (!open) {
    // Smal skjerm (mobil): flytende knapp i stedet for en stolpe til høyre.
    if (narrow) return (
      <button onClick={onToggle} aria-label="Åpne telefonpanelet" title="Iphone"
        className="fixed left-3 bottom-16 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-nx-cyan/50 bg-nx-bg/90 text-nx-cyan shadow-lg backdrop-blur-md">
        <Smartphone size={20} />
      </button>
    );
    return (
      <aside aria-label="Telefon" className="shrink-0 w-14 border-l border-nx-line/60 bg-nx-bg/80 backdrop-blur-md py-6 relative z-30 flex flex-col items-center">
        <button onClick={onToggle} className="mt-2 flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-nx-cyan hover:bg-nx-cyan/10" aria-label="Åpne telefonpanelet" title="Iphone">
          <Smartphone size={20} />
          <span className="text-[9px] uppercase tracking-[0.16em] text-nx-mute">Iphone</span>
        </button>
      </aside>
    );
  }

  // Bred skjerm: festet til høyre kant så telefonen står i ro mens siden rulles; plassholderen holder av bredden.
  // Smal skjerm: hele skjermen, over dashboardet.
  return (<>
    {!narrow && <div className="shrink-0 w-[340px]" aria-hidden="true" />}
    <aside aria-label="Telefon" className={narrow
      ? 'fixed inset-0 z-[60] bg-nx-bg pt-4 pb-24 px-3 flex flex-col gap-3'
      : 'fixed right-0 top-0 bottom-0 w-[340px] border-l border-nx-line/60 bg-nx-bg/95 backdrop-blur-md pt-4 pb-24 px-3 z-40 flex flex-col gap-3'}>
      {/* pb-24: taleassistentens knapp ligger fast nede til høyre; tastaturet skal stå over den. */}
      <header className="flex items-center gap-2">
        <Smartphone size={15} className="text-nx-cyan" />
        <div className="font-display font-semibold tracking-wide text-sm">IPHONE</div>
        <span className={`ml-1 h-2 w-2 rounded-full ${ready ? 'bg-nx-green' : ready === false ? 'bg-nx-red' : 'bg-nx-mute'}`} title={ready ? 'WebDriverAgent klar' : ready === false ? 'WebDriverAgent svarer ikke' : 'Kobler til'} />
        <button onClick={remote.reconnect} className="ml-auto p-1 text-nx-mute hover:text-nx-cyan" aria-label="Koble til skjermen på nytt"><RefreshCw size={14} /></button>
        <button onClick={onToggle} className="p-1 text-nx-mute hover:text-nx-cyan" aria-label="Lukk telefonpanelet"><X size={15} /></button>
      </header>
      <PhoneSessionNotice remote={remote} />
      {remote.session.status === 'ready' && <>
        <div className="flex-1 min-h-0 flex items-center justify-center"><PhoneScreen remote={remote} className="rounded-[22px]" /></div>
        <PhoneButtons remote={remote} />
        <PhoneKeyboard remote={remote} />
        {remote.err && <p role="alert" className="text-[11px] text-nx-amber">{remote.err}</p>}
        <p className="text-[10px] text-nx-mute">Klikk = trykk · dra = sveip · hold = langt trykk. Tastaturet på telefonen må være synlig for at tekst skal gå inn.</p>
      </>}
    </aside>
  </>);
}
