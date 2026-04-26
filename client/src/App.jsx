import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from './lib/api.js';
import { usePageVisibility } from './lib/usePageVisibility.js';
import { Sidebar } from './components/Sidebar.jsx';
import { TopBar } from './components/TopBar.jsx';
import { HouseView } from './components/HouseView.jsx';
import { QuickControls } from './components/QuickControls.jsx';
import { WeatherWidget } from './components/WeatherWidget.jsx';
import { SecurityWidget } from './components/SecurityWidget.jsx';
import { ActivityFeed } from './components/ActivityFeed.jsx';
import { RoomTemps } from './components/RoomTemps.jsx';
import { Lighting } from './components/Lighting.jsx';
import { FavoriteAutomations } from './components/FavoriteAutomations.jsx';
import { Particles } from './components/Particles.jsx';

// Charting is heavy (~150 KB) — lazy-load so it stays out of the initial bundle.
const EnergyWidget = lazy(() =>
  import('./components/EnergyWidget.jsx').then(m => ({ default: m.EnergyWidget }))
);

const POLL_MS = 12000;

export default function App() {
  const [system, setSystem] = useState(null);
  const [data, setData] = useState({
    zones: null, devices: null, flows: null, energy: null,
    activity: null, security: null, weather: null
  });
  const [loaded, setLoaded] = useState(false);
  const [section, setSection] = useState('oversikt');
  const visible = usePageVisibility();

  // Poll loop with AbortController + page-visibility pause
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load(initial = false) {
      try {
        const sig = controller.signal;
        const [system, zones, devices, flows, energy, activity, security, weather] = await Promise.all([
          api.systemInfo(sig).catch(() => null),
          api.zones(sig).catch(() => ({ zones: {} })),
          api.devices(sig).catch(() => ({ devices: {} })),
          api.flows(sig).catch(() => ({ flows: {} })),
          api.energy(sig).catch(() => ({ report: null })),
          api.activity(sig).catch(() => ({ activity: [] })),
          api.security(sig).catch(() => ({ devices: [], armed: false })),
          api.weather(sig).catch(() => null)
        ]);
        if (cancelled) return;
        if (system) setSystem(system);
        setData({
          zones: zones?.zones,
          devices: devices?.devices,
          flows: flows?.flows,
          energy: energy?.report,
          activity: activity?.activity,
          security,
          weather
        });
        if (initial) setLoaded(true);
      } catch (err) {
        if (err.name !== 'AbortError') console.error('load error', err);
        if (initial && !cancelled) setLoaded(true);
      }
    }

    load(true);
    let id = null;
    if (visible) id = setInterval(() => load(false), POLL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      if (id) clearInterval(id);
    };
  }, [visible]);

  // Optimistic capability writes
  const setCapability = useCallback(async (deviceId, capability, value) => {
    setData(d => {
      if (!d.devices?.[deviceId]) return d;
      const next = { ...d, devices: { ...d.devices } };
      const dv = { ...d.devices[deviceId] };
      dv.capabilities = { ...dv.capabilities, [capability]: value };
      if (dv.capabilitiesObj?.[capability]) {
        dv.capabilitiesObj = {
          ...dv.capabilitiesObj,
          [capability]: { ...dv.capabilitiesObj[capability], value }
        };
      }
      next.devices[deviceId] = dv;
      return next;
    });
    try { await api.setCapability(deviceId, capability, value); }
    catch (e) { console.error('setCapability failed:', e.message); }
  }, []);

  const runFlow = useCallback(async (flowId) => {
    try { await api.runFlow(flowId); }
    catch (e) { console.error('runFlow failed:', e.message); }
  }, []);

  const counts = useMemo(() => ({
    devices: data.devices ? Object.keys(data.devices).length : 0,
    flows: data.flows ? Object.values(data.flows).filter(f => f.enabled).length : 0
  }), [data.devices, data.flows]);

  return (
    <div className="relative min-h-screen bg-nx-bg bg-scanlines overflow-hidden">
      <Particles />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-nx-cyan/15 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-nx-purple/15 blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <Sidebar
          section={section}
          onSection={setSection}
          deviceCount={counts.devices}
          flowCount={counts.flows}
        />
        <main className="flex-1 px-4 lg:px-8 py-6">
          <TopBar system={system} section={section} onSection={setSection} />

          {!loaded && (
            <div className="mt-10 flex items-center gap-3 text-nx-mute" role="status">
              <div className="h-2 w-2 animate-pulse rounded-full bg-nx-cyan" />
              <span className="font-mono text-xs">SYNKRONISERER MED HOMEY...</span>
            </div>
          )}

          {loaded && (
            <SectionView
              section={section}
              system={system}
              data={data}
              counts={counts}
              setCapability={setCapability}
              runFlow={runFlow}
            />
          )}

          <footer className="mt-10 mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-nx-mute font-mono">
            <span>NEXORA · {system?.house || 'Hunstein 48c'}</span>
            <span>v{system?.version || '1.0'} · {system?.demo ? 'demo' : 'live'}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

/**
 * Each top-level section gets a tailored layout. They reuse the same widgets
 * but lay them out for the focus of that section.
 */
function SectionView({ section, system, data, counts, setCapability, runFlow }) {
  const userName = system?.user || 'Ole';
  const greetingPanel = (
    <div className="col-span-12 lg:col-span-3 panel p-5">
      <p className="panel-title">Velkommen</p>
      <h1 className="mt-2 text-xl font-semibold leading-snug">
        God kveld, <span className="neon-text">{userName}</span>!
      </h1>
      <p className="mt-1 text-sm text-nx-mute">
        Alt er bra ut, hjemmet ditt er trygt og alle systemer fungerer.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-nx-green animate-pulseGlow" />
          Hjemmemodus
        </span>
        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-nx-cyan" />
          {system?.demo ? 'Demo' : 'Live'}
        </span>
      </div>
    </div>
  );

  const wrapper = (children) => (
    <motion.div
      key={section}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mt-6 grid grid-cols-12 gap-4 lg:gap-5"
    >
      {children}
    </motion.div>
  );

  switch (section) {
    case 'rom':
      return wrapper(<>
        {greetingPanel}
        <div className="col-span-12 lg:col-span-9 panel overflow-hidden">
          <HouseView devices={data.devices || {}} zones={data.zones || {}} weather={data.weather} />
        </div>
        <div className="col-span-12 lg:col-span-6 panel p-5">
          <RoomTemps devices={data.devices || {}} zones={data.zones || {}} />
        </div>
        <div className="col-span-12 lg:col-span-6 panel p-5">
          <Lighting devices={data.devices || {}} onSet={setCapability} />
        </div>
      </>);

    case 'automasjon':
      return wrapper(<>
        {greetingPanel}
        <div className="col-span-12 lg:col-span-9 panel p-5">
          <QuickControls flows={data.flows || {}} onRun={runFlow} />
        </div>
        <div className="col-span-12 lg:col-span-6 panel p-5">
          <FavoriteAutomations flows={data.flows || {}} onRun={runFlow} />
        </div>
        <div className="col-span-12 lg:col-span-6 panel p-5">
          <ActivityFeed activity={data.activity || []} />
        </div>
      </>);

    case 'energi':
      return wrapper(<>
        {greetingPanel}
        <div className="col-span-12 lg:col-span-9 panel p-5">
          <Suspense fallback={<ChartSkeleton />}>
            <EnergyWidget energy={data.energy} />
          </Suspense>
        </div>
        <div className="col-span-12 lg:col-span-4 panel p-5">
          <WeatherWidget weather={data.weather} />
        </div>
        <div className="col-span-12 lg:col-span-8 panel p-5">
          <ActivityFeed activity={data.activity || []} />
        </div>
      </>);

    case 'sikkerhet':
      return wrapper(<>
        {greetingPanel}
        <div className="col-span-12 lg:col-span-5 panel p-5">
          <SecurityWidget security={data.security} />
        </div>
        <div className="col-span-12 lg:col-span-4 panel overflow-hidden">
          <HouseView devices={data.devices || {}} zones={data.zones || {}} weather={data.weather} />
        </div>
        <div className="col-span-12 panel p-5">
          <ActivityFeed activity={data.activity || []} />
        </div>
      </>);

    case 'innstillinger':
      return wrapper(<>
        {greetingPanel}
        <div className="col-span-12 lg:col-span-9 panel p-5">
          <SettingsPanel system={system} counts={counts} />
        </div>
      </>);

    case 'oversikt':
    default:
      return wrapper(<>
        {greetingPanel}
        <div className="col-span-12 lg:col-span-6 panel overflow-hidden">
          <HouseView devices={data.devices || {}} zones={data.zones || {}} weather={data.weather} />
        </div>
        <div className="col-span-12 lg:col-span-3 panel p-5">
          <SecurityWidget security={data.security} />
        </div>
        <div className="col-span-12 lg:col-span-3 panel p-5">
          <QuickControls flows={data.flows || {}} onRun={runFlow} />
        </div>
        <div className="col-span-12 lg:col-span-6 panel p-5">
          <Suspense fallback={<ChartSkeleton />}>
            <EnergyWidget energy={data.energy} />
          </Suspense>
        </div>
        <div className="col-span-12 lg:col-span-3 panel p-5">
          <ActivityFeed activity={data.activity || []} />
        </div>
        <div className="col-span-12 lg:col-span-3 panel p-5">
          <WeatherWidget weather={data.weather} />
        </div>
        <div className="col-span-12 lg:col-span-3 panel p-5">
          <RoomTemps devices={data.devices || {}} zones={data.zones || {}} />
        </div>
        <div className="col-span-12 lg:col-span-3 panel p-5">
          <Lighting devices={data.devices || {}} onSet={setCapability} />
        </div>
        <div className="col-span-12 lg:col-span-3 panel p-5">
          <FavoriteAutomations flows={data.flows || {}} onRun={runFlow} />
        </div>
      </>);
  }
}

function ChartSkeleton() {
  return (
    <div className="h-40 grid place-items-center text-nx-mute" role="status">
      <span className="font-mono text-xs">LASTER GRAF...</span>
    </div>
  );
}

function SettingsPanel({ system, counts }) {
  const items = [
    ['Bruker', system?.user || '—'],
    ['Hjem', system?.house || '—'],
    ['Modus', system?.demo ? 'Demo (mock-data)' : 'Live (Homey Pro)'],
    ['Homey-konfigurert', system?.homeyConfigured ? 'Ja' : 'Nei'],
    ['Versjon', system?.version || '—'],
    ['Antall enheter', counts.devices || 0],
    ['Aktive flows', counts.flows || 0]
  ];
  return (
    <div>
      <p className="panel-title">Innstillinger</p>
      <ul className="mt-3 divide-y divide-nx-line/40">
        {items.map(([label, value]) => (
          <li key={label} className="flex items-center justify-between py-2">
            <span className="text-sm text-nx-mute">{label}</span>
            <span className="font-mono text-sm text-nx-text">{String(value)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-nx-mute leading-relaxed">
        For å bytte fra Demo til Live: legg inn <code className="font-mono text-nx-cyan">HOMEY_PAT</code> i Railway → Variables, eller hardkod i <code className="font-mono text-nx-cyan">server/config.js</code>. Du finner Personal Access Token på <a className="text-nx-cyan underline" href="https://my.homey.app/me" target="_blank" rel="noopener noreferrer">my.homey.app/me</a>.
      </p>
    </div>
  );
}
