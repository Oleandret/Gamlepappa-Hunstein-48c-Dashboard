/**
 * Lightweight client for the Homey Web API.
 * Authenticates with a Personal Access Token from
 *   1. process.env.HOMEY_PAT   (Railway Variables — preferred)
 *   2. config.HOMEY_PAT        (server/config.js — hardcoded fallback)
 *
 * The Auth header is never logged. Errors are sanitised in routes/homey.js.
 */
import fetch from 'node-fetch';
import { cfg } from '../config.js';

const ATHOM_API = 'https://api.athom.com';
const REQUEST_TIMEOUT_MS = 12000;

let cachedCloudId = cfg('HOMEY_CLOUD_ID') || null;
let cachedBase = null;

const getPat = () => cfg('HOMEY_PAT');

async function fetchWithTimeout(url, opts = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCloudId() {
  if (cachedCloudId) return cachedCloudId;
  const pat = getPat();
  if (!pat) throw new Error('HOMEY_PAT mangler');

  const res = await fetchWithTimeout(`${ATHOM_API}/user/me`, {
    headers: { Authorization: `Bearer ${pat}` }
  });
  if (!res.ok) throw new Error(`Athom user lookup failed (${res.status})`);
  const data = await res.json();
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
  const res = await fetchWithTimeout(`${base}${pathPart}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pat}`,
      ...(opts.headers || {})
    }
  });
  if (!res.ok) {
    // Avoid echoing raw response body — it may contain reflected auth tokens
    throw new Error(`Homey API ${res.status} ${pathPart}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const homeyClient = {
  listDevices: () => homeyFetch('/manager/devices/device'),
  listZones:   () => homeyFetch('/manager/zones/zone'),
  listFlows:   () => homeyFetch('/manager/flow/flow'),
  listAlarms:  () => homeyFetch('/manager/alarms/alarm'),
  setCapability: (deviceId, capabilityId, value) =>
    homeyFetch(
      `/manager/devices/device/${encodeURIComponent(deviceId)}/capability/${encodeURIComponent(capabilityId)}`,
      { method: 'PUT', body: JSON.stringify({ value }) }
    ),
  runFlow: (flowId) =>
    homeyFetch(`/manager/flow/flow/${encodeURIComponent(flowId)}/trigger`, { method: 'POST' }),
  getEnergyReport: (scope = 'today') =>
    homeyFetch(`/manager/energy/report/${encodeURIComponent(scope)}`)
};

export function isConfigured() {
  return Boolean(getPat());
}
