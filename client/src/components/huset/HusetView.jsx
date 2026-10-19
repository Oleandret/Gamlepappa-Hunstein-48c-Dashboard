import { lazy, Suspense, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { useHuset, useMe } from './shared.js';
import { AvvikPanel } from './AvvikPanel.jsx';
import { GjoremalPanel } from './GjoremalPanel.jsx';
import { HusreglerPanel } from './HusreglerPanel.jsx';

// Grafene lastes bare når statistikken åpnes, så mobilsiden holder seg lett.
const StatistikkPanel = lazy(() => import('./StatistikkPanel.jsx').then(m => ({ default: m.StatistikkPanel })));

/**
 * Huset: ett system for avvik, gjøremål per beboer, felles husregler og statistikk.
 * Brukes både som fane i dashboardet og som mobilside (/huset og /avvik).
 */
export function HusetView({ standalone = false, initialTab = 'statistikk' }) {
  const h = useHuset();
  const [me, setMe] = useMe();
  const [tab, setTab] = useState(initialTab);
  const overdue = h.tasks.filter(t => t.status === 'aktiv' && t.frist < h.today).length;
  const proposals = h.rules.filter(r => r.status === 'forslag').length;
  const open = h.avvik.filter(a => a.status === 'apen').length;
  const tabs = [
    ['statistikk', 'Oversikt', null],
    ['avvik', 'Avvik', open || null],
    ['gjoremal', 'Gjøremål', overdue ? `${overdue} forfalt` : null],
    ['regler', 'Husregler', proposals ? `${proposals} forslag` : null]
  ];
  const props = { h, me, setMe, standalone };

  return (
    <div className={standalone ? 'avvik-mobile mx-auto max-w-xl p-3 pb-16 space-y-3' : 'space-y-4'}>
      <header className={standalone ? 'px-1 pt-1' : 'panel p-5'}>
        <h1 className={`${standalone ? 'text-lg' : 'text-2xl'} font-semibold flex items-center gap-2`}><HeartHandshake size={standalone ? 20 : 22} className="text-nx-cyan" aria-hidden="true" />Huset · bedre livskvalitet</h1>
        {!standalone && <p className="text-sm text-nx-mute mt-1">Avvik, gjøremål, husregler og statistikk på ett sted, så vi fordeler oppgavene og gjør det bedre å bo her. Mobilside: <a className="text-nx-cyan underline" href="/huset">{window.location.host}/huset</a></p>}
      </header>
      <nav className={standalone ? 'grid grid-cols-2 gap-2' : 'flex gap-2 overflow-x-auto pb-1'} aria-label="Huset">
        {tabs.map(([id, label, badge]) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
            className={`huset-tab shrink-0 text-left px-4 py-2 rounded-lg text-sm border transition-colors ${tab === id ? 'bg-nx-cyan/15 border-nx-cyan/60 text-nx-cyan' : 'border-nx-line/60 text-nx-mute hover:text-nx-text'}`}>
            {label}{badge !== null && <span className="ml-1.5 text-xs opacity-80">{badge}</span>}
          </button>
        ))}
      </nav>
      {h.error && <p role="alert" className="panel p-3 text-nx-amber">{h.error}</p>}
      {!h.loaded && !h.error && <p className="panel p-4 text-sm text-nx-mute">Laster …</p>}
      {h.loaded && tab === 'statistikk' && <Suspense fallback={<p className="panel p-4 text-sm text-nx-mute">Laster grafer …</p>}><StatistikkPanel h={h} /></Suspense>}
      {h.loaded && tab === 'avvik' && <AvvikPanel {...props} />}
      {h.loaded && tab === 'gjoremal' && <GjoremalPanel {...props} />}
      {h.loaded && tab === 'regler' && <HusreglerPanel {...props} />}
    </div>
  );
}
