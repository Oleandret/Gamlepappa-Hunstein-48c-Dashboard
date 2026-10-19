import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAvvikRoutes, parseAvvik } from '../routes/avvik.js';

function harness() {
  let store;
  const app = express().use(express.json()).use('/avvik', createAvvikRoutes({
    read: async () => store,
    update: async fn => (store = fn(structuredClone(store))),
    clock: () => new Date('2026-10-19T08:00:00Z')
  }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/avvik`;
  const req = (path, method = 'GET', body) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
    .then(async r => ({ status: r.status, body: await r.json() }));
  return { req, close: () => server.close() };
}

test('rejects unknown residents, categories and empty descriptions', () => {
  const ok = { person: 'Ylva', registrertAv: 'Ole Andre', kategori: 'Kjøkken', beskrivelse: 'Oppvasken ble stående' };
  assert.equal(parseAvvik(ok).status, 'apen');
  assert.throws(() => parseAvvik({ ...ok, person: 'Ukjent' }), /hvem avviket gjelder/);
  assert.throws(() => parseAvvik({ ...ok, registrertAv: '' }), /registrerer/);
  assert.throws(() => parseAvvik({ ...ok, kategori: 'Hemmelig' }), /kategori/);
  assert.throws(() => parseAvvik({ ...ok, beskrivelse: '   ' }), /hva som skjedde/);
  assert.throws(() => parseAvvik({ ...ok, beskrivelse: 'x'.repeat(501) }), /maks/);
});

test('creates, resolves, reopens and deletes an avvik', async () => {
  const h = harness();
  try {
    const empty = await h.req('');
    assert.deepEqual(empty.body.items, []);
    assert.equal(empty.body.residents.length, 7);
    const created = await h.req('', 'POST', { person: 'Vetle', registrertAv: 'Ingvild', kategori: 'Lys og strøm', beskrivelse: '  Lyset sto  på i kjelleren ' });
    assert.equal(created.status, 201);
    assert.equal(created.body.item.beskrivelse, 'Lyset sto på i kjelleren');
    const id = created.body.item.id;
    const resolved = await h.req(`/${id}`, 'PATCH', { status: 'lost' });
    assert.equal(resolved.body.items[0].lost, '2026-10-19T08:00:00.000Z');
    const reopened = await h.req(`/${id}`, 'PATCH', { status: 'apen' });
    assert.equal(reopened.body.items[0].lost, null);
    assert.equal((await h.req(`/${id}`, 'PATCH', { status: 'slettet' })).status, 400);
    assert.equal((await h.req('/finnes-ikke', 'PATCH', { status: 'lost' })).status, 404);
    assert.deepEqual((await h.req(`/${id}`, 'DELETE')).body.items, []);
    assert.equal((await h.req(`/${id}`, 'DELETE')).status, 404);
  } finally { h.close(); }
});
