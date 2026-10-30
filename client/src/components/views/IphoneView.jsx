import { useLayoutEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Globe, Activity } from 'lucide-react';
import { phoneApi } from '../../lib/iphoneRemote.js';
import { usePhoneRemote, usePhoneView, PhoneViewSelect, PhoneScreen, PhoneButtons, PhoneKeyboard, PhoneSessionNotice } from '../PhoneRemote.jsx';
import { useFullscreen } from '../../lib/useFullscreen.js';

/**
 * Iphone: fjernstyring av «Mini sin iPhone» i dashboardets egen stil.
 * Knapper til venstre, telefonskjermen så stor som høyden tillater i midten,
 * og tastatur, «Åpne URL» og aktivitet til høyre. Flaten fyller resten av
 * vinduet, så hele telefonen synes uten å rulle. «Eget vindu» åpner hele
 * iphone-remote-siden (via dashboardet, ferdig innlogget).
 * Visning (velger i toppteksten): Normal, Stor (bare skjermen, uten kolonnene
 * rundt – den får hele bredden når vinduet er smalt) og Fullskjerm.
 */
const time = t => new Date(t).toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function IphoneView() {
  const remote = usePhoneRemote(true);
  const ready = remote.status.ready;
  const stageRef = useRef(null), screenRef = useRef(null);
  const [stagePx, setStagePx] = useState(600);
  const [url, setUrl] = useState('');
  const [view, setView] = usePhoneView();
  const [full, toggleFull, fake] = useFullscreen(screenRef);
  const stor = view === 'stor';

  // Flaten fyller resten av vinduet fra der den starter.
  useLayoutEffect(() => {
    if (remote.session.status !== 'ready') return;
    const update = () => {
      const el = stageRef.current;
      if (!el) return;
      setStagePx(Math.max(460, Math.floor(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - 16)));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [remote.session.status, stor]);

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="panel-title">Fjernstyring</p>
          <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">Iphone
            <span className={`h-2.5 w-2.5 rounded-full ${ready ? 'bg-nx-green' : ready === false ? 'bg-nx-red' : 'bg-nx-mute'}`} title={ready ? 'WebDriverAgent klar' : ready === false ? 'WebDriverAgent svarer ikke' : 'Kobler til'} />
            <span className="text-xs font-normal text-nx-mute">{ready ? 'Telefonen er klar' : ready === false ? 'Telefonen svarer ikke' : ''}</span>
          </h1>
        </div>
        {remote.session.status === 'ready' && (
          <div className="flex gap-2 items-center flex-wrap">
            <PhoneViewSelect view={view} setView={setView} full={full} toggleFull={toggleFull} />
            <button className="chip inline-flex items-center gap-1.5" onClick={remote.reconnect}><RefreshCw size={14} /> Koble til skjermen på nytt</button>
            <a className="chip inline-flex items-center gap-1.5" href="/iphone/" target="_blank" rel="noopener"><ExternalLink size={14} /> Eget vindu</a>
          </div>
        )}
      </header>

      <PhoneSessionNotice remote={remote} className="panel p-5 text-sm" />

      {remote.session.status === 'ready' && stor && (
        <div ref={stageRef} className="flex items-center justify-center" style={{ height: stagePx }}>
          <PhoneScreen remote={remote} screenRef={screenRef} fullscreen={[full, toggleFull, fake]} />
        </div>
      )}

      {remote.session.status === 'ready' && !stor && (
        <div ref={stageRef} className="grid gap-4 items-stretch" style={{ height: stagePx, gridTemplateColumns: 'minmax(130px, 160px) minmax(0, auto) minmax(260px, 1fr)' }}>
          <div className="panel p-3 overflow-y-auto">
            <p className="panel-title mb-2">Knapper</p>
            <PhoneButtons remote={remote} vertical />
          </div>

          <div className="flex items-center justify-center min-w-0 h-full">
            <PhoneScreen remote={remote} screenRef={screenRef} fullscreen={[full, toggleFull, fake]} />
          </div>

          <div className="flex flex-col gap-3 min-h-0">
            <div className="panel p-4 space-y-2">
              <p className="panel-title">Tastatur</p>
              <PhoneKeyboard remote={remote} />
              <p className="text-[11px] text-nx-mute">Trykk i et tekstfelt på telefonen først, så tastaturet er synlig der.</p>
            </div>
            <form className="panel p-4 space-y-2" onSubmit={e => { e.preventDefault(); if (url) remote.run(() => phoneApi('/api/url', { url })); }}>
              <p className="panel-title flex items-center gap-1.5"><Globe size={13} /> Åpne nettadresse</p>
              <div className="flex gap-1.5">
                <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://…" aria-label="Nettadresse"
                  className="min-w-0 flex-1 rounded-lg border border-nx-line/60 bg-nx-bg px-2.5 py-2 text-sm text-nx-text" />
                <button type="submit" disabled={!/^https?:\/\//i.test(url)} className="chip">Åpne</button>
              </div>
            </form>
            <div className="panel p-4 flex-1 min-h-0 overflow-y-auto">
              <p className="panel-title flex items-center gap-1.5 mb-2"><Activity size={13} /> Aktivitet</p>
              {!remote.status.activity.length ? <p className="text-xs text-nx-mute">Ingen aktivitet ennå.</p> : (
                <ul className="space-y-1 text-xs">
                  {remote.status.activity.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-nx-mute shrink-0">{a.at ? time(a.at) : ''}</span>
                      <span className={a.who === 'agent' ? 'text-nx-cyan' : ''}>{a.what}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-nx-mute mt-2">Blått = styrt av en AI-agent via MCP.</p>
            </div>
            {remote.err && <p role="alert" className="text-xs text-nx-amber">{remote.err}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
