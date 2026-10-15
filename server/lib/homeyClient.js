/**
 * Lightweight client for the Homey Web API.
 * Authenticates with a Personal Access Token from
 *   1. process.env.HOMEY_PAT   (Railway Variables — preferred)
 *
 * The Auth header is never logged. Errors are sanitised in routes/homey.js.
 */
import { fetchJson } from './http.js';
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

const devicesReader = cachedReader(() => homeyFetch('/manager/devices/device'));
const zonesReader = cachedReader(() => homeyFetch('/manager/zones/zone'), 60000);
const flowsReader = cachedReader(() => homeyFetch('/manager/flow/flow'), 60000);

export const homeyClient = {
  listDevices: devicesReader,
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
  getEnergyReport: (scope = 'today') =>
    homeyFetch(`/manager/energy/report/${encodeURIComponent(scope)}`)
};

export function isConfigured() {
  return Boolean(getPat());
}
