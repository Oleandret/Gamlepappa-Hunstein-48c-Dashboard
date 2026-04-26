import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from './lib/api.js';
import { usePageVisibility } from './lib/usePageVisibility.js';
import { useFavorites } from './lib/useFavorites.js';
import { useSidebarPinned, useLogPinned } from './lib/useSidebarState.js';
import { usePinConfig } from './lib/usePinConfig.js';
import { pushEvent, diffDevicesAndLog } from './lib/activityLog.js';
import { ActivityLogPanel } from './components/ActivityLogPanel.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { TopBar } from './components/TopBar.jsx';
import { HouseView } from './components/HouseView.jsx';
import { PinEditor } from './components/PinEditor.jsx';
import { QuickControls } from './components/QuickControls.jsx';
import { WeatherWidget } from './components/WeatherWidget.jsx';
import { SecurityWidget } from './components/SecurityWidget.jsx';
import { ActivityFeed } from './components/ActivityFeed.jsx';
import { RoomTemps } from './components/RoomTemps.jsx';
import { Lighting } from './components/Lighting.jsx';
import { FavoriteAutomations } from './components/FavoriteAutomations.jsx';
import { Particles } from './components/Particles.jsx';
import { ZonesView } from './components/views/ZonesView.jsx';
import { DevicesView } from './components/views/DevicesView.jsx';
import { FavoritesView } from './components/views/FavoritesView.jsx';
import { AudioView } from './components/views/AudioView.jsx';
import { FloorPlanView } from './components/views/FloorPlanView.jsx';
import { DiscoveryPanel } from './components/DiscoveryPanel.jsx';
import { TeslaCard } from './components/special/TeslaCard.jsx';
import { RoborockCard } from './components/special/RoborockCard.jsx';
import { TibberCard } from './components/special/TibberCard.jsx';

// Lazy-loaded heavy widgets
const EnergyWidget = lazy(() =>
  import('./components/EnergyWidget.jsx').then(m => ({ default: m.EnergyWidget }))
);
const EnergyView = lazy(() =>
  import('./components/views/EnergyView.jsx').then(m => ({ default: m.EnergyView }))
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
  const favorites = useFavorites();
  const sidebar = useSidebarPinned();
  const logPin = useLogPinned();
  const pinConfig = usePinConfig();
  const prevDevicesRef = useRef(null);

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
        // Diff devices vs previous snapshot to push events to activity log.
        // Skip the very first sync — we don't want to flood the log on load.
        if (!initial && prevDevicesRef.current && devices?.devices) {
          diffDevicesAndLog(prevDevicesRef.current, devices.devices, zones?.zones || {});
        }
        if (devices?.devices) prevDevicesRef.current = devices.devices;
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

  const setCapability = useCallback(async (deviceId, capability, value) => {
    let deviceName = deviceId;
    setData(d => {
      if (!d.devices?.[deviceId]) return d;
      deviceName = d.devices[deviceId].name || deviceId;
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
    pushEvent({
      type: capability === 'onoff' ? (value ? 'on' : 'off') : capability === 'locked' ? 'security' : 'info',
      text: `${deviceName} → ${capability}=${formatValue(value)}`,
      source: 'manuell'
    });
    try { await api.setCapability(deviceId, capability, value); }
    catch (e) {
      console.error('setCapability failed:', e.message);
      pushEvent({ type: 'alarm', text: `Klarte ikke styre ${deviceName}: ${e.message}`, source: 'feil' });
    }
  }, []);

  const runFlow = useCallback(async (flowId) => {
    let flowName = flowId;
    setData(d => { flowName = d.flows?.[flowId]?.name || flowId; return d; });
    pushEvent({ type: 'flow', text: `Kjørte flow: ${flowName}`, source: 'manuell' });
    try { await api.runFlow(flowId); }
    catch (e) {
      console.error('runFlow failed:', e.message);
      pushEvent({ type: 'alarm', text: `Flow feilet: ${flowName} (${e.message})`, source: 'feil' });
    }
  }, []);

  function formatValue(v) {
    if (typeof v === 'boolean') return v ? 'på' : 'av';
    if (typeof v === 'number') return Number(v).toFixed(2).replace(/\.?0+$/, '');
    return String(v);
  }

  const counts = useMemo(() => ({
    devices: data.devices ? Object.keys(data.devices).length : 0,
    flows: data.flows ? Object.values(data.flows).filter(f => f.enabled).length : 0,
    zones: data.zones ? Object.keys(data.zones).length : 0,
    favorites: favorites.ids.length
  }), [data.devices, data.flows, data.zones, favorites.ids]);

  return (
    <div className="relative min-h-screen bg-nx-bg bg-scanlines overflow-hidden">
      <Particles />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-nx-cyan/15 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-nx-purple/15 blur-[120px]" />
      </div>

      <ActivityLogPanel pinned={logPin.pinned} onTogglePin={logPin.toggle} />

      <div className="relative z-10 flex min-h-screen">
        <Sidebar
          section={section}
          onSection={setSection}
          deviceCount={counts.devices}
          flowCount={counts.flows}
          pinned={sidebar.pinned}
          onTogglePin={sidebar.toggle}
        />
        <main className="flex-1 px-4 lg:px-8 py-6 min-w-0">
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
              favorites={favorites}
              pinConfig={pinConfig}
            />
          )}

          <footer className="mt-10 mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-nx-mute font-mono">
            <span>GAMLEPAPPA SMARTHUS · {system?.house || 'Hunstein 48c'}</span>
            <span>v{system?.version || '1.0'} · {counts.devices} enh · {counts.zones} rom · {system?.demo ? 'demo' : 'live'}</span>
          </footer>
        </main>
      </div>

      {/* ElevenLabs ConvAI — to ulike agenter avhengig av side.
          `key` tvinger remount når man bytter mellom oversikt og andre seksjoner,
          slik at widgeten plukker opp den nye agent-id-en.
          Skrudd av på 'avatar' siden den siden allerede er en pratebar avatar.
          Orb-fargene matcher dashboardets nx-cyan / nx-purple. */}
      {section === 'oversikt' ? (
        <elevenlabs-convai
          key="agent-oversikt"
          agent-id="SCOI5nAeUm2P90tPlhxJ"
          avatar-orb-color-1="#22e6ff"
          avatar-orb-color-2="#7d5cff"
          variant="compact"
          placement="bottom-right"
        ></elevenlabs-convai>
      ) : section === 'avatar' ? null : (
        <elevenlabs-convai
          key="agent-andre"
          agent-id="agent_4501kc02r47xec2s0r87f0awxdj6"
          avatar-orb-color-1="#22e6ff"
          avatar-orb-color-2="#7d5cff"
          variant="compact"
          placement="bottom-right"
        ></elevenlabs-convai>
      )}
    </div>
  );
}

function SectionView({ section, system, data, counts, setCapability, runFlow, favorites, pinConfig }) {
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
        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-nx-purple" />
          {counts.devices} enheter
        </span>
      </div>
    </div>
  );

  const wrapper = (children, gridGap = true) => (
    <motion.div
      key={section}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={gridGap ? 'mt-6 grid grid-cols-12 gap-4 lg:gap-5' : 'mt-6'}
    >
      {children}
    </motion.div>
  );

  switch (section) {
    case 'rom':
      return wrapper(
        <ZonesView
          devices={data.devices || {}}
          zones={data.zones || {}}
          onSet={setCapability}
          favorites={favorites}
        />,
        false
      );

    case 'enheter':
      return wrapper(
        <DevicesView
          devices={data.devices || {}}
          zones={data.zones || {}}
          onSet={setCapability}
          favorites={favorites}
        />,
        false
      );

    case 'lyd':
      return wrapper(
        <AudioView
          devices={data.devices || {}}
          zones={data.zones || {}}
          onSet={setCapability}
        />,
        false
      );

    case 'plantegning':
      return wrapper(
        <FloorPlanView
          devices={data.devices || {}}
          zones={data.zones || {}}
        />,
        false
      );

    case 'energi':
      return wrapper(
        <Suspense fallback={<LoadingPanel label="LASTER ENERGI..." />}>
          <EnergyView
            devices={data.devices || {}}
            zones={data.zones || {}}
            energy={data.energy}
          />
        </Suspense>,
        false
      );

    case 'favoritter':
      return wrapper(
        <FavoritesView
          devices={data.devices || {}}
          zones={data.zones || {}}
          onSet={setCapability}
          favorites={favorites}
        />,
        false
      );

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

    case 'sikkerhet':
      return wrapper(<>
        {greetingPanel}
        <div className="col-span-12 lg:col-span-5 panel p-5">
          <SecurityWidget security={data.security} />
        </div>
        <div className="col-span-12 lg:col-span-4 panel overflow-hidden">
          <HouseView devices={data.devices || {}} zones={data.zones || {}} weather={data.weather} customPins={pinConfig?.config} />
        </div>
        <div className="col-span-12 panel p-5">
          <ActivityFeed activity={data.activity || []} />
        </div>
      </>);

    case 'innstillinger':
      return wrapper(<>
        <div className="col-span-12 lg:col-span-4 panel p-5">
          <SettingsPanel system={system} counts={counts} />
        </div>
        <div className="col-span-12 lg:col-span-8 panel p-5">
          <DiscoveryPanel />
        </div>
        <div className="col-span-12 panel p-5">
          <PinEditor pinConfig={pinConfig} devices={data.devices || {}} zones={data.zones || {}} />
        </div>
      </>);

    case 'avatar':
      return wrapper(
        <div className="panel overflow-hidden h-[calc(100vh-160px)] min-h-[480px]">
          <iframe
            src="https://artimis-ai-production.up.railway.app/"
            title="Artimis AI Avatar"
            className="w-full h-full border-0 block"
            allow="camera; microphone; autoplay; fullscreen; clipboard-read; clipboard-write; display-capture"
            allowFullScreen
          />
        </div>,
        false
      );

    case 'oversikt':
    default: {
      // Foretrekk Model X hvis flere Tesla-enheter er registrert.
      const allTeslas = data.devices
        ? Object.values(data.devices).filter(d => d.class === 'car' || /tesla/i.test(d.driverUri || ''))
        : [];
      const tesla = allTeslas.find(d => /model\s*x/i.test(d.name || '')) || allTeslas[0] || null;
      const roborock = findFirst(data.devices, d => d.class === 'vacuumcleaner');
      const tibber = findFirst(data.devices, d => /tibber/i.test(d.driverUri || ''));
      return (
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-3 grid grid-cols-12 gap-2"
        >
          {/* Kompakt hilsen-bar */}
          <div className="col-span-12 panel px-3 py-1.5 flex flex-wrap items-center gap-1.5 justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-xs font-semibold">
                God kveld, <span className="neon-text">{system?.user || 'Ole'}</span>
              </h1>
              <span className="chip text-[10px] px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-nx-green animate-pulseGlow" />
                Hjemmemodus
              </span>
              <span className="chip text-[10px] px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-nx-cyan" />
                {system?.demo ? 'Demo' : 'Live'}
              </span>
              <span className="chip text-[10px] px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-nx-purple" />
                {counts.devices} enh · {counts.zones} rom · {counts.flows} flows
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-nx-mute font-mono">
              {data.weather?.now?.temp != null && (
                <span>UTE <span className="text-nx-cyan">{Math.round(data.weather.now.temp)}°</span></span>
              )}
              {data.energy?.live?.watts != null && (
                <span>NÅ <span className="text-nx-cyan">{Math.round(data.energy.live.watts).toLocaleString('no-NO')} W</span></span>
              )}
              {data.energy?.today?.kwh != null && (
                <span>I DAG <span className="text-nx-cyan">{data.energy.today.kwh} kWh</span></span>
              )}
            </div>
          </div>

          {/* Hus + hytte side-by-side */}
          <div className="col-span-12 lg:col-span-6 panel overflow-hidden">
            <HouseView devices={data.devices || {}} zones={data.zones || {}} weather={data.weather} forceLocation="home" customPins={pinConfig?.config} />
          </div>
          <div className="col-span-12 lg:col-span-6 panel overflow-hidden">
            <HouseView devices={data.devices || {}} zones={data.zones || {}} weather={data.weather} forceLocation="cabin" customPins={pinConfig?.config} />
          </div>

          {/* Rad 1: Sikkerhet + 3 spesial-widgets */}
          <div className="col-span-6 lg:col-span-3 panel p-2">
            <SecurityWidget security={data.security} />
          </div>
          {tibber && <div className="col-span-6 lg:col-span-3"><TibberCard device={tibber} /></div>}
          {tesla && <div className="col-span-6 lg:col-span-3"><TeslaCard device={tesla} /></div>}
          {roborock && <div className="col-span-6 lg:col-span-3"><RoborockCard device={roborock} onSet={setCapability} /></div>}

          {/* Rad 2: Hurtigkontroller + Energi-graf + Vær */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3 panel p-2">
            <QuickControls flows={data.flows || {}} onRun={runFlow} />
          </div>
          <div className="col-span-12 sm:col-span-12 lg:col-span-6 panel p-2">
            <Suspense fallback={<LoadingPanel label="LASTER GRAF..." />}>
              <EnergyWidget energy={data.energy} />
            </Suspense>
          </div>
          <div className="col-span-12 sm:col-span-6 lg:col-span-3 panel p-2">
            <WeatherWidget weather={data.weather} />
          </div>

          {/* Rad 3: 4 widgets på en rad */}
          <div className="col-span-6 lg:col-span-3 panel p-2">
            <RoomTemps devices={data.devices || {}} zones={data.zones || {}} />
          </div>
          <div className="col-span-6 lg:col-span-3 panel p-2">
            <Lighting devices={data.devices || {}} onSet={setCapability} />
          </div>
          <div className="col-span-6 lg:col-span-3 panel p-2">
            <ActivityFeed activity={data.activity || []} />
          </div>
          <div className="col-span-6 lg:col-span-3 panel p-2">
            <FavoriteAutomations flows={data.flows || {}} onRun={runFlow} />
          </div>
        </motion.div>
      );
    }
  }
}

function findFirst(devices, predicate) {
  if (!devices) return null;
  return Object.values(devices).find(predicate) || null;
}

function LoadingPanel({ label }) {
  return (
    <div className="h-40 grid place-items-center text-nx-mute" role="status">
      <span className="font-mono text-xs">{label}</span>
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
    ['Antall rom', counts.zones || 0],
    ['Aktive flows', counts.flows || 0],
    ['Favoritt-enheter', counts.favorites || 0]
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
        Bruk Discovery-panelet til høyre for å laste ned hele Homey-inventaret som JSON. Del fila med Claude for å bygge skreddersydde widgets for dine spesifikke enheter.
      </p>
    </div>
  );
}
