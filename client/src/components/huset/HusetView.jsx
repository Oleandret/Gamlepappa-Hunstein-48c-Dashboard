import { lazy, Suspense, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { HeartHandshake } from 'lucide-react';
import { useHuset, useMe } from './shared.js';
import { AvvikPanel } from './AvvikPanel.jsx';
import { GjoremalPanel } from './GjoremalPanel.jsx';
import { HusreglerPanel } from './HusreglerPanel.jsx';
import { BeborePanel } from './BeborePanel.jsx';
import { SmsPanel } from './SmsPanel.jsx';
import { PaaminnelserPanel } from './PaaminnelserPanel.jsx';
import { SkrytPanel } from './SkrytPanel.jsx';
import { VeiledningerView } from './VeiledningerView.jsx';

// Grafene lastes bare når statistikken åpnes, så mobilsiden holder seg lett.
const StatistikkPanel = lazy(() => import('./StatistikkPanel.jsx').then(m => ({ default: m.StatistikkPanel })));

/**
 * Trivsel (før «Huset»): ett system for avvik, gjøremål per beboer, SMS-påminnelser, felles
 * husregler og statistikk. Brukes både som fane i dashboardet og som mobilside (/huset, /avvik
 * og /paaminnelser). Stiene og API-et heter fortsatt huset.
 */
export function HusetView({ standalone = false, initialTab = 'statistikk', user = null }) {
  const h = useHuset();
  const [session, setSession] = useState(user);
  useEffect(() => { if (!user) apiFetch('/api/session').then(r => r.ok ? r.json() : null).then(setSession).catch(() => {}); }, [user]);
  const owner = session?.method === 'google' || session?.method === 'demo';
  const [me, setMe] = useMe(session?.role === 'beboer' ? session.navn : '');
  const [tab, setTab] = useState(initialTab);
  const overdue = h.tasks.filter(t => t.status === 'aktiv' && t.frist < h.today).length;
  const proposals = h.rules.filter(r => r.status === 'forslag').length;
  const open = h.avvik.filter(a => a.status === 'apen').length;
  const tabs = [
    ['statistikk', 'Oversikt', null],
    ['avvik', 'Avvik', open || null],
    ['gjoremal', 'Gjøremål', overdue ? `${overdue} forfalt` : null],
    ['paaminnelser', 'Påminnelser', h.paaminnelser.filter(p => p.aktiv).length || null],
    ['skryt', 'Skryt', null],
    ['regler', 'Husregler', proposals ? `${proposals} forslag` : null],
    ['veiledninger', 'Veiledninger', null],
    ...(owner ? [['beboere', 'Beboere', null], ['sms', 'Send SMS med iPhone', null]] : [])
  ];
  const props = { h, me, setMe, standalone };

  return (
    <div className={standalone ? 'avvik-mobile mx-auto max-w-xl p-3 pb-16 space-y-3' : 'space-y-4'}>
      <header className={standalone ? 'px-1 pt-1' : 'panel p-5'}>
        <h1 className={`${standalone ? 'text-lg' : 'text-2xl'} font-semibold flex items-center gap-2`}><HeartHandshake size={standalone ? 20 : 22} className="text-nx-cyan" aria-hidden="true" />Trivsel · bedre livskvalitet</h1>
        {!standalone && <p className="text-sm text-nx-mute mt-1">Avvik, gjøremål, SMS-påminnelser, skryt, husregler og statistikk på ett sted, så vi fordeler oppgavene og gjør det bedre å bo her. Mobilside: <a className="text-nx-cyan underline" href="/huset">{window.location.host}/huset</a></p>}
      </header>
      <nav className={standalone ? 'grid grid-cols-2 gap-2' : 'flex gap-2 overflow-x-auto pb-1'} aria-label="Trivsel">
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
      {h.loaded && tab === 'paaminnelser' && <PaaminnelserPanel {...props} owner={owner} />}
      {h.loaded && tab === 'skryt' && <SkrytPanel {...props} owner={owner} />}
      {h.loaded && tab === 'regler' && <HusreglerPanel {...props} />}
      {owner && tab === 'beboere' && <BeborePanel standalone={standalone} />}
      {owner && tab === 'sms' && <SmsPanel />}
      {tab === 'veiledninger' && <VeiledningerView standalone={standalone} embedded />}
    </div>
  );
}
