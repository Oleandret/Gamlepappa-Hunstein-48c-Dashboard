// Read-only myUplink adapter. Server-side only: it never sees a client token and
// never takes a caller-supplied URL or method. Two fixed GET endpoints, nothing else.
import { fetchJson } from './http.js';
import { energyReader } from './energyReader.js';

const POINTS_URL = id => `https://api.myuplink.com/v2/devices/${encodeURIComponent(id)}/points`;
const NOTIFICATIONS_URL = id => `https://api.myuplink.com/v2/systems/${encodeURIComponent(id)}/notifications/active`;
const REQUIRED_SCOPE = 'READSYSTEM';
// Allowlist from the verified public-v2 ParameterData contract. The raw response may
// carry more; only these cross the boundary, and `timestamp` stays exactly as sent.
const POINT_FIELDS = ['category', 'parameterId', 'parameterName', 'parameterUnit', 'timestamp', 'value', 'strVal', 'smartHomeCategories', 'writable'];

const trimmed = value => (typeof value === 'string' ? value.trim() : '');
const authError = message => Object.assign(new Error(message), { myUplinkAuth: true });

function pickPoint(point) {
  const picked = {};
  for (const field of POINT_FIELDS) {
    const value = point[field];
    if (field === 'smartHomeCategories') picked[field] = Array.isArray(value) ? value.filter(v => typeof v === 'string').slice(0, 30).map(v => v.slice(0, 200)) : [];
    else if (typeof value === 'string') picked[field] = value.slice(0, 1000);
    else if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) picked[field] = value;
  }
  return picked;
}

// Upstream bodies and tokens never reach this string.
function safeReason(error) {
  if (error?.myUplinkAuth) return error.message;
  const status = error?.upstreamStatus;
  if (status === 429) return 'myUplink begrenser forespørsler (429)';
  if (status === 401 || status === 403) return `myUplink avviste tilgangen (HTTP ${status})`;
  if (Number.isFinite(status)) return `myUplink svarte med HTTP ${status}`;
  return 'myUplink er ikke tilgjengelig';
}

function unavailableAlarms(reason) {
  // count stays null: an empty list is not proof of no alarms when the source failed.
  return { available: false, count: null, reason };
}

export function createMyUplinkReader({ enabled = false, deviceId = '', systemId = '', getAccessToken, fetchImpl = fetch, now = Date.now } = {}) {
  const device = trimmed(deviceId);
  const system = trimmed(systemId);
  let lastReason = null;
  let lastKind = null;

  async function authorize() {
    const granted = await getAccessToken();
    const token = trimmed(granted?.accessToken);
    if (!token) throw authError('myUplink mangler et gyldig tilgangstoken');
    const scopes = trimmed(granted?.scope).split(/\s+/).filter(Boolean);
    if (scopes.length !== 1 || scopes[0] !== REQUIRED_SCOPE) {
      throw authError(`myUplink-tokenet må ha nøyaktig scope ${REQUIRED_SCOPE}`);
    }
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  }

  let alarmHeaders, alarmReason;
  const cachedAlarms = energyReader(async () => {
    try {
      const body = await fetchJson(NOTIFICATIONS_URL(system), { method: 'GET', headers: alarmHeaders }, { fetchImpl });
      if (!body || !Number.isInteger(body.numItems) || body.numItems < 0 || !Array.isArray(body.notifications)) throw new Error('Invalid alarms');
      return { available: true, count: body.numItems, scope: 'system', fetchedAt: now(), reason: null };
    } catch (error) { alarmReason = safeReason(error); throw error; }
  }, { ttl: 60_000, now });
  async function readAlarms(headers) {
    if (!system) return unavailableAlarms('Ingen myUplink-systemId er konfigurert');
    alarmHeaders = headers;
    const result = await cachedAlarms();
    return result.quality === 'live' ? result.value : { ...unavailableAlarms(alarmReason), retryAt: result.retryAt };
  }

  async function load() {
    try {
      const headers = await authorize();
      const body = await fetchJson(POINTS_URL(device), { method: 'GET', headers }, { fetchImpl });
      if (!Array.isArray(body)) throw new Error('Ukjent svarformat fra myUplink-punkter');
      const payload = { fetchedAt: now(), points: body.filter(p => p && typeof p === 'object' && !Array.isArray(p)).map(pickPoint), alarms: await readAlarms(headers) };
      lastReason = null;
      lastKind = null;
      return payload;
    } catch (error) {
      lastReason = safeReason(error);
      lastKind = error?.myUplinkAuth ? 'auth' : 'upstream';
      throw error;
    }
  }

  const cached = energyReader(load, { ttl: 60_000, now });

  const notConnected = reason => ({
    status: 'not_connected', reason, fetchedAt: null, retryAt: null,
    points: null, alarms: unavailableAlarms(reason)
  });

  return async function read() {
    if (enabled !== true) return notConnected('myUplink-integrasjonen er slått av');
    if (!device) return notConnected('Mangler stabil myUplink-deviceId');
    if (typeof getAccessToken !== 'function') return notConnected('Ingen server-side tokenkilde er konfigurert for myUplink');

    const result = await cached();
    const payload = result.value;
    // energyReader keeps the last successful payload, so fetchedAt stays the original read.
    if (result.quality === 'live') {
      return { status: 'ok', reason: null, fetchedAt: payload.fetchedAt, retryAt: result.retryAt, points: payload.points, alarms: payload.alarms };
    }
    const reason = lastReason ?? safeReason(null);
    if (!payload) {
      return { status: lastKind === 'auth' ? 'not_connected' : 'unavailable', reason, fetchedAt: null, retryAt: result.retryAt, points: null, alarms: unavailableAlarms(reason) };
    }
    return { status: 'stale', reason, fetchedAt: payload.fetchedAt, retryAt: result.retryAt, points: payload.points, alarms: unavailableAlarms(reason) };
  };
}
