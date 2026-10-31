import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { parseReminder, parseTaskReminder, dueOn, nextOccurrence, taskReminderDue, taskReminderSms, reminderSms, createSmsReminders } from '../lib/smsReminders.js';
import { createHusetRoutes, parseTask } from '../routes/huset.js';

const memory = v => ({ read: async () => v, update: async fn => (v = fn(structuredClone(v))) });
const now = '2026-11-04T10:00:00Z'; // onsdag 4. nov, kl. 11:00 norsk tid

test('reminder validation: recipients, recurrence fields and time', () => {
  const ok = { tekst: 'Ta ut søpla', mottakere: ['Ylva', 'Vetle'], gjentakelse: 'ukentlig', ukedag: 2, klokkeslett: '18:00', av: 'Ole Andre' };
  const r = parseReminder(ok, new Date(now));
  assert.deepEqual([r.mottakere, r.ukedag, r.dag, r.dato, r.aktiv, r.sistSendt], [['Ylva', 'Vetle'], 2, null, null, true, null]);
  assert.equal(parseReminder({ ...ok, mottakere: undefined, mottaker: 'Ylva' }, new Date(now)).mottakere.length, 1);
  assert.throws(() => parseReminder({ ...ok, mottakere: [] }), /hvem/);
  assert.throws(() => parseReminder({ ...ok, mottakere: ['Naboen'] }), /Ukjent beboer/);
  assert.throws(() => parseReminder({ ...ok, ukedag: 8 }), /ukedag/);
  assert.throws(() => parseReminder({ ...ok, gjentakelse: 'maanedlig' }), /dag i måneden/);
  assert.equal(parseReminder({ ...ok, gjentakelse: 'maanedlig', dag: '31' }, new Date(now)).dag, 31);
  assert.throws(() => parseReminder({ ...ok, gjentakelse: 'en-gang', dato: '2026-11-03' }, new Date(now)), /dato/);
  assert.throws(() => parseReminder({ ...ok, klokkeslett: '25:00' }), /klokkeslett/);
  assert.throws(() => parseReminder({ ...ok, tekst: '' }), /minnes om/);
});

test('task reminder: days before, time and nagging; off when absent', () => {
  assert.equal(parseTaskReminder(undefined), null);
  assert.equal(parseTaskReminder({ sms: false }), null);
  assert.deepEqual(parseTaskReminder({}), { dagerFor: 0, klokkeslett: '08:00', purring: false });
  assert.deepEqual(parseTaskReminder({ dagerFor: '2', klokkeslett: '17:30', purring: true }), { dagerFor: 2, klokkeslett: '17:30', purring: true });
  assert.throws(() => parseTaskReminder({ dagerFor: 99 }), /dager før/);
  assert.deepEqual(parseTask({ tittel: 'Støvsuge', ansvarlig: 'Ylva', av: 'Ylva', frist: '2026-11-10', paaminnelse: { dagerFor: 1 } }).paaminnelse, { dagerFor: 1, klokkeslett: '08:00', purring: false });
});

test('due dates: weekday, day of month with clamping, one-off, daily', () => {
  assert.equal(dueOn({ gjentakelse: 'ukentlig', ukedag: 3 }, '2026-11-04'), true);   // onsdag
  assert.equal(dueOn({ gjentakelse: 'ukentlig', ukedag: 7 }, '2026-11-08'), true);   // søndag
  assert.equal(dueOn({ gjentakelse: 'ukentlig', ukedag: 1 }, '2026-11-04'), false);
  assert.equal(dueOn({ gjentakelse: 'maanedlig', dag: 31 }, '2026-11-30'), true);    // november har 30 dager
  assert.equal(dueOn({ gjentakelse: 'maanedlig', dag: 31 }, '2026-11-29'), false);
  assert.equal(dueOn({ gjentakelse: 'maanedlig', dag: 1 }, '2026-12-01'), true);
  assert.equal(dueOn({ gjentakelse: 'en-gang', dato: '2026-11-05' }, '2026-11-05'), true);
  assert.equal(dueOn({ gjentakelse: 'daglig' }, '2026-11-05'), true);
  const weekly = { aktiv: true, gjentakelse: 'ukentlig', ukedag: 3, klokkeslett: '18:00', sistSendt: null };
  assert.equal(nextOccurrence(weekly, '2026-11-04', '11:00'), '2026-11-04', 'i dag før klokkeslettet');
  assert.equal(nextOccurrence(weekly, '2026-11-04', '18:30'), '2026-11-11', 'i dag etter klokkeslettet');
  assert.equal(nextOccurrence({ ...weekly, sistSendt: '2026-11-04' }, '2026-11-04', '11:00'), '2026-11-11');
  assert.equal(nextOccurrence({ ...weekly, aktiv: false }, '2026-11-04', '11:00'), null);
  assert.equal(nextOccurrence({ aktiv: true, gjentakelse: 'maanedlig', dag: 31, klokkeslett: '08:00' }, '2026-11-04', '11:00'), '2026-11-30');
});

test('task reminder timing: chosen day before, catch-up until the due date, nagging after', () => {
  const t = { status: 'aktiv', frist: '2026-11-08', paaminnelse: { dagerFor: 2, klokkeslett: '08:00', purring: false }, sistPaaminnet: null };
  assert.equal(taskReminderDue(t, '2026-11-05', '09:00'), false, 'for tidlig');
  assert.equal(taskReminderDue(t, '2026-11-06', '07:59'), false, 'før klokkeslettet');
  assert.equal(taskReminderDue(t, '2026-11-06', '08:00'), true, 'påminnelsesdagen');
  assert.equal(taskReminderDue({ ...t, sistPaaminnet: '2026-11-06' }, '2026-11-07', '09:00'), false, 'allerede minnet om denne fristen');
  assert.equal(taskReminderDue(t, '2026-11-07', '09:00'), true, 'forsømt i går, tas igjen fram til fristen');
  assert.equal(taskReminderDue({ ...t, sistPaaminnet: '2026-11-06' }, '2026-11-09', '09:00'), false, 'forfalt uten purring');
  assert.equal(taskReminderDue({ ...t, sistPaaminnet: '2026-11-06', paaminnelse: { ...t.paaminnelse, purring: true } }, '2026-11-09', '09:00'), true, 'purring når forfalt');
  assert.equal(taskReminderDue({ ...t, sistPaaminnet: '2026-11-09', paaminnelse: { ...t.paaminnelse, purring: true } }, '2026-11-09', '09:00'), false, 'én purring per dag');
  assert.equal(taskReminderDue({ ...t, status: 'ferdig' }, '2026-11-06', '09:00'), false);
  // Gjentakende: ny frist etter fullføring gir ny påminnelse selv om sistPaaminnet er satt.
  assert.equal(taskReminderDue({ ...t, sistPaaminnet: '2026-11-06', frist: '2026-11-15' }, '2026-11-13', '09:00'), true);
  const task = { tittel: 'Ta ut søpla', ansvarlig: 'Ole Andre', frist: '2026-11-08', notat: 'Både rest og papp' };
  assert.equal(taskReminderSms(task, '2026-11-08', 'https://huset.test'), 'Hei Ole! Påminnelse fra Trivsel: Ta ut søpla – frist i dag.\nBåde rest og papp\nMerk som gjort: https://huset.test/huset');
  assert.match(taskReminderSms(task, '2026-11-07'), /frist i morgen\./);
  assert.match(taskReminderSms(task, '2026-11-10'), /^Hei Ole! Purring fra Trivsel: .* – frist var søndag 8\. november – det er ikke gjort ennå\./);
  assert.equal(reminderSms({ tekst: 'Vanne plantene' }, 'Vendela', ''), 'Hei Vendela! Påminnelse fra Trivsel: Vanne plantene');
});

function world({ clock = now, phones = { Ylva: '+4799999999', 'Ole Andre': '+4711111111' }, smsOk = true } = {}) {
  const sent = [], logged = [];
  const messaging = { channels: () => ({ sms: smsOk }), sendSms: async (to, text) => { if (text.includes('FEIL')) throw new Error('Fant ikke Send-knappen'); sent.push({ to, text }); } };
  const residents = { all: async () => Object.fromEntries(Object.entries(phones).map(([n, telefon]) => [n, { telefon }])) };
  const store = memory([]), tasks = memory([]);
  let t = clock;
  const sms = createSmsReminders({ messaging, residents, store, tasks, log: async e => logged.push(...e), now: () => new Date(t), origin: () => 'https://huset.test' });
  return { sms, sent, logged, store, tasks, setClock: v => { t = v; } };
}

test('tick sends scheduled reminders once per day, after the time, and marks one-offs done', async () => {
  const w = world();
  await w.store.update(() => [
    parseReminder({ tekst: 'Søppel ut', mottakere: ['Ylva', 'Ole Andre'], gjentakelse: 'ukentlig', ukedag: 3, klokkeslett: '12:00', av: 'Ole Andre' }, new Date(now)),
    parseReminder({ tekst: 'Husleie', mottakere: ['Ylva'], gjentakelse: 'maanedlig', dag: 4, klokkeslett: '09:00', av: 'Ole Andre' }, new Date(now)),
    parseReminder({ tekst: 'Tannlege', mottakere: ['Ylva'], gjentakelse: 'en-gang', dato: '2026-11-04', klokkeslett: '09:00', av: 'Ylva' }, new Date(now))
  ]);
  let sent = await w.sms.tick(); // 11:00: månedlig og én-gang går, ukentlig (12:00) venter
  assert.deepEqual(sent.map(e => [e.navn, e.status, e.kilde]), [['Ylva', 'sendt', 'planlagt'], ['Ylva', 'sendt', 'planlagt']]);
  assert.match(w.sent[0].text, /^Hei Ylva! Påminnelse fra Trivsel: Husleie\nhttps:\/\/huset\.test\/huset$/);
  const items = await w.store.read();
  assert.equal(items[1].sistSendt, '2026-11-04'); assert.equal(items[1].siste.status, 'sendt'); assert.equal(items[1].aktiv, true);
  assert.equal(items[2].aktiv, false, 'én gang: ferdig');
  assert.deepEqual(await w.sms.tick(), [], 'ingenting nytt samme minutt');
  w.setClock('2026-11-04T11:05:00Z'); // 12:05 norsk tid
  sent = await w.sms.tick();
  assert.deepEqual(sent.map(e => e.navn), ['Ylva', 'Ole Andre']);
  assert.deepEqual(await w.sms.tick(), [], 'ukentlig bare én gang den dagen');
  assert.equal(w.logged.length, 4);
});

test('missing phone and phone failure are honest statuses; send-now does not count as today', async () => {
  const w = world({ phones: { Ylva: '+4799999999' } });
  await w.store.update(() => [parseReminder({ tekst: 'FEIL', mottakere: ['Ylva', 'Vetle'], gjentakelse: 'daglig', klokkeslett: '09:00', av: 'Ylva' }, new Date(now))]);
  const sent = await w.sms.tick();
  assert.deepEqual(sent.map(e => [e.navn, e.status]), [['Ylva', 'feilet'], ['Vetle', 'ikke sendt']]);
  assert.match(sent[1].feil, /Mangler mobilnummer for Vetle/);
  const [r] = await w.store.read();
  assert.equal(r.siste.status, 'feilet'); assert.match(r.siste.feil, /Ylva: Fant ikke Send-knappen · Vetle: Mangler/);
  const manual = world();
  await manual.store.update(() => [parseReminder({ tekst: 'Hent pakke', mottakere: ['Ylva'], gjentakelse: 'ukentlig', ukedag: 3, klokkeslett: '18:00', av: 'Ylva' }, new Date(now))]);
  assert.deepEqual((await manual.sms.sendNow((await manual.store.read())[0].id)).map(e => [e.status, e.kilde]), [['sendt', 'manuell']]);
  assert.equal((await manual.store.read())[0].sistSendt, null, 'manuell utsending stopper ikke dagens planlagte');
  await assert.rejects(manual.sms.sendNow('finnes-ikke'), /finnes ikke/);
});

test('task reminders go to the responsible person and nag while overdue', async () => {
  const w = world();
  await w.tasks.update(() => [parseTask({ tittel: 'Ta ut søpla', ansvarlig: 'Ylva', av: 'Ole Andre', frist: '2026-11-06', gjentakelse: 'ukentlig', paaminnelse: { dagerFor: 2, klokkeslett: '10:00', purring: true } }, new Date(now))]);
  let sent = await w.sms.tick();
  assert.deepEqual(sent.map(e => [e.navn, e.status, e.kilde, e.emne]), [['Ylva', 'sendt', 'gjoremal', 'Ta ut søpla']]);
  assert.match(w.sent[0].text, /frist fredag 6\. november\./);
  assert.equal((await w.tasks.read())[0].sistPaaminnet, '2026-11-04');
  assert.deepEqual(await w.sms.tick(), []);
  w.setClock('2026-11-08T11:00:00Z'); // søndag, forfalt
  sent = await w.sms.tick();
  assert.equal(sent.length, 1); assert.match(w.sent[1].text, /^Hei Ylva! Purring/);
  w.setClock('2026-11-09T11:00:00Z');
  assert.equal((await w.sms.tick()).length, 1, 'purring hver dag');
  assert.equal((await w.tasks.read())[0].sistePaaminnelse.status, 'sendt');
});

test('huset routes: reminders CRUD with next occurrence, task reminder patch and send-now', async t => {
  const w = world();
  const app = express().use(express.json()).use('/huset', createHusetRoutes({ rules: memory(), tasks: w.tasks, reminders: w.store, sms: w.sms, residents: { all: async () => ({ Ylva: { telefon: '+4799999999' } }) }, messaging: { channels: () => ({ sms: true }) }, clock: () => new Date(now) }));
  const server = app.listen(0); t.after(() => server.close());
  const call = (p, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}${p}`, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
  const first = await call('/huset');
  assert.deepEqual([first.body.smsKanal, first.body.smsMottakere, first.body.weekdays.length, first.body.paaminnelser], [true, ['Ylva'], 7, []]);
  const added = await call('/huset/paaminnelser', 'POST', { tekst: 'Vanne plantene', mottakere: ['Ylva'], gjentakelse: 'ukentlig', ukedag: 5, klokkeslett: '18:00', av: 'Ylva' });
  assert.equal(added.status, 201); assert.equal(added.body.paaminnelser[0].neste, '2026-11-06');
  const id = added.body.paaminnelser[0].id;
  assert.equal((await call('/huset/paaminnelser', 'POST', { tekst: 'x', mottakere: ['Ylva'], gjentakelse: 'ukentlig', av: 'Ylva' })).status, 400);
  const paused = await call(`/huset/paaminnelser/${id}`, 'PATCH', { aktiv: false });
  assert.deepEqual([paused.body.paaminnelser[0].aktiv, paused.body.paaminnelser[0].neste], [false, null]);
  const edited = await call(`/huset/paaminnelser/${id}`, 'PATCH', { tekst: 'Vanne plantene og blomstene', gjentakelse: 'maanedlig', dag: 1, klokkeslett: '09:00', aktiv: true, mottakere: ['Ylva', 'Vetle'] });
  assert.deepEqual([edited.body.paaminnelser[0].id, edited.body.paaminnelser[0].neste, edited.body.paaminnelser[0].ukedag, edited.body.paaminnelser[0].mottakere], [id, '2026-12-01', null, ['Ylva', 'Vetle']]);
  const sendt = await call(`/huset/paaminnelser/${id}/send`, 'POST');
  assert.deepEqual(sendt.body.sendt.map(e => [e.navn, e.status]), [['Ylva', 'sendt'], ['Vetle', 'ikke sendt']]);
  assert.equal((await call(`/huset/paaminnelser/${id}`, 'DELETE')).body.paaminnelser.length, 0);
  assert.equal((await call('/huset/paaminnelser/nope', 'DELETE')).status, 404);

  const task = await call('/huset/gjoremal', 'POST', { tittel: 'Støvsuge', ansvarlig: 'Ylva', av: 'Ylva', frist: '2026-11-10', paaminnelse: { dagerFor: 1, klokkeslett: '19:00' } });
  const tid = task.body.tasks[0].id;
  assert.deepEqual(task.body.tasks[0].paaminnelse, { dagerFor: 1, klokkeslett: '19:00', purring: false });
  assert.equal((await call(`/huset/gjoremal/${tid}`, 'PATCH', { paaminnelse: null })).body.tasks[0].paaminnelse, null);
  assert.equal((await call(`/huset/gjoremal/${tid}`, 'PATCH', { paaminnelse: { dagerFor: 50 } })).status, 400);
  const now1 = await call(`/huset/gjoremal/${tid}/paaminn`, 'POST');
  assert.deepEqual(now1.body.sendt.map(e => [e.navn, e.status, e.kilde]), [['Ylva', 'sendt', 'manuell']]);
  assert.equal(now1.body.tasks[0].sistePaaminnelse.status, 'sendt');
});
