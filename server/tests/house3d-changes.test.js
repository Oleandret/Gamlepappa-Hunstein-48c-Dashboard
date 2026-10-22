import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHouse3dChanges, cleanTarget } from '../lib/house3dChanges.js';
import { changesWorker } from '../lib/auth.js';

function memoryStore() {
  let data;
  let n = 0;
  return createHouse3dChanges({ read: async () => data, update: async fn => { data = fn(structuredClone(data)); return data; }, now: () => '2026-10-22T20:00:00.000Z', id: () => `id-${++n}` });
}

test('endringsønsker lagres, oppdateres med status og PR, og slettes', async () => {
  const s = memoryStore();
  const a = await s.add({ target: { kind: 'furniture', label: 'Sofa', roomId: 'f1-kjokken', point: [1.234, 0.5, 2], hacker: 'x' }, text: '  Sofaen skal være grå  ', by: 'ole@example.com' });
  assert.equal(a.status, 'ny');
  assert.equal(a.text, 'Sofaen skal være grå');
  assert.deepEqual(a.target, { kind: 'furniture', label: 'Sofa', roomId: 'f1-kjokken', point: [1.23, 0.5, 2] });
  const b = await s.patch(a.id, { status: 'gjort', pr: 'https://github.com/Oleandret/Gamlepappa-Hunstein-48c-Dashboard/pull/32', note: 'Byttet farge' });
  assert.equal(b.status, 'gjort');
  assert.equal(b.pr, 'https://github.com/Oleandret/Gamlepappa-Hunstein-48c-Dashboard/pull/32');
  await assert.rejects(s.patch(a.id, { status: 'ferdig' }), /Ukjent status/);
  await assert.rejects(s.patch(a.id, { pr: 'https://evil.example/pull/1' }), /GitHub-lenke/);
  await assert.rejects(s.patch('finnes-ikke', { status: 'gjort' }), /finnes ikke/);
  await assert.rejects(s.add({ target: { kind: 'room' }, text: 'x' }), /Skriv hva/);
  await assert.rejects(s.add({ target: null, text: 'Flytt veggen' }), /Velg et element/);
  await s.remove(a.id);
  assert.deepEqual(await s.list(), []);
});

test('ukjent elementtype blir et punkt, og lange felt kuttes', () => {
  const t = cleanTarget({ kind: '<script>', label: 'x'.repeat(500), point: [1, 'a', 3] });
  assert.equal(t.kind, 'point');
  assert.equal(t.label.length, 120);
  assert.equal(t.point, undefined);
});

test('modellnøkkelen gir bare lesing av listen og PATCH av ett ønske', () => {
  const token = 'k'.repeat(40);
  const req = (method, path, auth = `Bearer ${token}`) => ({ method, path, headers: { authorization: auth } });
  assert.equal(changesWorker(req('GET', '/house3d/changes'), token), true);
  assert.equal(changesWorker(req('PATCH', '/house3d/changes/0f3c-12ab'), token), true);
  assert.equal(changesWorker(req('POST', '/house3d/changes'), token), false);
  assert.equal(changesWorker(req('GET', '/config/house3dEdits'), token), true);
  assert.equal(changesWorker(req('PUT', '/config/house3dEdits'), token), true);
  assert.equal(changesWorker(req('PUT', '/config/house3dDoors'), token), false);
  assert.equal(changesWorker(req('GET', '/config'), token), false);
  assert.equal(changesWorker(req('DELETE', '/house3d/changes/abc'), token), false);
  assert.equal(changesWorker(req('GET', '/homey/devices'), token), false);
  assert.equal(changesWorker(req('GET', '/house3d/changes', 'Bearer feil'), token), false);
  assert.equal(changesWorker(req('GET', '/house3d/changes'), 'for-kort'), false);
});

test('endringsønskene ligger bak felles tilgangskontroll', () => {
  const s = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.ok(s.indexOf("app.use('/api/house3d/changes'") > s.indexOf('}, accessControl)'));
});
