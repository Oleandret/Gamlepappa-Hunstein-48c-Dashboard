import { useLayoutEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Globe, Activity, Sun } from 'lucide-react';
import { macOpen } from '../../lib/macRemote.js';
import { useMacRemote, MacScreen, MacButtons, MacKeyboard, MacApps, MacStatusLine, MacQualitySelect, macWake } from '../MacRemote.jsx';
import { PhoneSessionNotice } from '../PhoneRemote.jsx';

/**
 * Mac: fjernstyring av Mac Studio-en i dashboardets egen stil, bygd som Iphone-fanen.
 * Snarveier til venstre, skjermen så stor som plassen tillater i midten, og tastatur,
 * «Åpne», apper og aktivitet til høyre. «Eget vindu» åpner mac-siden i iphone-remote.
 */
const time = t => new Date(t).toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function MacView() {
  const remote = useMacRemote(true);
  const ready = remote.status.ready;
  const stageRef = useRef(null);
  const [stagePx, setStagePx] = useState(600);
  const [app, setApp] = useState('');
  const [url, setUrl] = useState('');

  useLayoutEffect(() => {
    if (remote.session.status !== 'ready') return;
    const update = () => {
      const el = stageRef.current;
      if (!el) return;
      setStagePx(Math.max(420, Math.floor(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - 16)));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [remote.session.status]);

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="panel-title">Fjernstyring</p>
          <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">Mac
            <span className={`h-2.5 w-2.5 rounded-full ${ready ? 'bg-nx-green' : ready === false ? 'bg-nx-red' : 'bg-nx-mute'}`} title={ready ? 'Mac-agenten svarer' : ready === false ? 'Mac-agenten svarer ikke' : 'Kobler til'} />
            <span className="font-normal"><MacStatusLine remote={remote} /></span>
          </h1>
        </div>
        {remote.session.status === 'ready' && (
          <div className="flex gap-2">
            <MacQualitySelect remote={remote} />
            <button className="chip inline-flex items-center gap-1.5" onClick={() => remote.run(macWake)}><Sun size={14} /> Vekk skjermen</button>
            <button className="chip inline-flex items-center gap-1.5" onClick={remote.reconnect}><RefreshCw size={14} /> Koble til skjermen på nytt</button>
            <a className="chip inline-flex items-center gap-1.5" href="/iphone/mac.html" target="_blank" rel="noopener"><ExternalLink size={14} /> Eget vindu</a>
          </div>
        )}
      </header>

      <PhoneSessionNotice remote={remote} className="panel p-5 text-sm" />

      {remote.session.status === 'ready' && (
        <div ref={stageRef} className="grid gap-4 items-stretch" style={{ height: stagePx, gridTemplateColumns: 'minmax(130px, 160px) minmax(0, 1fr) minmax(240px, 300px)' }}>
          <div className="panel p-3 overflow-y-auto">
            <p className="panel-title mb-2">Snarveier</p>
            <MacButtons remote={remote} vertical />
          </div>

          <div className="min-w-0 min-h-0 h-full">
            <MacScreen remote={remote} />
          </div>

          <div className="flex flex-col gap-3 min-h-0">
            <div className="panel p-4 space-y-2">
              <p className="panel-title">Tastatur</p>
              <MacKeyboard remote={remote} />
              <p className="text-[11px] text-nx-mute">Klikk i skjermbildet og skriv: tastetrykkene går rett til Macen.</p>
            </div>
            <form className="panel p-4 space-y-2" onSubmit={e => { e.preventDefault(); if (app || url) remote.run(() => macOpen(app, url)); }}>
              <p className="panel-title flex items-center gap-1.5"><Globe size={13} /> Åpne app eller nettadresse</p>
              <div className="flex gap-1.5">
                <input value={app} onChange={e => setApp(e.target.value)} placeholder="App, f.eks. Safari" aria-label="App" className="min-w-0 w-28 rounded-lg border border-nx-line/60 bg-nx-bg px-2.5 py-2 text-sm text-nx-text" />
                <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://… (valgfritt)" aria-label="Nettadresse" className="min-w-0 flex-1 rounded-lg border border-nx-line/60 bg-nx-bg px-2.5 py-2 text-sm text-nx-text" />
                <button type="submit" disabled={!app && !/^https?:\/\//i.test(url)} className="chip">Åpne</button>
              </div>
            </form>
            <div className="panel p-4 min-h-0 overflow-y-auto" style={{ flex: '1 1 0' }}>
              <p className="panel-title mb-2">Apper</p>
              <MacApps remote={remote} />
            </div>
            <div className="panel p-4 min-h-0 overflow-y-auto" style={{ flex: '1 1 0' }}>
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
