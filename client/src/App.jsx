import {SectionBoundary} from './components/SectionBoundary.jsx';
import {PlanHouseView} from './components/views/PlanHouseView.jsx';
import {HistoryView} from './components/views/HistoryView.jsx';
import {NetworkView} from './components/views/NetworkView.jsx';
import {IphoneView} from './components/views/IphoneView.jsx';
import {HusetView} from './components/huset/HusetView.jsx';
import { VeiledningerView } from './components/huset/VeiledningerView.jsx';
import { VoiceAssistant } from './components/VoiceAssistant.jsx';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from './lib/api.js';
import { usePageVisibility } from './lib/usePageVisibility.js';
import { useFavorites } from './lib/useFavorites.js';
import { useSidebarPinned, useLogPinned, useFlowsSidebarPinned } from './lib/useSidebarState.js';
import { usePinConfig } from './lib/usePinConfig.js';
import { useFrontImageConfig } from './lib/useFrontImageConfig.js';
import { useFrontSensors } from './lib/useFrontSensors.js';
import { useFlowFavorites } from './lib/useFlowFavorites.js';
import { useLinks } from './lib/useLinks.js';
import { useFloorPlanPins } from './lib/useFloorPlanPins.js';
import { useFloorPlanFlows } from './lib/useFloorPlanFlows.js';
import { useFrontSpecials } from './lib/useFrontSpecials.js';
import { pushEvent, diffDevicesAndLog } from './lib/activityLog.js';
import { ActivityLogPanel } from './components/ActivityLogPanel.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { FlowsSidebar } from './components/FlowsSidebar.jsx';
import { TopBar } from './components/TopBar.jsx';
import { HouseView } from './components/HouseView.jsx';
import { PinEditor } from './components/PinEditor.jsx';
import { FrontImageConfig } from './components/FrontImageConfig.jsx';
import { FrontSensors } from './components/FrontSensors.jsx';
import { FrontSensorEditor } from './components/FrontSensorEditor.jsx';
import { FrontSpecialsEditor } from './components/FrontSpecialsEditor.jsx';
import { SecurityActivityLog } from './components/SecurityActivityLog.jsx';
import { FlowFavoritesView } from './components/views/FlowFavoritesView.jsx';
import { MaintenanceView } from './components/views/MaintenanceView.jsx';
import { LinksView } from './components/views/LinksView.jsx';
import { InsightsView } from './components/views/InsightsView.jsx';
import { AutoFlowsView } from './components/views/AutoFlowsView.jsx';
import { ChatView } from './components/views/ChatView.jsx';
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
// 3D-visningen drar inn three.js (~700 kB) — lastes først når fanen åpnes.
const House3DView = lazy(() => import('./components/views/House3DView.jsx'));
import { DiscoveryPanel } from './components/DiscoveryPanel.jsx';
import { TeslaCard } from './components/special/TeslaCard.jsx';
import { RoborockCard } from './components/special/RoborockCard.jsx';
import { TibberCard } from './components/special/TibberCard.jsx';

// Lazy-loaded heavy widgets
const EnergyWidget = lazy(() =>
  import('./components/EnergyWidget.jsx').then(m => ({ default: m.EnergyWidget }))
);
const HeatingView = lazy(() => import('./components/views/HeatingView.jsx'));
const SavingsView = lazy(() => import('./components/views/SavingsView.jsx').then(m => ({ default: m.SavingsView })));
const EnergyView = lazy(() =>
  import('./components/views/EnergyView.jsx').then(m => ({ default: m.EnergyView }))
);

const POLL_MS = 12000;
// Sidene som viser data.energy; bare der varsles det om energidatakvaliteten.
const ENERGY_SECTIONS = new Set(['oversikt', 'energi']);

export default function App() {
  const [system, setSystem] = useState(null);
  const [data, setData] = useState({
    zones: null, devices: null, flows: null, energy: null,
    activity: null, security: null, weather: null
  });
  const [loaded, setLoaded] = useState(false);
  const [focusZoneId,setFocusZoneId]=useState(null);
  const [section, setSection] = useState(() => new URLSearchParams(window.location.search).has('myuplink') ? 'varmestyring' : 'oversikt');
  const visible = usePageVisibility();
  const favorites = useFavorites();
  const sidebar = useSidebarPinned();
  const logPin = useLogPinned();
  const flowsSidebar = useFlowsSidebarPinned();
  const pinConfig = usePinConfig();
  const imageConfig = useFrontImageConfig();
  const frontSensors = useFrontSensors();
  const flowFavorites = useFlowFavorites();
  const links = useLinks();
  const floorPlanPins = useFloorPlanPins();
  const planFlows = useFloorPlanFlows();
  const frontSpecials = useFrontSpecials();
  const prevDevicesRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    let inFlight = false;
    async function load(initial = false) {
      if (inFlight) return;
      inFlight = true;
      try {
        const sig = controller.signal;
        const [system, zones, devices, flows, energy, activity, security, weather] = await Promise.all([
          api.systemInfo(sig).catch(() => null),
          api.zones(sig).catch(() => ({ _quality: 'unavailable' })),
          api.devices(sig).catch(() => ({ _quality:'unavailable' })),
          api.flows(sig).catch(() => ({ _quality: 'unavailable' })),
          api.energy(sig).catch(() => ({ report: null, _quality:'unavailable' })),
          api.activity(sig).catch(() => ({ _quality:'unavailable' })),
          api.security(sig).catch(() => ({ _quality:'unavailable' })),
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
        setData(previous => ({
          zones: zones?.zones || previous.zones,
          devices: devices?.devices || previous.devices,
          quality: {devices:devices?._quality,energy:energy?._quality},
          flows: flows?.flows || previous.flows,
          energy: energy?.report ?? previous.energy,
          activity: activity?.activity ?? previous.activity,
          security: security?._quality === 'unavailable' ? {...previous.security, armed:null, _quality:'unavailable'} : security,
          weather: weather ?? (previous.weather ? {...previous.weather,_quality:'stale'} : null)
        }));
        if (initial) setLoaded(true);
      } catch (err) {
        if (err.name !== 'AbortError') console.error('load error', err);
        if (initial && !cancelled) setLoaded(true);
      } finally { inFlight = false; }
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
    if (data.quality?.devices !== 'live' && data.quality?.devices !== 'demo') {
      const error = 'Styring krever ferske enhetsdata';
      pushEvent({type:'alarm',text:error,source:'feil'}); return {ok:false,error};
    }
    pushEvent({type:'info',text:`Sender ${capability} til enhet`,source:'venter'});
    try {
      const result = await api.setCapability(deviceId, capability, value);
      let warning = result.warning;
      try {
        const fresh = await api.devices();
        setData(d=>({...d,devices:fresh.devices || d.devices,quality:{...d.quality,devices:fresh._quality}}));
        if (fresh._quality !== 'live' && fresh._quality !== 'demo') warning = 'Kommando mottatt, men ny enhetsstatus er utilgjengelig';
      } catch {
        setData(d=>({...d,quality:{...d.quality,devices:'unavailable'}}));
        warning = 'Kommando mottatt, men ny enhetsstatus er utilgjengelig';
      }
      pushEvent({type:'info',text: result.confirmed ? 'Enhetstilstand bekreftet' : 'Kommando mottatt; tilstanden er ikke bekreftet ennå',source:result.confirmed?'bekreftet':'venter'});
      return {...result,ok:true,warning};
    } catch(e) { pushEvent({type:'alarm',text:`Styring feilet: ${e.message}`,source:'feil'}); return {ok:false,error:e.message}; }

  }, [data.quality?.devices]);

  const runFlow = useCallback(async (flowId) => {
    const flowName = data.flows?.[flowId]?.name || flowId;
    try { await api.runFlow(flowId); pushEvent({type:'flow',text:`Homey mottok flow: ${flowName}. Sluttresultat er ikke bekreftet.`,source:'manuell'}); }
    catch (e) {
      console.error('runFlow failed:', e.message);
      pushEvent({ type: 'alarm', text: `Flow feilet: ${flowName} (${e.message})`, source: 'feil' });
    }
  }, [data.flows]);

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

  // Enhetsstatus brukes på alle sider; energidata bare på Oversikt (energigrafen) og Energi.
  const deviceNotice = data.quality?.devices !== 'live';
  const energyNotice = data.quality?.energy !== 'live' && ENERGY_SECTIONS.has(section);

  return (
    <div data-active-section={section} className="relative min-h-screen bg-nx-bg bg-scanlines overflow-hidden">

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
          deviceQuality={data.quality?.devices}
          flowCount={counts.flows}
          pinned={sidebar.pinned}
          onTogglePin={sidebar.toggle}
        />
        <main className="dashboard-main flex-1 px-4 lg:px-8 py-6 min-w-0">
          <TopBar system={system} section={section} onSection={setSection} />

          {!loaded && (
            <div className="mt-10 flex items-center gap-3 text-nx-mute" role="status">
              <div className="h-2 w-2 animate-pulse rounded-full bg-nx-cyan" />
              <span className="font-mono text-xs">SYNKRONISERER MED HOMEY...</span>
            </div>
          )}

          {loaded && (system?.demo || deviceNotice || energyNotice) && <p role="status" className="quality-notice">{system?.demo ? 'Demonstrasjon · syntetiske testdata, ikke faktiske målinger.' : `Datakvalitet: ${[deviceNotice && `enheter ${data.quality?.devices || 'ukjent'}`, energyNotice && `energi ${data.quality?.energy || 'ukjent'}`].filter(Boolean).join(' · ')}. Eldre data er ikke bekreftet nå-status.`}</p>}
          {loaded && (
            <SectionBoundary key={section}><SectionView
              onOpen3D={zoneId=>{setFocusZoneId(zoneId);setSection('hus-3d');}}
              focusZoneId={focusZoneId}
              section={section}
              system={system}
              data={data}
              counts={counts}
              setCapability={setCapability}
              runFlow={runFlow}
              favorites={favorites}
              pinConfig={pinConfig}
              imageConfig={imageConfig}
              frontSensors={frontSensors}
              flowFavorites={flowFavorites}
              links={links}
              floorPlanPins={floorPlanPins}
              planFlows={planFlows}
              frontSpecials={frontSpecials}
            /></SectionBoundary>
          )}

          <footer className="mt-10 mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-nx-mute font-mono">
            <span>GAMLEPAPPA SMARTHUS · {system?.house || 'Hunstein 48c'}</span>
            <span>v{system?.version || '1.0'} · {counts.devices} enh · {counts.zones} rom · {system?.demo ? 'demo' : data.quality?.devices || 'ukjent'}</span>
          </footer>
        </main>
        <FlowsSidebar
          flows={data.flows || {}}
          onRun={runFlow}
          pinned={flowsSidebar.pinned}
          onTogglePin={flowsSidebar.toggle}
        />
      </div>

      <VoiceAssistant section={section} />
    </div>
  );
}

function SectionView({ onOpen3D, focusZoneId, section, system, data, counts, setCapability, runFlow, favorites, pinConfig, imageConfig, frontSensors, flowFavorites, links, floorPlanPins, planFlows, frontSpecials }) {
  if (section === 'historikk') return <HistoryView/>;
  if (section === 'nettverk') return <NetworkView />;
  if (section === 'iphone') return <IphoneView />;
  if (section === 'huset') return <HusetView />;
  if (section === 'veiledninger') return <VeiledningerView />;
  const userName = system?.user || 'Ole';
  const greetingPanel = (
    <div className="col-span-12 lg:col-span-3 panel p-5">
      <p className="panel-title">Velkommen</p>
      <h1 className="mt-2 text-xl font-semibold leading-snug">
        God kveld, <span className="neon-text">{userName}</span>!
      </h1>
      <p className="mt-1 text-sm text-nx-mute">
        Status for huset basert på siste avlesning.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-nx-green animate-pulseGlow" />
          Hjemmemodus
        </span>
        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-nx-cyan" />
          {system?.demo ? 'Demo' : data.quality?.devices === 'live' ? 'Sist innhentet' : 'Utdatert / utilgjengelig'}
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
          onOpen3D={onOpen3D}
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

    case 'plantegning-hus':
      return wrapper(
        <PlanHouseView
          devices={data.devices || {}}
          zones={data.zones || {}}
          location="home"
          floorPlanPins={floorPlanPins}
          planFlows={planFlows}
          flows={data.flows || {}}
          onRunFlow={runFlow}
          onSetCapability={setCapability}
        />,
        false
      );

    case 'hus-3d':
      return wrapper(
        <Suspense fallback={<p className="p-6 font-mono text-xs text-nx-mute">Laster 3D-modell …</p>}>
          <House3DView
            initialHomeyZoneId={focusZoneId}
            devices={data.devices || {}}
            zones={data.zones || {}}
            floorPlanPins={floorPlanPins}
            onSetCapability={setCapability}
          />
        </Suspense>,
        false
      );

    case 'plantegning-hytte':
      return wrapper(
        <FloorPlanView
          devices={data.devices || {}}
          zones={data.zones || {}}
          location="cabin"
          floorPlanPins={floorPlanPins}
          planFlows={planFlows}
          flows={data.flows || {}}
          onRunFlow={runFlow}
          onSetCapability={setCapability}
        />,
        false
      );

    case 'flow-favoritter':
      return wrapper(
        <FlowFavoritesView
          zones={data.zones || {}}
          flows={data.flows || {}}
          onRun={runFlow}
          flowFavorites={flowFavorites}
        />,
        false
      );

    case 'lenker':
      return wrapper(
        <LinksView links={links} />,
        false
      );

    case 'vedlikehold':
      return wrapper(
        <MaintenanceView
          devices={data.devices || {}}
          zones={data.zones || {}}
        />,
        false
      );

    case 'innsikt':
      return wrapper(<InsightsView />, false);

    case 'ai-flows':
      return wrapper(<AutoFlowsView />, false);

    case 'chat':
      return wrapper(<ChatView />, false);

    case 'varmestyring':
      return wrapper(<Suspense fallback={<LoadingPanel label="LASTER VARMEDATA..." />}><HeatingView /></Suspense>, false);
    case 'stromsparing':
      return wrapper(<Suspense fallback={<LoadingPanel label="LASTER STRØMSPARING..." />}><SavingsView /></Suspense>, false);

    case 'energi':
      return wrapper(
        <Suspense fallback={<LoadingPanel label="LASTER ENERGI..." />}>
          <EnergyView
            quality={data.quality?.devices}
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
          <HouseView devices={data.devices || {}} zones={data.zones || {}} weather={data.weather} customPins={pinConfig?.config} imageConfig={imageConfig?.config} />
        </div>
        <div className="col-span-12 panel p-5">
          <SecurityActivityLog zones={data.zones||{}} />
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
          <FrontSensorEditor
            sensors={frontSensors}
            devices={data.devices || {}}
            zones={data.zones || {}}
          />
        </div>
        <div className="col-span-12 panel p-5">
          <FrontSpecialsEditor
            specials={frontSpecials}
            devices={data.devices || {}}
            zones={data.zones || {}}
          />
        </div>
        <div className="col-span-12 lg:col-span-5 panel p-5">
          <FrontImageConfig imageConfig={imageConfig} />
        </div>
        <div className="col-span-12 lg:col-span-7 panel p-5">
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
      // Spesial-kortene (Tesla / Tibber / Støvsuger) styres fra Innstillinger.
      // Verdi 'auto' bruker auto-deteksjon, 'none' skjuler kortet, ellers
      // en spesifikk deviceId.
      const specials = frontSpecials?.config || { tesla: 'auto', tibber: 'auto', vacuum: 'none' };
      const resolveSlot = (slotValue, filter, autoPicker) => {
        if (!slotValue || slotValue === 'none') return null;
        if (slotValue === 'auto') {
          const candidates = data.devices ? Object.values(data.devices).filter(filter) : [];
          return autoPicker ? autoPicker(candidates) : (candidates[0] || null);
        }
        return data.devices?.[slotValue] || null;
      };
      const tesla = resolveSlot(
        specials.tesla,
        (d) => d.class === 'car' || /tesla/i.test(d.driverUri || ''),
        (arr) => arr.find(d => /model\s*x/i.test(d.name || '')) || arr[0] || null
      );
      const roborock = resolveSlot(
        specials.vacuum,
        (d) => d.class === 'vacuumcleaner'
      );
      const tibber = resolveSlot(
        specials.tibber,
        (d) => /tibber/i.test(d.driverUri || '')
      );
      return (
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="overview-grid mt-6 grid grid-cols-12 gap-5"
        >
          <section className="overview-welcome col-span-12"><div><p className="dashboard-eyebrow">HJEMME HOS DEG</p><h1>Hei, {system?.user || 'Ole'}.</h1><p>Oversikt over målingene og enhetene dine.</p></div><div className="overview-counts"><div><strong>{counts.devices}</strong><span>enheter</span></div><div><strong>{counts.zones}</strong><span>rom</span></div><div><strong>{counts.flows}</strong><span>flows</span></div></div></section>

          {/* Brukervalgte sensor-chips (vises bare hvis listen ikke er tom) */}
          <FrontSensors sensors={frontSensors.list} devices={data.devices || {}} />

          {/* Hus + hytte side-by-side */}
          <div className="col-span-12 lg:col-span-6 panel overflow-hidden">
            <HouseView devices={data.devices || {}} zones={data.zones || {}} weather={data.weather} forceLocation="home" customPins={pinConfig?.config} imageConfig={imageConfig?.config} />
          </div>
          <div className="col-span-12 lg:col-span-6 panel overflow-hidden">
            <HouseView devices={data.devices || {}} zones={data.zones || {}} weather={data.weather} forceLocation="cabin" customPins={pinConfig?.config} imageConfig={imageConfig?.config} />
          </div>

          {/* Rad 1: Sikkerhet + 3 spesial-widgets */}
          <div className="col-span-12 sm:col-span-6 xl:col-span-3 panel p-5">
            <SecurityWidget security={data.security} />
          </div>
          {tibber && <div className="col-span-12 sm:col-span-6 xl:col-span-3"><TibberCard device={tibber} /></div>}
          {tesla && <div className="col-span-12 sm:col-span-6 xl:col-span-3"><TeslaCard device={tesla} /></div>}
          {roborock && <div className="col-span-12 sm:col-span-6 xl:col-span-3"><RoborockCard device={roborock} onSet={setCapability} /></div>}

          {/* Rad 2: Hurtigkontroller + Energi-graf + Vær */}
          <div className="col-span-12 sm:col-span-6 xl:col-span-3 panel p-5">
            <QuickControls flows={data.flows || {}} onRun={runFlow} />
          </div>
          <div className="col-span-12 sm:col-span-12 lg:col-span-6 panel p-5">
            <Suspense fallback={<LoadingPanel label="LASTER GRAF..." />}>
              <EnergyWidget energy={data.energy} />
            </Suspense>
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3 panel p-5">
            <WeatherWidget weather={data.weather} />
          </div>

          {/* Rad 3: 4 widgets på en rad */}
          <div className="col-span-12 sm:col-span-6 xl:col-span-3 panel p-5">
            <RoomTemps devices={data.devices || {}} zones={data.zones || {}} />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3 panel p-5">
            <Lighting devices={data.devices || {}} zones={data.zones || {}} onSet={setCapability} />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3 panel p-5">
            <ActivityFeed activity={data.activity || []} />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3 panel p-5">
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
