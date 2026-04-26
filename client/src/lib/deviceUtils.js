/** Shared helpers for working with raw Homey device objects in the UI. */

const CAPS_PRIORITY = [
  // Display priority — first matching wins for the "headline" widget.
  'onoff',
  'dim',
  'measure_temperature',
  'target_temperature',
  'windowcoverings_set',
  'volume_set',
  'measure_power',
  'meter_power',
  'locked',
  'measure_battery',
  'alarm_motion',
  'alarm_contact',
  'alarm_smoke',
  'alarm_water',
  'measure_humidity',
  'measure_luminance'
];

/** Get a capability value from either flat .capabilities or nested capabilitiesObj. */
export function capValue(device, cap) {
  if (!device) return undefined;
  if (device.capabilities && Object.prototype.hasOwnProperty.call(device.capabilities, cap)) {
    return device.capabilities[cap];
  }
  return device.capabilitiesObj?.[cap]?.value;
}

/** Returns true if the device has this capability defined. */
export function hasCap(device, cap) {
  if (!device) return false;
  if (Array.isArray(device.capabilities)) return device.capabilities.includes(cap);
  if (device.capabilities && Object.prototype.hasOwnProperty.call(device.capabilities, cap)) return true;
  return Boolean(device.capabilitiesObj?.[cap]);
}

/** All capabilities present on a device (deduped, root names only). */
export function allCaps(device) {
  if (!device) return [];
  let raw = [];
  if (Array.isArray(device.capabilities)) raw = device.capabilities;
  else if (device.capabilities) raw = Object.keys(device.capabilities);
  else if (device.capabilitiesObj) raw = Object.keys(device.capabilitiesObj);
  return [...new Set(raw.map(c => String(c).split('.')[0]))];
}

/** Pick the most relevant capability for displaying a one-line summary. */
export function primaryCapability(device) {
  for (const cap of CAPS_PRIORITY) {
    if (hasCap(device, cap)) return cap;
  }
  return allCaps(device)[0] || null;
}

/** Human-friendly label for a capability value. */
export function formatCapability(cap, value) {
  if (value == null) return '—';
  switch (cap) {
    case 'onoff': return value ? 'På' : 'Av';
    case 'locked': return value ? 'Låst' : 'Ulåst';
    case 'dim': return `${Math.round(value * 100)}%`;
    case 'measure_temperature':
    case 'target_temperature': return `${Number(value).toFixed(1)}°C`;
    case 'measure_humidity': return `${Math.round(value)}%`;
    case 'measure_luminance': return `${Math.round(value)} lx`;
    case 'measure_power': return `${Math.round(value)} W`;
    case 'meter_power': return `${Number(value).toFixed(1)} kWh`;
    case 'measure_battery': return `${Math.round(value)} %`;
    case 'volume_set': return `${Math.round(value * 100)}%`;
    case 'windowcoverings_set': return `${Math.round(value * 100)}%`;
    case 'alarm_motion': return value ? 'Bevegelse' : 'Stille';
    case 'alarm_contact': return value ? 'Åpen' : 'Lukket';
    case 'alarm_smoke': return value ? 'RØYK!' : 'OK';
    case 'alarm_water': return value ? 'LEKKASJE!' : 'Tørr';
    case 'alarm_battery': return value ? 'Lavt batteri' : 'OK';
    default:
      if (typeof value === 'boolean') return value ? 'På' : 'Av';
      if (typeof value === 'number') return Number(value).toFixed(1);
      return String(value);
  }
}

/** Norwegian label for a Homey device class. */
export function classLabel(cls) {
  return ({
    light: 'Lys',
    socket: 'Stikkontakt',
    sensor: 'Sensor',
    thermostat: 'Termostat',
    lock: 'Lås',
    camera: 'Kamera',
    speaker: 'Høyttaler',
    tv: 'TV',
    windowcoverings: 'Persienner',
    button: 'Knapp',
    heater: 'Varmer',
    fan: 'Vifte',
    lawnmower: 'Gressklipper',
    vacuumcleaner: 'Støvsuger',
    electricvehicle: 'Elbil',
    evcharger: 'EV-lader',
    garagedoor: 'Garasjeport',
    other: 'Annet'
  })[cls] || cls;
}

/** A short description of what a device does (primary capability). */
export function describeDevice(device) {
  const cap = primaryCapability(device);
  if (!cap) return classLabel(device.class);
  return `${classLabel(device.class)} · ${formatCapability(cap, capValue(device, cap))}`;
}

/** Group an array of devices by zone id. */
export function groupByZone(devices, zones) {
  const map = new Map();
  for (const d of devices) {
    const key = d.zone || '_unzoned';
    if (!map.has(key)) map.set(key, { zone: zones?.[d.zone] || { id: key, name: 'Uten rom' }, devices: [] });
    map.get(key).devices.push(d);
  }
  return [...map.values()].sort((a, b) => b.devices.length - a.devices.length);
}

/** Group an array of devices by class. */
export function groupByClass(devices) {
  const map = new Map();
  for (const d of devices) {
    const key = d.class || 'other';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cls, list]) => ({ cls, label: classLabel(cls), devices: list }));
}
