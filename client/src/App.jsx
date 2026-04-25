import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from './lib/api.js';
import { Sidebar } from './components/Sidebar.jsx';
import { TopBar } from './components/TopBar.jsx';
import { HouseView } from './components/HouseView.jsx';
import { QuickControls } from './components/QuickControls.jsx';
import { EnergyWidget } from './components/EnergyWidget.jsx';
import { WeatherWidget } from './components/WeatherWidget.jsx';
import { SecurityWidget } from './components/SecurityWidget.jsx';
import { ActivityFeed } from './components/ActivityFeed.jsx';
import { RoomTemps } from './components/RoomTemps.jsx';
import { Lighting } from './components/Lighting.jsx';
import { FavoriteAutomations } from './components/FavoriteAutomations.jsx';
import { Particles } from './components/Particles.jsx';

export default function App() {
  const [system, setSystem] = useState(null);
  const [data, setData] = useState({
    zones: null, devices: null, flows: null, energy: null,
    activity: null, security: null, weather: null
  });
  const [loaded, setLoaded] = useState(false);
  const [section, setSection] = useState('oversikt');

  // Initial + periodic load
  useEffect(() => {
    let alive = true;
    async function load(initial = false) {
      try {
        const [system, zones, devices, flows, energy, activity, security, weather] = await Promise.all([
          api.systemInfo().catch(() => null),
          api.zones().catch(() => ({ zones: {} })),
          api.devices().catch(() => ({ devices: {} })),
          api.flows().catch(() => ({ flows: {} })),
          api.energy().catch(() => ({ report: null })),
          api.activity().catch(() => ({ activity: [] })),
          api.security().catch(() => ({ devices: [], armed: false })),
          api.weather().catch(() => null)
        ]);
        if (!alive) return;
        if (system) setSystem(system);
        setData({
          zones: zones.zones,
          devices: devices.devices,
          flows: flows.flows,
          energy: energy.report,
          activity: activity.activity,
          security,
          weather
        });
        if (initial) setLoaded(true);
      } catch (err) {
        console.error('load error', err);
        if (initial) setLoaded(true);
      }
    }
    load(true);
    const id = setInterval(() => load(false), 12000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Optimistic capability writes
  async function setCapability(deviceId, capability, value) {
    setData(d => {
      if (!d.devices?.[deviceId]) return d;
      const next = { ...d };
      next.devices = { ...d.devices };
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
    try { await api.setCapability(deviceId, capability, value); } catch (e) { console.error(e); }
  }

  async function runFlow(flowId) { try { await api.runFlow(flowId); } catch (e) { console.error(e); } }

  return (
    <div className="relative min-h-screen bg-nx-bg bg-scanlines overflow-hidden">
      <Particles />
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-nx-cyan/15 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-nx-purple/15 blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <Sidebar section={section} onSection={setSection} />
        <main className="flex-1 px-4 lg:px-8 py-6">
          <TopBar system={system} />

          {!loaded && (
            <div className="mt-10 flex items-center gap-3 text-nx-mute">
              <div className="h-2 w-2 animate-pulse rounded-full bg-nx-cyan" />
              <span className="font-mono text-xs">SYNKRONISERER MED HOMEY...</span>
            </div>
          )}

          {loaded && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-6 grid grid-cols-12 gap-4 lg:gap-5"
            >
              {/* Greeting */}
              <div className="col-span-12 lg:col-span-3 panel p-5">
                <p className="panel-title">Velkommen</p>
                <h1 className="mt-2 text-xl font-semibold leading-snug">
                  God kveld, <span className="neon-text">{system?.user || 'Ole'}</span>!
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
                    {system?.demo ? 'Demo-modus' : 'Live'}
                  </span>
                </div>
              </div>

              {/* House view */}
              <div className="col-span-12 lg:col-span-6 panel overflow-hidden">
                <HouseView
                  devices={data.devices || {}}
                  zones={data.zones || {}}
                  weather={data.weather}
                />
              </div>

              {/* Security */}
              <div className="col-span-12 lg:col-span-3 panel p-5">
                <SecurityWidget security={data.security} />
              </div>

              {/* Quick controls */}
              <div className="col-span-12 lg:col-span-3 panel p-5">
                <QuickControls flows={data.flows || {}} onRun={runFlow} />
              </div>

              {/* Energy */}
              <div className="col-span-12 lg:col-span-6 panel p-5">
                <EnergyWidget energy={data.energy} />
              </div>

              {/* Activity */}
              <div className="col-span-12 lg:col-span-3 panel p-5">
                <ActivityFeed activity={data.activity || []} />
              </div>

              {/* Weather */}
              <div className="col-span-12 lg:col-span-3 panel p-5">
                <WeatherWidget weather={data.weather} />
              </div>

              {/* Room temps */}
              <div className="col-span-12 lg:col-span-3 panel p-5">
                <RoomTemps devices={data.devices || {}} zones={data.zones || {}} />
              </div>

              {/* Lighting */}
              <div className="col-span-12 lg:col-span-3 panel p-5">
                <Lighting devices={data.devices || {}} onSet={setCapability} />
              </div>

              {/* Favorite automations */}
              <div className="col-span-12 lg:col-span-3 panel p-5">
                <FavoriteAutomations flows={data.flows || {}} onRun={runFlow} />
              </div>
            </motion.div>
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
