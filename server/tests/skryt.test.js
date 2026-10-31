import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createSkrytRoutes, parseSkryt, leaderboard, winners, monthOf, previousMonth, skrytSms, notifySkryt } from '../routes/skryt.js';

const memory = v => ({ read: async () => v, update: async fn => (v = fn(structuredClone(v))) });
const at = (iso) => new Date(iso);

test('skryt validation: two different residents, text, points', () => {
  const ok = { til: 'Ylva', fra: 'Ole Andre', tekst: 'Ryddet kjøkkenet', poeng: 2 };
  const s = parseSkryt(ok, at('2026-11-04T10:00:00Z'));
  assert.deepEqual([s.til, s.fra, s.poeng, s.sms], ['Ylva', 'Ole Andre', 2, true]);
  assert.equal(parseSkryt({ ...ok, poeng: undefined }).poeng, 1);
  assert.equal(parseSkryt({ ...ok, sendSms: false }).sms, false);
  assert.throws(() => parseSkryt({ ...ok, fra: 'Ylva' }), /deg selv/);
  assert.throws(() => parseSkryt({ ...ok, til: 'Naboen' }), /får skryt/);
  assert.throws(() => parseSkryt({ ...ok, poeng: 7 }), /poeng/);
  assert.throws(() => parseSkryt({ ...ok, tekst: ' ' }), /Skriv/);
});

test('months follow Oslo time and the leaderboard ranks by points, then count, then name', () => {
  assert.equal(monthOf('2026-10-31T23:30:00Z'), '2026-11', 'norsk tid er over midnatt');
  assert.equal(previousMonth('2026-01'), '2025-12'); assert.equal(previousMonth('2026-11'), '2026-10');
  const items = [
    { til: 'Ylva', fra: 'Ole Andre', poeng: 3, opprettet: '2026-11-02T10:00:00Z' },
    { til: 'Vetle', fra: 'Ylva', poeng: 1, opprettet: '2026-11-03T10:00:00Z' },
    { til: 'Vetle', fra: 'Ylva', poeng: 2, opprettet: '2026-11-04T10:00:00Z' },
    { til: 'Andrea', fra: 'Vetle', poeng: 3, opprettet: '2026-10-20T10:00:00Z' }
  ];
  const nov = leaderboard(items, '2026-11');
  assert.deepEqual(nov.slice(0, 2).map(r => [r.navn, r.poeng, r.antall, r.gitt]), [['Vetle', 3, 2, 0], ['Ylva', 3, 1, 2]]);
  assert.equal(nov.length, 7, 'alle beboere er med');
  assert.deepEqual(winners(items, '2026-11'), ['Vetle', 'Ylva'], 'delt seier ved likt');
  assert.deepEqual(winners(items, '2026-10'), ['Andrea']);
  assert.equal(winners(items, '2026-09'), null);
  assert.equal(leaderboard(items)[0].poeng, 3);
});

test('sms to the one praised with the current standing; honest statuses', async () => {
  const item = { til: 'Ylva', fra: 'Ole Andre', tekst: 'Ryddet kjøkkenet', poeng: 2 };
  assert.equal(skrytSms(item, 5, 'https://huset.test'), 'Hei Ylva! Ole Andre gir deg stort skryt (2 poeng): «Ryddet kjøkkenet»\nDu har nå 5 poeng i Trivsel denne måneden. Fortsett sånn!\nhttps://huset.test/skryt');
  const sent = [];
  const messaging = { channels: () => ({ sms: true }), sendSms: async (to, t) => sent.push([to, t]) };
  const residents = r => ({ all: async () => ({ Ylva: r }) });
  assert.equal((await notifySkryt(item, 2, { messaging, residents: residents({ telefon: '+4799999999' }) })).status, 'sendt');
  assert.equal(sent[0][0], '+4799999999');
  assert.equal((await notifySkryt(item, 2, { messaging, residents: residents({}) })).status, 'mangler_telefon');
  assert.equal((await notifySkryt({ ...item, sms: false }, 2, { messaging, residents: residents({}) })).status, 'valgt_bort');
  assert.equal((await notifySkryt(item, 2, { messaging: { ...messaging, channels: () => ({ sms: false }) }, residents: residents({}) })).status, 'ikke_satt_opp');
});

test('routes: give praise (resident always as self), leaderboard, prize for the owner only, undo own praise only', async t => {
  const store = memory([]), prize = memory(null);
  let user = { role: 'beboer', navn: 'Ylva' };
  const notified = [];
  const app = express().use(express.json()).use((req, _res, next) => { req.user = user; next(); })
    .use('/skryt', createSkrytRoutes({ store, prize, clock: () => at('2026-11-04T10:00:00Z'), notify: async (item, poeng) => { notified.push([item.til, poeng]); return { kanal: 'sms', status: 'sendt', at: 'x' }; }, owner: req => req.user?.role === 'admin' }));
  const server = app.listen(0); t.after(() => server.close());
  const call = (p, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}${p}`, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
  const first = await call('/skryt');
  assert.deepEqual([first.body.month, first.body.premie, first.body.forrige.vinnere, first.body.points.length], ['2026-11', '', null, 3]);
  const given = await call('/skryt', 'POST', { til: 'Vetle', fra: 'Ole Andre', tekst: 'Tok ut søpla uten å bli spurt', poeng: 3 });
  assert.equal(given.status, 201); assert.equal(given.body.item.fra, 'Ylva', 'beboer gir alltid i eget navn');
  assert.equal(given.body.leaderboard[0].navn, 'Vetle'); assert.equal(given.body.leaderboard[0].poeng, 3);
  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(notified, [['Vetle', 3]]);
  assert.equal((await store.read())[0].varsel.status, 'sendt');
  assert.equal((await call('/skryt', 'POST', { til: 'Ylva', tekst: 'Meg selv' })).status, 400, 'ikke til seg selv');
  assert.equal((await call('/skryt/premie', 'PUT', { tekst: 'Kino' })).status, 403, 'beboer kan ikke sette premie');
  const other = await call('/skryt', 'POST', { til: 'Andrea', tekst: 'Fin middag', poeng: 1 });
  user = { role: 'beboer', navn: 'Vetle' };
  assert.equal((await call(`/skryt/${other.body.item.id}`, 'DELETE')).status, 403, 'bare giveren kan angre');
  assert.equal((await store.read()).length, 2, 'skrytet ble lagt tilbake');
  user = { role: 'admin' };
  assert.equal((await call('/skryt/premie', 'PUT', { tekst: 'Velge middag en fredag' })).body.premie, 'Velge middag en fredag');
  assert.equal((await call(`/skryt/${other.body.item.id}`, 'DELETE')).body.items.length, 1, 'eieren kan angre');
  assert.equal((await call('/skryt/nope', 'DELETE')).status, 404);
});
