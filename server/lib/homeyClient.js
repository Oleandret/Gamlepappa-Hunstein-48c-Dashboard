/**
 * Lightweight client for the Homey Web API.
 *
 * Authenticates with a Personal Access Token (PAT). The PAT is read from:
 *   1. process.env.HOMEY_PAT   (Railway Variables)
 *   2. config.HOMEY_PAT        (server/config.js — hardcoded fallback)
 */
import fetch from 'node-fetch';
import { cfg } from '../config.js';

const ATHOM_API = 'https://api.athom.com';

let cachedCloudId = cfg('HOMEY_CLOUD_ID') || null;
let cachedBase = null;

function getPat() {
  return cfg('HOMEY_PAT');
}

async function resolveCloudId() {
  if (cachedCloudId) return cachedCloudId;
  const pat = getPat();
  if (!pat) throw new Error('HOMEY_PAT mangler');

  const res = await fetch(`${ATHOM_API}/user/me`, {
    headers: { Authorization: `Bearer ${pat}` }
  });
  if (!res.ok) throw new Error(`Klarte ikke hente bruker fra Athom (${res.status})`);
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
  const url = `${base}${pathPart}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pat}`,
      ...(opts.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Homey API ${res.status}: ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const homeyClient = {
  async listDevices() { return homeyFetch('/manager/devices/device'); },
  async listZones() { return homeyFetch('/manager/zones/zone'); },
  async listFlows() { return homeyFetch('/manager/flow/flow'); },
  async listAlarms() { return homeyFetch('/manager/alarms/alarm'); },
  async setCapability(deviceId, capabilityId, value) {
    return homeyFetch(
      `/manager/devices/device/${deviceId}/capability/${capabilityId}`,
      { method: 'PUT', body: JSON.stringify({ value }) }
    );
  },
  async runFlow(flowId) {
    return homeyFetch(`/manager/flow/flow/${flowId}/trigger`, { method: 'POST' });
  },
  async getEnergyReport(scope = 'today') {
    return homeyFetch(`/manager/energy/report/${scope}`);
  }
};

export function isConfigured() {
  return Boolean(getPat());
}
