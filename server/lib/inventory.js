/**
 * Compute a structured inventory from raw devices/zones/flows objects.
 * Used by the /api/homey/inventory endpoint and the CLI discovery script.
 */

export function buildInventory({ devices = {}, zones = {}, flows = {} }) {
  const deviceList = Object.values(devices);
  const zoneList = Object.values(zones);
  const flowList = Object.values(flows);

  const byClass = {};
  const byZone = {};
  const byDriver = {};
  const capabilityCounts = {};
  const featureFlags = {
    hasEnergy: false,
    hasSecurity: false,
    hasClimate: false,
    hasLights: false,
    hasBlinds: false,
    hasMedia: false,
    hasLocks: false,
    hasCameras: false
  };

  for (const d of deviceList) {
    const cls = d.class || 'other';
    byClass[cls] = (byClass[cls] || 0) + 1;

    const zoneId = d.zone || 'unzoned';
    byZone[zoneId] = (byZone[zoneId] || 0) + 1;

    const driver = d.driverUri || d.driverId || d.virtualClass || 'unknown';
    byDriver[driver] = (byDriver[driver] || 0) + 1;

    const caps = Array.isArray(d.capabilities)
      ? d.capabilities
      : Object.keys(d.capabilities || d.capabilitiesObj || {});
    for (const cap of caps) {
      const root = String(cap).split('.')[0];
      capabilityCounts[root] = (capabilityCounts[root] || 0) + 1;
    }

    if (capabilityCounts.measure_power || capabilityCounts.meter_power) featureFlags.hasEnergy = true;
    if (cls === 'light') featureFlags.hasLights = true;
    if (cls === 'thermostat' || capabilityCounts.target_temperature) featureFlags.hasClimate = true;
    if (cls === 'lock') featureFlags.hasLocks = true;
    if (cls === 'camera') featureFlags.hasCameras = true;
    if (cls === 'speaker' || cls === 'mediaplayer' || capabilityCounts.volume_set) featureFlags.hasMedia = true;
    if (cls === 'windowcoverings' || capabilityCounts.windowcoverings_set) featureFlags.hasBlinds = true;
    if (capabilityCounts.alarm_motion || capabilityCounts.alarm_contact || capabilityCounts.alarm_smoke) {
      featureFlags.hasSecurity = true;
    }
  }

  const zonesEnriched = zoneList
    .map(z => ({
      id: z.id,
      name: z.name,
      parent: z.parent,
      icon: z.icon,
      deviceCount: byZone[z.id] || 0
    }))
    .sort((a, b) => b.deviceCount - a.deviceCount);

  const topClasses = Object.entries(byClass)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ class: k, count: v }));

  const topCapabilities = Object.entries(capabilityCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ capability: k, count: v }));

  // Identify "special" devices: anything not in the common classes — these
  // are the ones that benefit most from custom widgets.
  const COMMON_CLASSES = new Set(['light', 'sensor', 'thermostat', 'socket', 'lock', 'camera', 'other', 'button']);
  const specialDevices = deviceList
    .filter(d => !COMMON_CLASSES.has(d.class))
    .map(d => ({
      id: d.id,
      name: d.name,
      class: d.class,
      driver: d.driverUri || d.driverId || null,
      capabilities: Array.isArray(d.capabilities)
        ? d.capabilities
        : Object.keys(d.capabilities || d.capabilitiesObj || {})
    }));

  return {
    summary: {
      devices: deviceList.length,
      zones: zoneList.length,
      flows: flowList.length,
      flowsEnabled: flowList.filter(f => f.enabled).length,
      uniqueDrivers: Object.keys(byDriver).length,
      uniqueCapabilities: Object.keys(capabilityCounts).length
    },
    featureFlags,
    classes: topClasses,
    capabilities: topCapabilities,
    zones: zonesEnriched,
    drivers: Object.entries(byDriver).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ driver: k, count: v })),
    specialDevices,
    generatedAt: new Date().toISOString()
  };
}
