import { energySummary } from './energySummary.js';
import {createMotionHistory} from './motionHistory.js';
/**
 * Lightweight client for the Homey Web API.
 * Authenticates with a Personal Access Token from
 *   1. process.env.HOMEY_PAT   (Railway Variables — preferred)
 *
 * The Auth header is never logged. Errors are sanitised in routes/homey.js.
 */
import { fetchJson } from './http.js';
import { createTeslaSnapshots } from './teslaSnapshots.js';
import { getNamespace, setNamespace } from './configStore.js';
import { cachedReader } from './readCache.js';
import { validateCapability } from './validation.js';
import { cfg } from '../config.js';
import { enqueueCommand } from './commandQueue.js';

const ATHOM_API = 'https://api.athom.com';

let cachedCloudId = cfg('HOMEY_CLOUD_ID') || null;
let cachedBase = null;

const getPat = () => cfg('HOMEY_PAT');

async function resolveCloudId() {
  if (cachedCloudId) return cachedCloudId;
  const pat = getPat();
  if (!pat) throw new Error('HOMEY_PAT mangler');

  const data = await fetchJson(`${ATHOM_API}/user/me`, {
    headers: { Authorization: `Bearer ${pat}` }
  });
  const homeys = data?.homeys || data?._homeys || [];
  const first = Array.isArray(homeys) ? homeys[0] : null;
  const id = first?.id || data?.homeyId || data?.activeHomey;
  if (!id) throw new Error('Fant ingen Homey knyttet til denne PAT');
  cachedCloudId = id;
  return id;
}

async function getBaseUrl() {
  if (cachedBase) return cachedBase;
  const id = await resolveCloudId();
  cachedBase = `https://${id}.connect.athom.com/api`;
  return cachedBase;
}

async function homeyFetch(pathPart, opts = {}) {
  const pat = getPat();
  if (!pat) throw new Error('HOMEY_PAT mangler');
  const base = await getBaseUrl();
  return fetchJson(`${base}${pathPart}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pat}`,
      ...(opts.headers || {})
    }
  });
}

const teslaSnapshots = createTeslaSnapshots({load:()=>getNamespace('_teslaSnapshots'),save:value=>setNamespace('_teslaSnapshots',value)});
export const motionHistory=createMotionHistory({load:()=>getNamespace('_motionHistory'),save:v=>setNamespace('_motionHistory',v)});
const devicesReader = cachedReader(async () => { const devices=await homeyFetch('/manager/devices/device'); await motionHistory.observe(devices).catch(()=>console.warn('[motion-history] storage unavailable')); return teslaSnapshots.project(devices).catch(()=>{console.warn('[tesla-snapshots] storage unavailable');return devices;}); }, 60_000);
const zonesReader = cachedReader(() => homeyFetch('/manager/zones/zone'), 60000);
const liveEnergyReader = cachedReader(() => homeyFetch('/manager/energy/live'), 60_000);
let energyDate, dayEnergyReader;
const flowsReader = cachedReader(() => homeyFetch('/manager/flow/flow'), 60000);



export const homeyClient = {
  listDevices: devicesReader,
  updateTeslaSnapshot: async id => { const result=await teslaSnapshots.update(id); devicesReader.invalidate(); return result; },
  refreshDevices: () => { devicesReader.invalidate(); return devicesReader(); },
  listZones: zonesReader,
  listFlows: flowsReader,
  listAlarms:  () => homeyFetch('/manager/alarms/alarm'),
  // Skriving går gjennom kommando-køen (rate-limit) for å skåne BLE-mesh
  // som Plejd. Lesing (listDevices osv.) går direkte.
  setCapability: (deviceId, capabilityId, value) =>
    enqueueCommand(
      async () => {
        validateCapability(await devicesReader(), deviceId, capabilityId, value);
        const result = await homeyFetch(
        `/manager/devices/device/${encodeURIComponent(deviceId)}/capability/${encodeURIComponent(capabilityId)}`,
        { method: 'PUT', body: JSON.stringify({ value }) }
        );
        devicesReader.invalidate();
        return result;
      },
      `setCapability ${deviceId}/${capabilityId}`
    ),
  // Alias slik at både setCapability og setCapabilityValue fungerer
  setCapabilityValue: (deviceId, capabilityId, value) =>
    homeyClient.setCapability(deviceId, capabilityId, value),
  runFlow: (flowId) =>
    enqueueCommand(
      () => homeyFetch(`/manager/flow/flow/${encodeURIComponent(flowId)}/trigger`, { method: 'POST' }),
      `runFlow ${flowId}`
    ),
  getEnergyLive: liveEnergyReader,
  getEnergyDay: (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Ugyldig dato');
    if (energyDate !== date) { energyDate=date; dayEnergyReader=cachedReader(() => homeyFetch(`/manager/energy/report/day?date=${encodeURIComponent(date)}`), 900_000); }
    return dayEnergyReader();
  },
  // The retired report/today endpoint returned 404. Use the verified main meter.
  getEnergyReport: async () => energySummary(await devicesReader())
};

export function isConfigured() {
  return Boolean(getPat());
}
