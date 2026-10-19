import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createMyUplinkWriter, validateChange } from '../lib/myuplinkWriter.js';
import { createHeatingSettingsLog, diffSettings, settingsOf } from '../lib/heatingSettingsLog.js';
import { createHeatingRoutes } from '../routes/heating.js';
import { validReadScope } from '../lib/myuplinkOAuth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const curve = (patch = {}) => ({ parameterId: '47007', parameterName: 'Varmekurve', parameterUnit: '', writable: true, value: 7, minValue: 1, maxValue: 15, stepValue: 1, ...patch });
const offset = (patch = {}) => ({ parameterId: '47011', parameterName: 'Forskyvning', parameterUnit: '°C', writable: true, value: 0, minValue: -10, maxValue: 10, stepValue: 1, ...patch });
const mode = (patch = {}) => ({ parameterId: '47137', parameterName: 'Driftsmodus', writable: true, value: 0, enumValues: [{ value: '0', text: 'Auto' }, { value: '1', text: 'Manuell' }], ...patch });
const outdoor = { parameterId: '40004', parameterName: 'Utetemperatur', writable: false, value: -3 };

function device(points) {
  let state = points.map(p => ({ ...p }));
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null, auth: init.headers.Authorization });
    if (init.method === 'PATCH') {
      const body = JSON.parse(init.body);
      state = state.map(p => p.parameterId in body ? { ...p, value: Number(body[p.parameterId]) } : p);
      return json(Object.fromEntries(Object.keys(body).map(k => [k, 'modified'])));
    }
    return json(state);
  };
  return { fetchImpl, calls, get state() { return state; } };
}
const writeToken = async () => ({ accessToken: 'fixture', scope: 'READSYSTEM WRITESYSTEM' });

test('write scope is accepted only when write access is approved', () => {
  assert.equal(validReadScope('READSYSTEM WRITESYSTEM', false), false);
  assert.equal(validReadScope('READSYSTEM WRITESYSTEM', false, true), true);
  assert.equal(validReadScope('READSYSTEM WRITESYSTEM offline_access', true, true), true);
  assert.equal(validReadScope('WRITESYSTEM', false, true), false);
});

test('changes are validated against the device limits, never guessed', () => {
  assert.equal(validateChange(curve(), 9), '9');
  assert.equal(validateChange(offset(), '-2'), '-2');
  assert.equal(validateChange(mode(), '1'), '1');
  assert.throws(() => validateChange(curve(), 16), /mellom 1 og 15/);
  assert.throws(() => validateChange(curve(), 7.5), /steg/);
  assert.throws(() => validateChange(curve(), 'mye'), /tall/);
  assert.throws(() => validateChange(mode(), '7'), /ugyldig valg/);
  assert.throws(() => validateChange(outdoor, 5), /kan ikke endres/);
  assert.throws(() => validateChange(curve({ minValue: null }), 5), /ingen grenser/);
  assert.throws(() => validateChange(undefined, 5), /finnes ikke/);
});

test('writer sends only valid changes, confirms by re-reading and logs every attempt', async () => {
  const d = device([curve(), offset(), outdoor]);
  const logged = [];
  const writer = createMyUplinkWriter({ deviceId: 'dev-1', getAccessToken: writeToken, changeLog: { append: async e => logged.push(e) }, fetchImpl: d.fetchImpl, wait: async () => {} });
  const entry = await writer.apply({ 47007: 9, 47011: 0, 40004: 1, 99999: 1 }, { source: 'manuell' });
  const patch = d.calls.filter(c => c.method === 'PATCH');
  assert.equal(patch.length, 1);
  assert.deepEqual(patch[0].body, { 47007: '9' });
  assert.equal(patch[0].url, 'https://api.myuplink.com/v2/devices/dev-1/points');
  const by = Object.fromEntries(entry.results.map(r => [r.parameterId, r.status]));
  assert.deepEqual(by, { 47007: 'bekreftet', 47011: 'uendret', 40004: 'avvist', 99999: 'avvist' });
  assert.equal(entry.results.find(r => r.parameterId === '47007').from, 7);
  assert.equal(logged.length, 1);
});

test('writer refuses a read-only token and makes no request', async () => {
  const d = device([curve()]);
  const writer = createMyUplinkWriter({ deviceId: 'dev-1', getAccessToken: async () => ({ accessToken: 'x', scope: 'READSYSTEM' }), fetchImpl: d.fetchImpl, wait: async () => {} });
  await assert.rejects(() => writer.apply({ 47007: 9 }), e => e.status === 403);
  assert.equal(d.calls.length, 0);
});

test('a rejected PATCH is reported as failed and still logged', async () => {
  const d = device([curve()]);
  const logged = [];
  const fetchImpl = async (url, init) => init.method === 'PATCH' ? json({}, 403) : d.fetchImpl(url, init);
  const writer = createMyUplinkWriter({ deviceId: 'dev-1', getAccessToken: writeToken, changeLog: { append: async e => logged.push(e) }, fetchImpl, wait: async () => {} });
  const entry = await writer.apply({ 47007: 9 });
  assert.equal(entry.results[0].status, 'feilet');
  assert.match(entry.results[0].reason, /403/);
  assert.equal(logged.length, 1);
});

test('daily log keeps one file per day, only rewrites on change, and diffs against now', async t => {
  const dir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'settings-')), 'heating-settings');
  t.after(() => fs.rm(path.dirname(dir), { recursive: true, force: true }));
  let clock = Date.parse('2026-10-18T10:00:00Z');
  const log = createHeatingSettingsLog({ dir, now: () => clock });
  const id = { deviceId: 'dev-1', systemId: 'sys-1' };
  assert.deepEqual(settingsOf([curve(), outdoor]).map(s => s.parameterId), ['47007']);
  assert.deepEqual(await log.record({ status: 'ok', points: [curve(), offset(), outdoor] }, id), { date: '2026-10-18', changed: true });
  assert.deepEqual(await log.record({ status: 'ok', points: [curve(), offset(), outdoor] }, id), { date: '2026-10-18', changed: false });
  assert.equal(await log.record({ status: 'stale', points: [curve({ value: 2 })] }, id), null);
  clock += 86400000;
  await log.record({ status: 'ok', points: [curve({ value: 9 }), offset({ value: -2 })] }, id);
  assert.deepEqual(await log.days(), ['2026-10-19', '2026-10-18']);
  const old = await log.day('2026-10-18');
  assert.equal((await fs.stat(path.join(dir, 'settings-2026-10-18.json'))).mode & 0o777, 0o600);
  const diff = diffSettings(old, [curve({ value: 9 }), offset({ value: -2 })]);
  assert.deepEqual(diff.map(d => [d.parameterId, d.current, d.value, d.restorable]), [['47007', 9, 7, true], ['47011', -2, 0, true]]);
  assert.equal(await log.day('../../etc/passwd'), null);
  await log.append({ at: 'a', results: [] }); await log.append({ at: 'b', results: [] });
  assert.deepEqual((await log.changes()).map(c => c.at), ['b', 'a']);
});

test('settings routes: owner-only writes, restore applies only the differing settings', async t => {
  const dir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'settings-')), 'heating-settings');
  t.after(() => fs.rm(path.dirname(dir), { recursive: true, force: true }));
  const log = createHeatingSettingsLog({ dir, now: () => Date.parse('2026-10-18T10:00:00Z') });
  await log.record({ status: 'ok', points: [curve(), offset(), mode()] }, { deviceId: 'dev-1' });
  const d = device([curve({ value: 9 }), offset(), mode({ value: 1 })]);
  const writer = createMyUplinkWriter({ deviceId: 'dev-1', getAccessToken: writeToken, changeLog: log, fetchImpl: d.fetchImpl, wait: async () => {} });
  let owner = true, resets = 0;
  const oauth = { status: async () => ({ writeApproved: true, writeGranted: true }), owner: () => { if (!owner) throw Object.assign(new Error('nei'), { status: 403 }); } };
  const read = async () => ({ status: 'ok', fetchedAt: 1, points: d.state });
  const app = express().use(express.json()).use('/h', createHeatingRoutes(read, oauth, { log: () => log, writer: async () => writer, afterWrite: () => resets++ }));
  const server = app.listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/h`;
  const call = (p, method = 'GET', body) => fetch(base + p, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));

  const settings = await call('/settings');
  assert.equal(settings.body.settings.length, 3);
  const day = await call('/settings/history/2026-10-18');
  assert.deepEqual(day.body.diff.map(x => x.parameterId).sort(), ['47007', '47137']);
  owner = false;
  assert.equal((await call('/settings', 'POST', { changes: { 47007: 8 } })).status, 403);
  assert.equal((await call('/settings/restore', 'POST', { date: '2026-10-18' })).status, 403);
  owner = true;
  const restored = await call('/settings/restore', 'POST', { date: '2026-10-18', parameterIds: ['47007'] });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.source, 'gjenoppretting:2026-10-18');
  assert.deepEqual(restored.body.results.map(r => [r.parameterId, r.status]), [['47007', 'bekreftet']]);
  assert.equal(d.state.find(p => p.parameterId === '47137').value, 1, 'not selected, not restored');
  assert.equal(resets, 1);
  assert.equal((await call('/settings', 'POST', { changes: { 47011: 99 } })).body.results[0].status, 'avvist');
  assert.equal((await call('/settings/changes')).body.changes.length, 2);
  assert.equal((await call('/settings/history/2026-01-01')).status, 404);
  assert.equal((await call('/anything', 'DELETE')).status, 405);
});
