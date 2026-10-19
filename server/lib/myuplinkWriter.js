// myUplink setting writer. Server-side only, one fixed URL, and only for points the
// device itself reports as writable in a fresh read. Limits come from the device
// (minValue/maxValue/stepValue/enumValues); nothing is guessed. Every attempt is
// verified with a new read and written to the change log, also when it fails.
import { hasWriteScope } from './myuplinkOAuth.js';
import { fetchJson } from './http.js';

const POINTS_URL = id => `https://api.myuplink.com/v2/devices/${encodeURIComponent(id)}/points`;
export const MAX_CHANGES = 20;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const finite = v => typeof v === 'number' && Number.isFinite(v);
const same = (a, b) => String(a) === String(b) || (finite(Number(a)) && finite(Number(b)) && Math.abs(Number(a) - Number(b)) < 1e-9);

// Returns the value to send as a string, or throws with a reason a person can act on.
export function validateChange(point, requested) {
  const name = point?.parameterName || point?.parameterId;
  if (!point) throw fail('Innstillingen finnes ikke på varmepumpen');
  if (point.writable !== true) throw fail(`${name} kan ikke endres`);
  if (Array.isArray(point.enumValues) && point.enumValues.length) {
    const match = point.enumValues.find(e => String(e.value) === String(requested));
    if (!match) throw fail(`${name}: ugyldig valg`);
    return String(match.value);
  }
  const value = typeof requested === 'string' && requested.trim() ? Number(requested.replace(',', '.')) : requested;
  if (!finite(value)) throw fail(`${name}: verdien må være et tall`);
  if (!finite(point.minValue) || !finite(point.maxValue)) throw fail(`${name}: varmepumpen oppgir ingen grenser, så den endres ikke herfra`);
  if (value < point.minValue || value > point.maxValue) throw fail(`${name}: må være mellom ${point.minValue} og ${point.maxValue}`);
  if (finite(point.stepValue) && point.stepValue > 0) {
    const steps = (value - point.minValue) / point.stepValue;
    if (Math.abs(steps - Math.round(steps)) > 1e-6) throw fail(`${name}: må gå i steg på ${point.stepValue}`);
  }
  return String(value);
}

export function createMyUplinkWriter({ deviceId, getAccessToken, changeLog, fetchImpl = fetch, wait = ms => new Promise(r => setTimeout(r, ms)), settleMs = 4000, now = Date.now }) {
  let queue = Promise.resolve();

  async function headers() {
    const granted = await getAccessToken();
    if (!granted?.accessToken || !hasWriteScope(granted.scope)) throw fail('Varmepumpen er koblet til uten skrivetilgang. Koble til myUplink på nytt med skrivetilgang.', 403);
    return { Authorization: `Bearer ${granted.accessToken}`, Accept: 'application/json', 'Accept-Language': 'en-US' };
  }
  async function readPoints(h) {
    const body = await fetchJson(POINTS_URL(deviceId), { method: 'GET', headers: h }, { fetchImpl });
    if (!Array.isArray(body)) throw fail('Ukjent svarformat fra myUplink', 503);
    return new Map(body.filter(p => p && typeof p === 'object').map(p => [String(p.parameterId), p]));
  }

  // changes: {parameterId: value}. source: 'manuell' | 'gjenoppretting:<dato>' | other system callers.
  function apply(changes, { source = 'manuell', actor = 'eier' } = {}) {
    const task = queue.catch(() => {}).then(async () => {
      const entries = Object.entries(changes || {});
      if (!entries.length) throw fail('Ingen endringer å lagre');
      if (entries.length > MAX_CHANGES) throw fail(`Maks ${MAX_CHANGES} endringer om gangen`);
      const h = await headers();
      const before = await readPoints(h);
      const body = {}, results = [];
      for (const [id, requested] of entries) {
        const point = before.get(String(id));
        try {
          const value = validateChange(point, requested);
          if (same(point.value, value)) results.push({ parameterId: id, name: point.parameterName, from: point.value, to: value, status: 'uendret' });
          else body[id] = value;
        } catch (e) { results.push({ parameterId: id, name: point?.parameterName ?? null, to: requested, status: 'avvist', reason: e.message }); }
      }
      const sent = Object.keys(body);
      let upstream = null, upstreamError = null;
      if (sent.length) {
        try { upstream = await fetchJson(POINTS_URL(deviceId), { method: 'PATCH', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, { fetchImpl }); }
        catch (e) { upstreamError = e.upstreamStatus === 403 ? 'myUplink nektet endringen (403). Kontroller skrivetilgang og abonnement.' : e.upstreamStatus === 409 ? 'Varmepumpen er opptatt eller frakoblet (409)' : 'myUplink tok ikke imot endringen'; }
        let after = null;
        if (!upstreamError) { await wait(settleMs); after = await readPoints(h).catch(() => null); }
        for (const id of sent) {
          const point = before.get(id), now = after?.get(id);
          const status = upstreamError ? 'feilet' : now && same(now.value, body[id]) ? 'bekreftet' : 'sendt, ikke bekreftet ennå';
          results.push({ parameterId: id, name: point.parameterName, unit: point.parameterUnit || null, from: point.value, to: body[id], status, upstream: typeof upstream?.[id] === 'string' ? upstream[id].slice(0, 100) : null, reason: upstreamError });
        }
      }
      const entry = { at: new Date(now()).toISOString(), actor, source, deviceId, results };
      await changeLog?.append(entry);
      return entry;
    });
    queue = task;
    return task;
  }
  return { apply, readPoints: async () => readPoints(await headers()) };
}
