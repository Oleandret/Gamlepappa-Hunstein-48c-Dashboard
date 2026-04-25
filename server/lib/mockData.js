/**
 * Mock data shaped roughly like real Homey Web API responses.
 * Used when DEMO_MODE=true or before a Homey PAT has been wired in.
 */

export const MOCK_ZONES = {
  z1: { id: 'z1', name: 'Hjemmet', parent: null, icon: 'home' },
  z2: { id: 'z2', name: 'Soverom', parent: 'z1', icon: 'bed' },
  z3: { id: 'z3', name: 'Stue', parent: 'z1', icon: 'sofa' },
  z4: { id: 'z4', name: 'Kjøkken', parent: 'z1', icon: 'kitchen' },
  z5: { id: 'z5', name: 'Bad', parent: 'z1', icon: 'bath' },
  z6: { id: 'z6', name: 'Kontor', parent: 'z1', icon: 'office' },
  z7: { id: 'z7', name: 'Garasje', parent: 'z1', icon: 'garage' },
  z8: { id: 'z8', name: 'Kjelleren', parent: 'z1', icon: 'basement' }
};

const dev = (id, name, zoneId, klass, capabilities) => ({
  id,
  name,
  zone: zoneId,
  class: klass,
  capabilities,
  capabilitiesObj: Object.fromEntries(
    Object.entries(capabilities).map(([k, v]) => [k, { id: k, value: v, lastUpdated: new Date().toISOString() }])
  ),
  available: true
});

export const MOCK_DEVICES = {
  // Lights
  d_l1: dev('d_l1', 'Stuelys', 'z3', 'light', { onoff: true, dim: 0.62, light_hue: 0.12, light_saturation: 0.4 }),
  d_l2: dev('d_l2', 'Spotter kjøkken', 'z4', 'light', { onoff: true, dim: 0.85 }),
  d_l3: dev('d_l3', 'Soverom natt', 'z2', 'light', { onoff: false, dim: 0.0 }),
  d_l4: dev('d_l4', 'Bad-tak', 'z5', 'light', { onoff: false, dim: 0.0 }),
  d_l5: dev('d_l5', 'Kontor LED', 'z6', 'light', { onoff: true, dim: 0.45 }),

  // Thermostats / sensors
  d_t1: dev('d_t1', 'Termostat soverom', 'z2', 'thermostat', { measure_temperature: 20.8, target_temperature: 21 }),
  d_t2: dev('d_t2', 'Termostat stue', 'z3', 'thermostat', { measure_temperature: 21.6, target_temperature: 22 }),
  d_t3: dev('d_t3', 'Termostat kjøkken', 'z4', 'thermostat', { measure_temperature: 21.9, target_temperature: 21 }),
  d_t4: dev('d_t4', 'Termostat bad', 'z5', 'thermostat', { measure_temperature: 22.1, target_temperature: 23 }),
  d_t5: dev('d_t5', 'Termostat kontor', 'z6', 'thermostat', { measure_temperature: 22.0, target_temperature: 22 }),
  d_t6: dev('d_t6', 'Termostat garasje', 'z7', 'thermostat', { measure_temperature: 16.2, target_temperature: 18 }),
  d_t7: dev('d_t7', 'Termostat kjelleren', 'z8', 'thermostat', { measure_temperature: 18.4, target_temperature: 19 }),

  // Energy sensors
  d_e1: dev('d_e1', 'Hovedmåler strøm', 'z1', 'sensor', { measure_power: 1247, meter_power: 18.7 }),
  d_e2: dev('d_e2', 'Solcelleanlegg', 'z1', 'sensor', { measure_power: 320, meter_power: 4.2 }),
  d_e3: dev('d_e3', 'Varmtvann', 'z1', 'sensor', { measure_power: 410, meter_power: 6.1 }),

  // Security
  d_s1: dev('d_s1', 'Inngangsdør', 'z1', 'sensor', { alarm_contact: false, alarm_battery: false }),
  d_s2: dev('d_s2', 'Kjøkkenvindu', 'z4', 'sensor', { alarm_contact: false }),
  d_s3: dev('d_s3', 'Bevegelse gang', 'z1', 'sensor', { alarm_motion: false }),
  d_s4: dev('d_s4', 'Røykvarsler', 'z1', 'sensor', { alarm_smoke: false, alarm_battery: false }),
  d_s5: dev('d_s5', 'Kamera utendørs', 'z1', 'camera', { alarm_motion: false })
};

export const MOCK_FLOWS = {
  f1: { id: 'f1', name: 'God morgen', enabled: true, folder: 'favoritt' },
  f2: { id: 'f2', name: 'God natt', enabled: true, folder: 'favoritt' },
  f3: { id: 'f3', name: 'Hjemmemodus', enabled: true, folder: 'modus' },
  f4: { id: 'f4', name: 'Bortemodus', enabled: true, folder: 'modus' },
  f5: { id: 'f5', name: 'Nattmodus', enabled: true, folder: 'modus' },
  f6: { id: 'f6', name: 'Feriemodus', enabled: false, folder: 'modus' },
  f7: { id: 'f7', name: 'Morgenrutine', enabled: true, folder: 'favoritt' },
  f8: { id: 'f8', name: 'Kveldsrutine', enabled: true, folder: 'favoritt' },
  f9: { id: 'f9', name: 'Varmepumpe justert', enabled: true, folder: 'energi' },
  f10: { id: 'f10', name: 'Garasje låst', enabled: true, folder: 'sikkerhet' }
};

export function mockEnergyReport() {
  const now = Date.now();
  const points = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now - i * 3600 * 1000);
    // simulate a usage curve
    const base = 0.6 + Math.sin((hour.getHours() - 6) / 12 * Math.PI) * 0.6;
    const noise = (Math.random() - 0.5) * 0.3;
    points.push({
      ts: hour.toISOString(),
      hour: hour.getHours(),
      kwh: Math.max(0.1, base + noise + 0.4)
    });
  }
  const total = points.reduce((s, p) => s + p.kwh, 0);
  return {
    today: { kwh: Number(total.toFixed(1)), trend: -12 },
    points,
    live: { watts: 1247 + Math.round((Math.random() - 0.5) * 200), solar: 320 + Math.round(Math.random() * 80) }
  };
}

export const MOCK_ACTIVITY = [
  { ts: Date.now() - 1000 * 60 * 8, type: 'flow', text: 'Hovedlåst lås — automatisk' },
  { ts: Date.now() - 1000 * 60 * 24, type: 'light', text: 'Nattmodus aktivert' },
  { ts: Date.now() - 1000 * 60 * 47, type: 'thermo', text: 'Stue dimmet — manuelt' },
  { ts: Date.now() - 1000 * 60 * 92, type: 'flow', text: 'Varmepumpe justert — automatisk' },
  { ts: Date.now() - 1000 * 60 * 142, type: 'security', text: 'Bevegelse hage — sensor' },
  { ts: Date.now() - 1000 * 60 * 233, type: 'flow', text: 'Garasje låst — automatisk' }
];
