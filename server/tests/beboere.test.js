import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createResidents, normalizePhone, normalizeEmail } from '../lib/residents.js';
import { createReminders, composeReminder } from '../lib/reminders.js';
import { createBeboerRoutes } from '../routes/beboere.js';
import { accessControl, isOwner } from '../lib/auth.js';

const memory = (v) => ({ read: async () => v, update: async fn => (v = fn(structuredClone(v))) });

function setup(t, { channels = { epost: true, sms: true } } = {}) {
  const sent = [];
  const messaging = { channels: () => channels, sendEmail: async (to, subject, text) => sent.push({ kanal: 'epost', to, subject, text }), sendSms: async (to, text) => sent.push({ kanal: 'sms', to, text }) };
  const residents = createResidents({ store: memory(), sessionStore: memory(), messaging, publicOrigin: () => 'https://huset.test' });
  const app = express().use(express.json()).use('/auth/beboer', residents.router)
    .use('/admin', createBeboerRoutes({ residents, messaging, owner: () => true, reminders: { settings: async () => ({}), log: async () => [] } }));
  const server = app.listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const call = async (p, method = 'GET', body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body && JSON.stringify(body) });
    const set = r.headers.get('set-cookie'); if (set?.startsWith('__Host-huset-session=')) cookie = set.split(';')[0];
    return { status: r.status, body: await r.json() };
  };
  return { call, sent, residents, cookie: () => cookie, clearCookie: () => { cookie = ''; } };
}

test('byEmail finds the resident with that e-mail registered (for Google login)', async t => {
  const { residents } = setup(t);
  await residents.updateContact('Ylva', { epost: 'Ylva@Gmail.com' });
  assert.equal(await residents.byEmail('ylva@gmail.com'), 'Ylva');
  assert.equal(await residents.byEmail('  YLVA@gmail.com '), 'Ylva');
  assert.equal(await residents.byEmail('ukjent@gmail.com'), null);
  assert.equal(await residents.byEmail('ikke en e-post'), null);
});

test('phone and e-mail are normalized; Norwegian 8 digits get +47', () => {
  assert.equal(normalizePhone('912 34 567'), '+4791234567');
  assert.equal(normalizePhone('0047 91234567'), '+4791234567');
  assert.equal(normalizePhone('12'), null);
  assert.equal(normalizeEmail(' Ylva@Example.NO '), 'ylva@example.no');
  assert.equal(normalizeEmail('ikke-en-adresse'), null);
});

test('owner registers contacts; addresses are unique and passwords never exposed', async t => {
  const h = setup(t);
  const r = await h.call('/admin/beboer/Ylva', 'PUT', { epost: 'ylva@example.no', telefon: '91234567', epostVarsel: true, smsVarsel: true });
  const ylva = r.body.beboere.find(b => b.navn === 'Ylva');
  assert.deepEqual([ylva.epost, ylva.telefon, ylva.epostVarsel, ylva.harPassord], ['ylva@example.no', '+4791234567', true, false]);
  assert.equal((await h.call('/admin/beboer/Vetle', 'PUT', { epost: 'ylva@example.no' })).status, 400);
  assert.equal((await h.call('/admin/beboer/Naboen', 'PUT', { epost: 'x@example.no' })).status, 404);
  assert.equal((await h.call('/admin/beboer/Vetle', 'PUT', { telefon: '123' })).status, 400);
  assert.ok(!JSON.stringify(r.body).includes('hash'));
});

test('self-registration with a code sent to the registered address, then login with e-mail or phone', async t => {
  const h = setup(t);
  await h.call('/admin/beboer/Vetle', 'PUT', { epost: 'vetle@example.no', telefon: '+4799887766' });
  const unknown = await h.call('/auth/beboer/kode', 'POST', { identifikator: 'fremmed@example.no' });
  assert.equal(unknown.status, 200, 'same answer for unknown addresses');
  assert.equal(h.sent.length, 0);
  await h.call('/auth/beboer/kode', 'POST', { identifikator: 'Vetle@example.no' });
  assert.equal(h.sent[0].to, 'vetle@example.no');
  const code = /(\d{6})/.exec(h.sent[0].text)[1];
  assert.equal((await h.call('/auth/beboer/passord', 'POST', { identifikator: 'vetle@example.no', kode: '000000', passord: 'langtpassord1' })).status, 401);
  assert.equal((await h.call('/auth/beboer/passord', 'POST', { identifikator: 'vetle@example.no', kode: code, passord: 'kort' })).status, 400);
  const ok = await h.call('/auth/beboer/passord', 'POST', { identifikator: 'vetle@example.no', kode: code, passord: 'langtpassord1' });
  assert.deepEqual(ok.body, { ok: true, navn: 'Vetle' });
  assert.match(h.cookie(), /^__Host-huset-session=/);
  assert.equal((await h.call('/auth/beboer/passord', 'POST', { identifikator: 'vetle@example.no', kode: code, passord: 'langtpassord2' })).status, 401, 'code is single use');
  h.clearCookie();
  assert.equal((await h.call('/auth/beboer/logginn', 'POST', { identifikator: 'vetle@example.no', passord: 'feil-passord' })).status, 401);
  assert.equal((await h.call('/auth/beboer/logginn', 'POST', { identifikator: '998 87 766', passord: 'langtpassord1' })).body.navn, 'Vetle');
  const sms = await h.call('/auth/beboer/kode', 'POST', { identifikator: '99887766' });
  assert.equal(sms.status, 200);
  assert.equal(h.sent.at(-1).kanal, 'sms');
});

test('invitation link sets a password once and expires after use', async t => {
  const h = setup(t);
  const { lenke } = (await h.call('/admin/beboer/Andrea/invitasjon', 'POST')).body;
  assert.match(lenke, /^https:\/\/huset\.test\/huset\?invitasjon=/);
  const token = new URL(lenke).searchParams.get('invitasjon');
  assert.equal((await h.call('/auth/beboer/invitasjon/sjekk', 'POST', { token })).body.navn, 'Andrea');
  assert.equal((await h.call('/auth/beboer/invitasjon', 'POST', { token, passord: 'andreas-passord' })).body.navn, 'Andrea');
  assert.equal((await h.call('/auth/beboer/invitasjon', 'POST', { token, passord: 'andreas-passord' })).status, 404);
  assert.equal((await h.call('/admin', 'GET')).body.beboere.find(b => b.navn === 'Andrea').harPassord, true);
});

test('residents can only reach Huset, need CSRF to write, and are never owners', async () => {
  const resident = { navn: 'Ylva', csrfToken: 'csrf-fixture' };
  const run = (path, method = 'GET', headers = {}) => new Promise(resolve => {
    const req = { path, method, ip: `beboer-${path}-${method}`, headers: { cookie: '__Host-huset-session=abc', ...headers } };
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { resolve({ status: this.statusCode, body }); } };
    accessControl(req, res, () => resolve({ status: 'next', user: req.user }), { residentSession: async () => resident });
  });
  const allowed = await run('/huset/gjoremal/x/fullfor', 'POST', { 'x-csrf-token': 'csrf-fixture' });
  assert.equal(allowed.status, 'next');
  assert.equal(allowed.user.navn, 'Ylva');
  assert.equal(isOwner({ user: allowed.user }), false);
  assert.equal((await run('/avvik')).status, 'next');
  assert.equal((await run('/huset/gjoremal', 'POST')).status, 403, 'missing CSRF');
  assert.equal((await run('/huset/paaminnelser/x/send', 'POST', { 'x-csrf-token': 'csrf-fixture' })).status, 'next', 'påminnelser er en del av Trivsel');
  for (const path of ['/heating/settings', '/homey/devices', '/huset/admin', '/config/links', '/chat/x']) assert.equal((await run(path)).status, 403, path);
  assert.equal(isOwner({ user: { method: 'google', email: 'oleandretorjussen@gmail.com' } }), true);
  assert.equal(isOwner({ user: { method: 'google', email: 'annen@example.com' } }), false);
  assert.equal(isOwner({ user: { method: 'bearer', role: 'admin' } }), false);
});

test('owner routes refuse anyone but the owner', async t => {
  const app = express().use('/admin', createBeboerRoutes({ owner: () => false }));
  const server = app.listen(0); t.after(() => server.close());
  const r = await fetch(`http://127.0.0.1:${server.address().port}/admin`);
  assert.equal(r.status, 403);
});

test('reminders: only what is due, per enabled channel, once per day after the chosen time', async () => {
  const tasks = [
    { status: 'aktiv', ansvarlig: 'Vetle', tittel: 'Ta ut søpla', frist: '2026-10-17' },
    { status: 'aktiv', ansvarlig: 'Vetle', tittel: 'Tømme oppvaskmaskinen', frist: '2026-10-19' },
    { status: 'aktiv', ansvarlig: 'Vetle', tittel: 'Senere', frist: '2026-10-25' },
    { status: 'aktiv', ansvarlig: 'Ylva', tittel: 'Neste uke', frist: '2026-10-26' }
  ];
  const msg = composeReminder('Vetle', { tasks, avvik: [{ status: 'apen', person: 'Vetle' }], today: '2026-10-19', origin: 'https://huset.test' });
  assert.match(msg.text, /Forfalt:\n- Ta ut søpla/);
  assert.match(msg.text, /I dag:\n- Tømme oppvaskmaskinen/);
  assert.doesNotMatch(msg.text, /Senere/);
  assert.match(msg.text, /1 åpne avvik/);
  assert.equal(composeReminder('Ylva', { tasks, today: '2026-10-19' }), null);

  const store = { _gjoremal: tasks, _avvik: [], _paaminnelser: { aktiv: true, klokkeslett: '07:30' } };
  const read = async k => store[k], update = async (k, fn) => (store[k] = fn(store[k]));
  const sent = [];
  let clock = new Date('2026-10-19T05:00:00Z'); // 07:00 i Oslo
  const r = createReminders({
    read, update, now: () => clock, origin: () => '',
    residents: { all: async () => ({ Vetle: { epost: 'vetle@example.no', epostVarsel: true, telefon: '+4799887766', smsVarsel: true }, Ylva: { epost: 'ylva@example.no', epostVarsel: true } }) },
    messaging: { channels: () => ({ epost: true, sms: false }), sendEmail: async to => sent.push(to), sendSms: async to => sent.push(to) }
  });
  assert.equal(await r.tick(), null, 'before 07:30');
  clock = new Date('2026-10-19T05:31:00Z');
  const first = await r.tick();
  assert.deepEqual(sent, ['vetle@example.no']);
  assert.deepEqual(first.map(e => [e.navn, e.kanal, e.status]), [['Vetle', 'epost', 'sendt'], ['Vetle', 'sms', 'ikke sendt']]);
  assert.equal(await r.tick(), null, 'only once per day');
  assert.equal((await r.log()).length, 2);
  await assert.rejects(() => r.saveSettings({ aktiv: true, klokkeslett: '25:00' }));
  const test = await r.run({ only: 'Ylva', always: true, source: 'test' });
  assert.deepEqual(test.map(e => [e.navn, e.status]), [['Ylva', 'sendt']]);
});
