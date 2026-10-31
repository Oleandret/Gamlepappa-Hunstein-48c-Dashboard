import test from 'node:test';
import assert from 'node:assert/strict';
import { flatten, textsOf, screenKind, extractMessages, vigiloSms, parseSettings, createVigilo, VIGILO_BUNDLE } from '../lib/vigilo.js';

const el = (type, label, children = [], rect = { x: 0, y: 0, width: 10, height: 10 }) => ({ type: `XCUIElementType${type}`, label, rect, children });
const text = (label, rect) => el('StaticText', label, [], rect);
const key = (d, x) => el('Key', d, [], { x, y: 500, width: 40, height: 40 });
const pinScreen = el('Application', 'Vigilo', [text('Tast pinkode'), el('Button', 'Logg ut'), ...'1234567890'.split('').map((d, i) => key(d, i * 40))]);
const home = el('Application', 'Vigilo', [el('Button', 'Hjem', [], { x: 0, y: 760, width: 90, height: 40 }), el('Button', 'Meldinger', [], { x: 100, y: 760, width: 90, height: 40 })]);
const cell = (lines, y) => el('Cell', '', lines.map(l => text(l)), { x: 0, y, width: 375, height: 60 });
const listScreen = (childTabs = true) => el('Application', 'Vigilo', [
  ...(childTabs ? [el('Button', 'Andrea', [], { x: 20, y: 100, width: 80, height: 30 }), el('Button', 'Vendela', [], { x: 120, y: 100, width: 80, height: 30 })] : []),
  el('Table', '', [cell(['Lærer Kari', 'Foreldremøte torsdag', 'I går'], 200), cell(['Kontoret', 'Husk gymtøy', '2 dager siden'], 260)])
]);

test('tree helpers: flatten, texts, screen kinds and message extraction', () => {
  assert.equal(flatten(pinScreen).find(n => n.type === 'Key' && n.label === '3').x, 100);
  assert.deepEqual(textsOf(cell(['A', 'A', 'B'], 0)), ['A', 'B']);
  assert.equal(screenKind(flatten(pinScreen)), 'pin');
  assert.equal(screenKind(flatten(listScreen())), 'liste');
  assert.equal(screenKind(flatten(home)), 'ukjent');
  assert.equal(screenKind(flatten(el('Application', 'V', [el('SecureTextField', '')]))), 'innlogging');
  const m = extractMessages(listScreen(), 'Vendela');
  assert.equal(m.length, 2); assert.equal(m[0].barn, 'Vendela'); assert.equal(m[0].tekst, 'Lærer Kari\nForeldremøte torsdag\nI går'); assert.equal(m[0].id.length, 16);
  assert.equal(extractMessages(el('Application', '', [cell(['Melding til Andrea', 'Hei'], 0)]), null)[0].barn, 'Andrea', 'barnets navn i teksten');
  assert.equal(extractMessages(el('Application', '', [cell(['Hei'], 0)]), null)[0].barn, 'Ukjent');
  assert.notEqual(extractMessages(listScreen(), 'Vendela')[0].id, extractMessages(listScreen(), 'Andrea')[0].id, 'samme tekst per barn er egne meldinger');
});

test('sms text and settings validation', () => {
  const sms = vigiloSms([{ barn: 'Vendela', linjer: ['Lærer Kari', 'Foreldremøte torsdag', 'I går'] }, { barn: 'Andrea', linjer: ['Husk gymtøy'] }], 'https://huset.test');
  assert.equal(sms, 'Vigilo: 2 nye meldinger fra skolen.\n• Vendela: Lærer Kari – Foreldremøte torsdag – I går\n• Andrea: Husk gymtøy\nhttps://huset.test/vigilo');
  assert.match(vigiloSms([{ barn: 'A', linjer: ['x'] }]), /1 ny melding/);
  assert.match(vigiloSms(Array.from({ length: 8 }, (_, i) => ({ barn: 'A', linjer: [`m${i}`] }))), /… og 2 til\./);
  const s = parseSettings({ aktiv: true, klokkeslett: '16:00', mottakere: ['Ole Andre', 'Naboen', 'Ingvild'], barn: ['Andrea', ' Vendela '] });
  assert.deepEqual([s.aktiv, s.klokkeslett, s.mottakere, s.barn], [true, '16:00', ['Ole Andre', 'Ingvild'], ['Andrea', 'Vendela']]);
  assert.throws(() => parseSettings({ klokkeslett: '25:00' }), /klokkeslett/);
  assert.throws(() => parseSettings({ barn: [] }), /barn/);
  assert.equal(parseSettings({}).aktiv, false);
});

function fakeRemote(screens, { pinOk = true } = {}) {
  const log = []; let i = 0, pinTyped = '';
  const remote = {
    serial: fn => fn(),
    unlock: async () => { log.push('unlock'); }, home: async () => { log.push('home'); },
    launch: async b => { log.push(`launch ${b}`); },
    tap: async (x, y) => { log.push(`tap ${x},${y}`); const keys = flatten(screens[i]).filter(n => n.type === 'Key'); const k = keys.find(n => Math.round(n.x) === x && Math.round(n.y) === y); if (k) pinTyped += k.label; else if (i < screens.length - 1) i++; if (pinTyped.length === 4 && pinOk) i++; },
    source: async () => { log.push(`source ${i}`); return screens[Math.min(i, screens.length - 1)]; }
  };
  return { remote, log, pin: () => pinTyped };
}
function world({ screens, env = { IPHONE_REMOTE_URL: 'https://gw.test', IPHONE_REMOTE_USER: 'u', IPHONE_REMOTE_PASSWORD: 'p', VIGILO_PIN: '2580' }, phones = { 'Ole Andre': '+4711111111' }, pinOk } = {}) {
  const store = new Map(), sent = [];
  const fake = fakeRemote(screens, { pinOk });
  const v = createVigilo({ env, remote: fake.remote, sleep: async () => {}, now: () => new Date('2026-11-05T14:31:00Z'),
    messaging: { channels: () => ({ sms: true }), sendSms: async (to, t) => sent.push({ to, t }) },
    residents: { all: async () => Object.fromEntries(Object.entries(phones).map(([n, telefon]) => [n, { telefon }])) },
    read: async ns => store.get(ns), update: async (ns, fn) => { const v = fn(structuredClone(store.get(ns) ?? null)); store.set(ns, v); return v; }, origin: () => 'https://huset.test' });
  return { v, store, sent, ...fake };
}

test('a run: unlock, launch, pin, messages tab, one child at a time, store new, notify, log; second run finds nothing new', async () => {
  const w = world({ screens: [pinScreen, home, listScreen(), listScreen(), listScreen()] });
  await w.v.saveSettings({ aktiv: true, mottakere: ['Ole Andre', 'Ingvild'], barn: ['Andrea', 'Vendela'] });
  const run = await w.v.run({ source: 'manuell' });
  assert.equal(run.status, 'ok', run.feil);
  assert.equal(w.pin(), '2580');
  assert.ok(w.log.includes(`launch ${VIGILO_BUNDLE}`)); assert.equal(w.log.at(-1), 'home');
  assert.equal(run.nye, 4, 'to meldinger per barn'); assert.equal(run.antall, 4);
  assert.deepEqual(run.varsler.map(x => [x.navn, x.status]), [['Ole Andre', 'sendt'], ['Ingvild', 'ikke sendt']]);
  assert.match(w.sent[0].t, /^Vigilo: 4 nye meldinger fra skolen\.\n• Andrea: Lærer Kari – Foreldremøte torsdag – I går/);
  assert.deepEqual(run.skjermer.map(s => s.navn), ['start', 'etter pin', 'meldinger', 'Andrea', 'Vendela']);
  assert.ok(run.steg.some(s => /Tastet pinkoden/.test(s.tekst)));
  assert.equal((await w.v.messages()).length, 4); assert.equal((await w.v.messages())[0].funnet, '2026-11-05T14:31:00.000Z');
  assert.equal((await w.v.log()).length, 1);
  const again = await w.v.run({ source: 'manuell' });
  assert.deepEqual([again.nye, again.varsler.length, w.sent.length], [0, 0, 1]);
});

test('honest failures: missing pin, rejected pin, login screen; tick runs once per day after the time', async () => {
  const noPin = world({ screens: [pinScreen], env: { IPHONE_REMOTE_URL: 'https://gw.test', IPHONE_REMOTE_USER: 'u', IPHONE_REMOTE_PASSWORD: 'p' } });
  const r1 = await noPin.v.run(); assert.equal(r1.status, 'feil'); assert.match(r1.feil, /VIGILO_PIN/); assert.equal(noPin.log.at(-1), 'home', 'alltid hjem etterpå');
  const wrong = world({ screens: [pinScreen, pinScreen], pinOk: false });
  assert.match((await wrong.v.run()).feil, /ikke godtatt/);
  const login = world({ screens: [el('Application', 'V', [el('SecureTextField', '')])] });
  assert.match((await login.v.run()).feil, /innloggingsskjermen/);
  assert.equal(login.v.pinSet(), true); assert.equal(noPin.v.pinSet(), false);
  const w = world({ screens: [home, listScreen(false)] });
  assert.equal(await w.v.tick(), null, 'ikke aktiv');
  await w.v.saveSettings({ aktiv: true, klokkeslett: '16:00', barn: ['Andrea'] });
  assert.equal(await w.v.tick(), null, 'før klokkeslettet (15:31 norsk tid)');
  await w.v.saveSettings({ aktiv: true, klokkeslett: '15:00', barn: ['Andrea'] });
  const t = await w.v.tick(); assert.equal(t.status, 'ok'); assert.equal(t.kilde, 'daglig'); assert.equal(t.nye, 2);
  assert.equal(await w.v.tick(), null, 'bare én gang per dag');
  assert.equal((await w.v.settings()).sistKjort, '2026-11-05');
  const notConfigured = world({ screens: [home], env: {} });
  await assert.rejects(notConfigured.v.run(), /iphone-remote/);
});
