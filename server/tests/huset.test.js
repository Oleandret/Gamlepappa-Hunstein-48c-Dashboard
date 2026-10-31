import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHusetRoutes, nextDue, parseTask } from '../routes/huset.js';
import { createAvvikRoutes } from '../routes/avvik.js';

const memory = () => { let v; return { read: async () => v, update: async fn => (v = fn(structuredClone(v))) }; };

function harness(t, now = '2026-10-19T08:00:00Z') {
  const rules = memory(), tasks = memory(), avvik = memory();
  const clock = () => new Date(now);
  const app = express().use(express.json())
    .use('/huset', createHusetRoutes({ rules, tasks, clock }))
    .use('/avvik', createAvvikRoutes({ ...avvik, proposeRule: rule => rules.update(prev => [rule, ...(prev || [])]), clock }));
  const server = app.listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  return (p, method = 'GET', body) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
}

test('recurring due dates step past today and clamp month ends', () => {
  assert.equal(nextDue('2026-10-19', 'ukentlig', '2026-10-19'), '2026-10-26');
  assert.equal(nextDue('2026-10-01', 'ukentlig', '2026-10-19'), '2026-10-22');
  assert.equal(nextDue('2026-10-19', 'daglig', '2026-10-19'), '2026-10-20');
  assert.equal(nextDue('2026-10-19', 'annenhver-uke', '2026-10-19'), '2026-11-02');
  assert.equal(nextDue('2026-01-31', 'maanedlig', '2026-01-31'), '2026-02-28');
  assert.equal(nextDue('2026-10-19', 'ingen', '2026-10-19'), null);
});

test('task validation rejects unknown people, recurrence and dates', () => {
  const ok = { tittel: 'Tømme oppvaskmaskinen', ansvarlig: 'Ylva', av: 'Ole Andre', gjentakelse: 'daglig', frist: '2026-10-19' };
  assert.equal(parseTask(ok).status, 'aktiv');
  assert.throws(() => parseTask({ ...ok, ansvarlig: 'Naboen' }), /ansvarlig/);
  assert.throws(() => parseTask({ ...ok, gjentakelse: 'hver time' }), /gjentakelse/);
  assert.throws(() => parseTask({ ...ok, frist: '2026-13-40' }), /frist/);
  assert.throws(() => parseTask({ ...ok, tittel: ' ' }), /gjøres/);
});

test('rules: add, approve a proposal and delete', async t => {
  const call = harness(t);
  const added = await call('/huset/regler', 'POST', { tekst: 'Skru av lyset når du går ut av et rom', av: 'Ingvild', kategori: 'Lys og strøm', status: 'forslag' });
  assert.equal(added.status, 201);
  const id = added.body.rules[0].id;
  assert.equal((await call(`/huset/regler/${id}`, 'PATCH', { status: 'gjeldende' })).body.rules[0].status, 'gjeldende');
  assert.equal((await call(`/huset/regler/${id}`, 'PATCH', { status: 'tull' })).status, 400);
  assert.deepEqual((await call(`/huset/regler/${id}`, 'DELETE')).body.rules, []);
  assert.equal((await call(`/huset/regler/${id}`, 'DELETE')).status, 404);
});

test('completing a recurring task logs who did it and moves the due date', async t => {
  const call = harness(t);
  const created = await call('/huset/gjoremal', 'POST', { tittel: 'Ta ut søpla', ansvarlig: 'Vetle', av: 'Ole Andre', gjentakelse: 'ukentlig', frist: '2026-10-19' });
  const id = created.body.tasks[0].id;
  const done = (await call(`/huset/gjoremal/${id}/fullfor`, 'POST', { av: 'Andrea' })).body.tasks[0];
  assert.equal(done.status, 'aktiv');
  assert.equal(done.frist, '2026-10-26');
  assert.deepEqual([done.fullfort[0].av, done.fullfort[0].dato, done.fullfort[0].frist], ['Andrea', '2026-10-19', '2026-10-19']);
  const once = (await call('/huset/gjoremal', 'POST', { tittel: 'Vaske bilen', ansvarlig: 'Viljar', av: 'Viljar' })).body.tasks[0];
  assert.equal(once.frist, '2026-10-19');
  assert.equal((await call(`/huset/gjoremal/${once.id}/fullfor`, 'POST', { av: 'Viljar' })).body.tasks[0].status, 'ferdig');
  assert.equal((await call(`/huset/gjoremal/${once.id}/fullfor`, 'POST', { av: 'Viljar' })).status, 400);
  assert.equal((await call(`/huset/gjoremal/${id}`, 'PATCH', { ansvarlig: 'Vendela' })).body.tasks.find(x => x.id === id).ansvarlig, 'Vendela');
  const all = await call('/huset');
  assert.equal(all.body.today, '2026-10-19');
  assert.equal(all.body.tasks.length, 2);
});

test('an avvik suggestion can be proposed as a house rule', async t => {
  const call = harness(t);
  const res = await call('/avvik', 'POST', { person: 'Ylva', registrertAv: 'Ingvild', kategori: 'Kjøkken', positivt: 'Er flink til å hjelpe til', beskrivelse: 'Oppvasken sto over natta', forslag: 'Oppvasken tas samme kveld', foreslaRegel: true });
  assert.equal(res.status, 201);
  assert.equal(res.body.item.forslag, 'Oppvasken tas samme kveld');
  assert.equal(res.body.rule.status, 'forslag');
  const rules = (await call('/huset')).body.rules;
  assert.deepEqual(rules.map(r => [r.tekst, r.status, r.fraAvvik]), [['Oppvasken tas samme kveld', 'forslag', res.body.item.id]]);
  const plain = await call('/avvik', 'POST', { person: 'Ylva', registrertAv: 'Ingvild', positivt: 'Er flink til å hjelpe til', beskrivelse: 'Uten forslag', foreslaRegel: true });
  assert.equal(plain.body.rule, null);
});
