/**
 * Mock data shaped like real Homey Web API responses.
 * Used when DEMO_MODE=true or before a Homey PAT is configured.
 *
 * Generates a realistic ~220-device home so the dynamic dashboard can be
 * stress-tested at the same scale as Ole's actual house.
 */

// ── Zones (rooms) ──────────────────────────────────────────────────────
const RAW_ZONES = [
  ['z_root',     'Hjemmet',     null,      'home'],
  ['z_outside',  'Utendørs',    'z_root',  'tree'],
  ['z_main',     '1. etasje',   'z_root',  'home'],
  ['z_upper',    '2. etasje',   'z_root',  'home'],
  ['z_basement', 'Kjeller',     'z_root',  'basement'],
  ['z_living',   'Stue',        'z_main',  'sofa'],
  ['z_kitchen',  'Kjøkken',     'z_main',  'kitchen'],
  ['z_dining',   'Spisestue',   'z_main',  'dining'],
  ['z_hall',     'Gang',        'z_main',  'hall'],
  ['z_bath1',    'Bad nede',    'z_main',  'bath'],
  ['z_bed1',     'Hovedsoverom','z_upper', 'bed'],
  ['z_bed2',     'Soverom 2',   'z_upper', 'bed'],
  ['z_bed3',     'Soverom 3',   'z_upper', 'bed'],
  ['z_bath2',    'Bad oppe',    'z_upper', 'bath'],
  ['z_office',   'Kontor',      'z_upper', 'office'],
  ['z_garage',   'Garasje',     'z_root',  'garage'],
  ['z_garden',   'Hage',        'z_outside', 'tree'],
  ['z_terrace',  'Terrasse',    'z_outside', 'tree']
];

export const MOCK_ZONES = Object.fromEntries(
  RAW_ZONES.map(([id, name, parent, icon]) => [id, { id, name, parent, icon }])
);

// ── Device factory helpers ──────────────────────────────────────────────
let _idSeq = 0;
const nextId = (prefix) => `${prefix}_${(++_idSeq).toString(36)}`;

function dev(name, zone, klass, capabilities, opts = {}) {
  const id = opts.id || nextId(klass);
  return {
    id, name, zone, class: klass,
    driverUri: opts.driver || `homey:app:${klass}-driver`,
    available: opts.available ?? true,
    capabilities,
    capabilitiesObj: Object.fromEntries(
      Object.entries(capabilities).map(([k, v]) => [k, {
        id: k, value: v, lastUpdated: new Date(Date.now() - Math.random() * 3600_000).toISOString()
      }])
    )
  };
}

function buildDevices() {
  const list = [];

  // 1) LIGHTS (~40)
  const lightZones = ['z_living','z_living','z_living','z_kitchen','z_kitchen','z_dining',
    'z_hall','z_bed1','z_bed1','z_bed2','z_bed3','z_bath1','z_bath2','z_office','z_basement','z_garage'];
  const lightNames = ['Tak','Spotter','Ledlist','Bordlampe','Vegglampe','Skap','Pendant','Spot tak','Strip','Akvarie','Lesehjørne','Spegellys','Bryter','Fairy','Flomlys','Veggspot'];
  for (let i = 0; i < 38; i++) {
    const z = lightZones[i % lightZones.length];
    const zoneName = MOCK_ZONES[z].name;
    const onoff = Math.random() < 0.45;
    list.push(dev(
      `${zoneName} – ${lightNames[i % lightNames.length]}`,
      z, 'light',
      {
        onoff,
        dim: onoff ? Math.round(Math.random() * 100) / 100 : 0,
        ...(i % 4 === 0 ? { light_temperature: Math.random(), light_mode: 'temperature' } : {}),
        ...(i % 5 === 0 ? { light_hue: Math.random(), light_saturation: Math.random() } : {})
      },
      { driver: 'homey:app:com.philips.hue' }
    ));
  }

  // 2) SOCKETS / SWITCHES (~25)
  const socketLabels = ['TV','Stereo','Pcm','Lader','Vifte','Varmeovn','Akvarium','Julelys','Kaffemaskin','Brødrister','Mikro','Oppvaskmaskin','Vaskemaskin','Tørketrommel','Boblebad','Sauna','Pumpe utendørs','EV-lader','Snøsmelteanlegg','Garasjedør','Strobelys','UV-lampe','Elsykkel','Oppladningsstasjon','Robotgressklipper'];
  for (let i = 0; i < socketLabels.length; i++) {
    const z = ['z_living','z_kitchen','z_office','z_garage','z_basement','z_garden','z_terrace'][i % 7];
    const onoff = Math.random() < 0.35;
    list.push(dev(
      socketLabels[i],
      z, 'socket',
      {
        onoff,
        measure_power: onoff ? Math.round(Math.random() * 1800) : Math.round(Math.random() * 5),
        meter_power: Math.round(Math.random() * 200) / 10
      },
      { driver: 'homey:app:com.fibaro' }
    ));
  }

  // 3) THERMOSTATS / CLIMATE (~12)
  for (const z of ['z_living','z_kitchen','z_dining','z_bed1','z_bed2','z_bed3','z_office','z_bath1','z_bath2','z_basement','z_garage','z_hall']) {
    const measured = 18 + Math.random() * 6;
    list.push(dev(
      `Termostat ${MOCK_ZONES[z].name}`,
      z, 'thermostat',
      {
        measure_temperature: Math.round(measured * 10) / 10,
        target_temperature: Math.round((measured + (Math.random() * 2 - 1)) * 2) / 2,
        measure_humidity: Math.round(35 + Math.random() * 30)
      },
      { driver: 'homey:app:com.danfoss' }
    ));
  }

  // 4) TEMPERATURE / HUMIDITY SENSORS (~30)
  for (let i = 0; i < 30; i++) {
    const z = RAW_ZONES[3 + (i % (RAW_ZONES.length - 3))][0];
    list.push(dev(
      `Temp-sensor ${i + 1}`,
      z, 'sensor',
      {
        measure_temperature: Math.round((16 + Math.random() * 10) * 10) / 10,
        measure_humidity: Math.round(30 + Math.random() * 40),
        alarm_battery: Math.random() < 0.05
      },
      { driver: 'homey:app:net.aqara' }
    ));
  }

  // 5) MOTION / CONTACT / SMOKE / WATER ALARMS (~35)
  for (let i = 0; i < 18; i++) {
    const z = RAW_ZONES[3 + (i % (RAW_ZONES.length - 3))][0];
    list.push(dev(
      `Bevegelse ${MOCK_ZONES[z].name} ${Math.floor(i / RAW_ZONES.length) + 1}`,
      z, 'sensor',
      { alarm_motion: Math.random() < 0.1, measure_luminance: Math.round(Math.random() * 800) },
      { driver: 'homey:app:net.aqara' }
    ));
  }
  for (let i = 0; i < 12; i++) {
    list.push(dev(
      `Vindu/dør ${i + 1}`,
      ['z_living','z_kitchen','z_bed1','z_bed2','z_bed3','z_bath1','z_bath2','z_office','z_hall','z_garage','z_basement','z_terrace'][i],
      'sensor',
      { alarm_contact: Math.random() < 0.05, alarm_battery: Math.random() < 0.04 },
      { driver: 'homey:app:com.aeotec' }
    ));
  }
  list.push(dev('Røykvarsler kjøkken', 'z_kitchen', 'sensor', { alarm_smoke: false, alarm_battery: false }));
  list.push(dev('Røykvarsler stue', 'z_living', 'sensor', { alarm_smoke: false, alarm_battery: false }));
  list.push(dev('Røykvarsler 2. etasje', 'z_upper', 'sensor', { alarm_smoke: false, alarm_battery: false }));
  list.push(dev('Lekkasje vask', 'z_kitchen', 'sensor', { alarm_water: false }));
  list.push(dev('Lekkasje bad nede', 'z_bath1', 'sensor', { alarm_water: false }));

  // 6) LOCKS (~3)
  list.push(dev('Hovedlås', 'z_hall', 'lock', { locked: true, alarm_battery: false }, { driver: 'homey:app:com.danalock' }));
  list.push(dev('Garasjelås', 'z_garage', 'lock', { locked: true }));
  list.push(dev('Bakdør', 'z_terrace', 'lock', { locked: true }));

  // 7) CAMERAS (~4)
  list.push(dev('Kamera utendørs', 'z_outside', 'camera', { alarm_motion: false }, { driver: 'homey:app:com.unifi' }));
  list.push(dev('Kamera inngang', 'z_outside', 'camera', { alarm_motion: false }));
  list.push(dev('Kamera garasje', 'z_garage', 'camera', { alarm_motion: false }));
  list.push(dev('Kamera hage', 'z_garden', 'camera', { alarm_motion: false }));

  // 8) WINDOW COVERINGS / BLINDS (~10)
  for (let i = 0; i < 10; i++) {
    const z = ['z_living','z_living','z_kitchen','z_dining','z_bed1','z_bed2','z_bed3','z_office','z_bath1','z_bath2'][i];
    list.push(dev(
      `Persienner ${MOCK_ZONES[z].name}`,
      z, 'windowcoverings',
      {
        windowcoverings_set: Math.random(),
        windowcoverings_state: 'idle'
      },
      { driver: 'homey:app:com.somfy' }
    ));
  }

  // 9) MEDIA (~4)
  list.push(dev('Sonos stue', 'z_living', 'speaker', {
    speaker_playing: false, volume_set: 0.3, volume_mute: false,
    speaker_artist: 'Sigrid', speaker_track: 'Strangers'
  }, { driver: 'homey:app:com.sonos' }));
  list.push(dev('Sonos kjøkken', 'z_kitchen', 'speaker', {
    speaker_playing: true, volume_set: 0.45, volume_mute: false,
    speaker_artist: 'Aurora', speaker_track: 'Runaway'
  }, { driver: 'homey:app:com.sonos' }));
  list.push(dev('Apple TV stue', 'z_living', 'tv', { onoff: false, volume_set: 0.5 }));
  list.push(dev('Sonos kontor', 'z_office', 'speaker', { speaker_playing: false, volume_set: 0.2 }));

  // 10) ENERGY METERS (~6)
  list.push(dev('Hovedmåler strøm', 'z_basement', 'sensor', {
    measure_power: 1247 + Math.round(Math.random() * 600),
    meter_power: 18.7 + Math.random() * 3
  }, { driver: 'homey:app:no.tibber' }));
  list.push(dev('Solcelleanlegg', 'z_outside', 'sensor', {
    measure_power: 320 + Math.round(Math.random() * 200),
    meter_power: 4.2 + Math.random()
  }, { driver: 'homey:app:com.solaredge' }));
  list.push(dev('Varmtvannsbereder', 'z_basement', 'sensor', { measure_power: 410, meter_power: 6.1 }));
  list.push(dev('EV-lader', 'z_garage', 'sensor', {
    measure_power: 7400, meter_power: 22.3, onoff: true
  }, { driver: 'homey:app:no.easee' }));
  list.push(dev('Varmepumpe', 'z_basement', 'thermostat', {
    measure_power: 580, target_temperature: 22, measure_temperature: 21.6
  }));
  list.push(dev('Bobleanlegg', 'z_terrace', 'sensor', { measure_power: 0, meter_power: 152.0, onoff: false }));

  // 11) SPECIAL / EXOTIC DEVICES (gives "specialDevices" something to find)
  list.push(dev('Robotgressklipper', 'z_garden', 'lawnmower', {
    onoff: false, measure_battery: 84, alarm_generic: false
  }, { driver: 'homey:app:com.husqvarna' }));
  list.push(dev('Robotstøvsuger', 'z_living', 'vacuumcleaner', {
    onoff: false, measure_battery: 67, vacuumcleaner_state: 'docked'
  }, { driver: 'homey:app:com.roborock' }));
  list.push(dev('Tesla Model Y', 'z_garage', 'electricvehicle', {
    measure_battery: 78, ev_charging_state: 'charging', target_temperature: 21
  }, { driver: 'homey:app:com.tesla' }));
  list.push(dev('Sauna', 'z_basement', 'heater', {
    onoff: false, measure_temperature: 22.5, target_temperature: 80
  }));
  list.push(dev('Vannvarmer terrasse', 'z_terrace', 'heater', { onoff: false, target_temperature: 24 }));
  list.push(dev('Wallbox EV-lader', 'z_garage', 'evcharger', {
    onoff: true, measure_power: 7400, meter_power: 312.5, ev_charging_state: 'charging'
  }, { driver: 'homey:app:com.wallbox' }));
  list.push(dev('Garasjeport', 'z_garage', 'garagedoor', { garagedoor_closed: true }));

  // 12) BUTTONS / REMOTES (~6)
  for (let i = 0; i < 6; i++) {
    list.push(dev(`Knapp ${i + 1}`, ['z_hall','z_bed1','z_kitchen','z_living','z_office','z_basement'][i], 'button', {
      button: false, alarm_battery: false
    }));
  }

  return Object.fromEntries(list.map(d => [d.id, d]));
}

export const MOCK_DEVICES = buildDevices();

// ── Flows ──────────────────────────────────────────────────────────────
const RAW_FLOWS = [
  ['God morgen', 'favoritt'],
  ['God natt', 'favoritt'],
  ['Hjemmemodus', 'modus'],
  ['Bortemodus', 'modus'],
  ['Nattmodus', 'modus'],
  ['Feriemodus', 'modus', false],
  ['Morgenrutine', 'favoritt'],
  ['Kveldsrutine', 'favoritt'],
  ['Varmepumpe justert', 'energi'],
  ['Garasje låst', 'sikkerhet'],
  ['Robotgressklipper start', 'utendørs'],
  ['Persienner ned', 'lys'],
  ['Persienner opp', 'lys'],
  ['Slå av alle lys', 'lys'],
  ['Slå på utelys', 'lys'],
  ['Sonos start morgen', 'media'],
  ['Stue varmes opp', 'klima'],
  ['Sauna start', 'utendørs'],
  ['EV-ladring optimalisert', 'energi'],
  ['Robotstøvsuger start', 'rengjøring']
];

export const MOCK_FLOWS = Object.fromEntries(
  RAW_FLOWS.map((f, i) => {
    const [name, folder, enabled = true] = f;
    return [`f_${i + 1}`, { id: `f_${i + 1}`, name, folder, enabled }];
  })
);

// ── Energy + Activity (lightweight, unchanged) ─────────────────────────
export function mockEnergyReport() {
  const now = Date.now();
  const points = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now - i * 3600 * 1000);
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
    live: {
      watts: 1247 + Math.round((Math.random() - 0.5) * 200),
      solar: 320 + Math.round(Math.random() * 80)
    }
  };
}

export const MOCK_ACTIVITY = [
  { ts: Date.now() - 1000 * 60 * 8,   type: 'flow',     text: 'Hovedlås låst — automatisk' },
  { ts: Date.now() - 1000 * 60 * 24,  type: 'light',    text: 'Nattmodus aktivert' },
  { ts: Date.now() - 1000 * 60 * 47,  type: 'thermo',   text: 'Stue dimmet — manuelt' },
  { ts: Date.now() - 1000 * 60 * 92,  type: 'flow',     text: 'Varmepumpe justert — automatisk' },
  { ts: Date.now() - 1000 * 60 * 142, type: 'security', text: 'Bevegelse hage — sensor' },
  { ts: Date.now() - 1000 * 60 * 233, type: 'flow',     text: 'Garasje låst — automatisk' },
  { ts: Date.now() - 1000 * 60 * 305, type: 'energy',   text: 'EV-lader startet (7.4 kW)' },
  { ts: Date.now() - 1000 * 60 * 410, type: 'flow',     text: 'Robotstøvsuger fullført' }
];
