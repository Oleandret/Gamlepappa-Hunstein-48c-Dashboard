import test from 'node:test';
import assert from 'node:assert/strict';
import { createMyUplinkReader } from '../lib/myuplinkReader.js';

const point = (patch = {}) => ({
  category: 'Varmepumpe', parameterId: '40004', parameterName: 'Utetemperatur (BT1)', parameterUnit: '°C',
  timestamp: '2026-10-17T09:59:00Z', value: -3.2, strVal: '-3.2', smartHomeCategories: [], writable: false, ...patch
});
const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const grant = { accessToken: 'token-abc', scope: 'READSYSTEM' };

function harness({ points = [point()], notifications, token = grant, ...options } = {}) {
  const calls = { points: [], notifications: [], token: 0 };
  const fetchImpl = async (url, init) => {
    const target = url.includes('/notifications/') ? 'notifications' : 'points';
    calls[target].push({ url, init });
    const responder = target === 'points' ? points : notifications;
    if (typeof responder === 'function') return responder();
    return json(responder ?? []);
  };
  const getAccessToken = token === null ? undefined : async () => { calls.token++; return typeof token === 'function' ? token() : token; };
  let t = 0;
  const read = createMyUplinkReader({ enabled: true, deviceId: 'dev-1', getAccessToken, fetchImpl, now: () => t, ...options });
  return { read, calls, clock: ms => { t = ms; }, now: () => t };
}

test('disabled and default construction reach neither token nor network', async () => {
  let fetches = 0, tokens = 0;
  const bare = createMyUplinkReader();
  assert.equal((await bare()).status, 'not_connected');
  const off = createMyUplinkReader({ enabled: false, deviceId: 'dev-1', getAccessToken: async () => { tokens++; return grant; }, fetchImpl: async () => { fetches++; return json([]); } });
  const result = await off();
  assert.equal(result.status, 'not_connected');
  assert.deepEqual([fetches, tokens], [0, 0]);
  assert.equal(result.points, null, 'an empty array would read as "no points"');
  assert.equal(result.alarms.available, false);
  assert.equal(result.fetchedAt, null);
});

test('enabled without a stable deviceId or server token source stays not_connected', async () => {
  for (const options of [{ deviceId: '' }, { deviceId: '   ' }, { deviceId: undefined }, { deviceId: 42 }]) {
    const h = harness(options);
    const result = await h.read();
    assert.equal(result.status, 'not_connected');
    assert.deepEqual([h.calls.points.length, h.calls.token], [0, 0]);
  }
  const noToken = harness({ token: null });
  assert.equal((await noToken.read()).status, 'not_connected');
  assert.equal(noToken.calls.points.length, 0);
});

test('only the fixed points URL is requested, with GET and the injected bearer', async () => {
  const h = harness();
  assert.equal((await h.read()).status, 'ok');
  assert.equal(h.calls.points.length, 1);
  const { url, init } = h.calls.points[0];
  assert.equal(url, 'https://api.myuplink.com/v2/devices/dev-1/points');
  assert.equal(init.method, 'GET');
  assert.equal(init.headers.Authorization, 'Bearer token-abc');
  // read() takes no arguments, so no caller can inject a URL, a method or a client token.
  assert.equal(h.read.length, 0);
  const weird = harness({ deviceId: 'a/b c?x=1', systemId: 'sys/9' , notifications: [] });
  await weird.read();
  assert.equal(weird.calls.points[0].url, 'https://api.myuplink.com/v2/devices/a%2Fb%20c%3Fx%3D1/points');
  assert.equal(weird.calls.notifications[0].url, 'https://api.myuplink.com/v2/systems/sys%2F9/notifications/active');
});

test('output is allowlisted ParameterData; the rest of the raw response never leaves', async () => {
  const h = harness({ points: [{ ...point(), deviceId: 'SECRET-DEVICE', zoneId: 'SECRET-ZONE', enumValues: ['SECRET'] }, 'junk', null] });
  const result = await h.read();
  assert.equal(result.points.length, 1);
  assert.deepEqual(Object.keys(result.points[0]).sort(), ['category', 'parameterId', 'parameterName', 'parameterUnit', 'smartHomeCategories', 'strVal', 'timestamp', 'value', 'writable']);
  assert.ok(!JSON.stringify(result).includes('SECRET'));
  // Raw timestamp is preserved verbatim and kept apart from fetchedAt.
  assert.equal(result.points[0].timestamp, '2026-10-17T09:59:00Z');
  assert.equal(result.fetchedAt, 0);
  assert.equal(result.points[0].value, -3.2);
  assert.ok(!JSON.stringify(result).includes('token-abc'));
});

test('tokens beyond READSYSTEM, or no token at all, are refused before any request', async () => {
  for (const token of [{ accessToken: 'token-abc', scope: 'READSYSTEM WRITESYSTEM' }, { accessToken: 'token-abc', scope: 'WRITESYSTEM' }, { accessToken: 'token-abc', scope: '' }, { accessToken: 'token-abc' }, { accessToken: '', scope: 'READSYSTEM' }, {}, null]) {
    const h = harness({ token });
    const result = await h.read();
    assert.equal(result.status, 'not_connected');
    assert.equal(h.calls.points.length, 0, 'a rejected grant must not reach the network');
    assert.match(result.reason, /myUplink/);
    assert.ok(!result.reason.includes('token-abc'));
  }
  assert.equal((await harness({ token: { accessToken: 'token-abc', scope: ' READSYSTEM ' } }).read()).status, 'ok');
});

test('reads are single-flight and cached for 60s, then refetched', async () => {
  const h = harness();
  const [a, b] = await Promise.all([h.read(), h.read()]);
  assert.equal(h.calls.points.length, 1);
  assert.deepEqual(a, b);
  h.clock(59_999);
  assert.equal((await h.read()).fetchedAt, 0);
  assert.equal(h.calls.points.length, 1);
  h.clock(60_001);
  assert.equal((await h.read()).fetchedAt, 60_001);
  assert.equal(h.calls.points.length, 2);
});

test('429 keeps the original fetchedAt, backs off, and blames myUplink rather than Homey', async () => {
  let fail = false;
  const h = harness({ points: () => (fail ? new Response('SECRET BODY', { status: 429, headers: { 'Retry-After': '120' } }) : json([point()])) });
  assert.equal((await h.read()).status, 'ok');
  fail = true;
  h.clock(60_001);
  const stale = await h.read();
  assert.equal(stale.status, 'stale');
  assert.equal(stale.fetchedAt, 0, 'a failed refresh must not restamp the data');
  assert.equal(stale.points.length, 1);
  assert.match(stale.reason, /myUplink/);
  assert.match(stale.reason, /429/);
  assert.ok(!/Homey/i.test(JSON.stringify(stale)));
  assert.ok(!JSON.stringify(stale).includes('SECRET'));
  assert.equal(stale.retryAt, 180_001);
  h.clock(120_000);
  assert.equal((await h.read()).status, 'stale');
  assert.equal(h.calls.points.length, 2, 'backoff suppresses requests until retryAt');
  assert.equal(h.calls.token, 2);
});

test('a first failure or unknown shape is unavailable with no invented data', async () => {
  for (const points of [() => new Response('SECRET BODY', { status: 500 }), () => json({ notAnArray: true }), () => { throw new Error('SECRET network detail'); }]) {
    const h = harness({ points });
    const result = await h.read();
    assert.equal(result.status, 'unavailable');
    assert.equal(result.points, null);
    assert.equal(result.fetchedAt, null);
    assert.equal(result.alarms.available, false);
    assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
});

test('alarms are unavailable rather than empty when the system is unconfigured or failing', async () => {
  const unconfigured = harness();
  const plain = await unconfigured.read();
  assert.deepEqual([plain.alarms.available, plain.alarms.count], [false, null]);
  assert.match(plain.alarms.reason, /systemId/);
  assert.equal(unconfigured.calls.notifications.length, 0);

  const broken = harness({ systemId: 'sys-1', notifications: () => new Response('SECRET BODY', { status: 503 }) });
  const degraded = await broken.read();
  assert.equal(degraded.status, 'ok', 'a failed alarm read must not invalidate the points');
  assert.equal(degraded.points.length, 1);
  assert.deepEqual([degraded.alarms.available, degraded.alarms.count], [false, null]);
  assert.match(degraded.alarms.reason, /myUplink/);
  assert.ok(!JSON.stringify(degraded).includes('SECRET'));

  const shaped = harness({ systemId: 'sys-1', notifications: () => json({ unexpected: true }) });
  assert.equal((await shaped.read()).alarms.available, false);

  for (const [body, count] of [[{ notifications: [{ id: 1 }], numItems: 12 }, 12], [{ notifications: [], numItems: 0 }, 0]]) {
    const ok = harness({ systemId: 'sys-1', notifications: () => json(body) });
    const result = await ok.read();
    assert.deepEqual([result.alarms.available, result.alarms.count], [true, count]);
    assert.equal(ok.calls.notifications[0].init.headers.Authorization, 'Bearer token-abc');
  }
});

test('the server adapter does not reach into client sources', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../lib/myuplinkReader.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('client/src'));
  assert.ok(!/Homey/i.test(source));
});

test('alarm 429 backoff is independent of successful points refresh', async () => {
  const h = harness({ systemId: 's', notifications: () => new Response('', { status: 429, headers: { 'Retry-After': '180' } }) });
  assert.equal((await h.read()).alarms.count, null);
  h.clock(60001); assert.equal((await h.read()).status, 'ok');
  h.clock(120002); await h.read();
  assert.equal(h.calls.points.length, 3);
  assert.equal(h.calls.notifications.length, 1);
  h.clock(180003); await h.read(); assert.equal(h.calls.notifications.length, 2);
});
test('nested values and truthy non-boolean enable flags fail closed', async () => {
  const h = harness({ points: [point({ value: { secret: 'nested-secret' } })] });
  assert.ok(!JSON.stringify(await h.read()).includes('nested-secret'));
  const off = harness({ enabled: 'true' });
  assert.equal((await off.read()).status, 'not_connected'); assert.equal(off.calls.token, 0);
});

test('offline_access is accepted only with explicit offline approval; write scopes always rejected',async()=>{
  const token={accessToken:'fixture',scope:'READSYSTEM offline_access'};
  assert.equal((await harness({token}).read()).status,'not_connected');
  assert.equal((await harness({token,allowOffline:true}).read()).status,'ok');
  assert.equal((await harness({token:{...token,scope:'READSYSTEM offline_access WRITESYSTEM'},allowOffline:true}).read()).status,'not_connected');
});
