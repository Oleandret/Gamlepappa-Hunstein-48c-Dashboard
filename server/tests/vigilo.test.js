import test from 'node:test';
import assert from 'node:assert/strict';
import { flatten, textsOf, screenKind, extractMessages, parseMessageCell, parseMessageDetail, vigiloSms, parseSettings, createVigilo, VIGILO_BUNDLE, childSelector, childOption, backButton, messagesTab } from '../lib/vigilo.js';

// Skjermer slik Vigilo ser ut (slik appen er bygget opp, med oppdiktede navn), som tilgjengelighetstrær.
const el = (type, label, children = [], rect = { x: 0, y: 0, width: 10, height: 10 }) => ({ type: `XCUIElementType${type}`, label, rect, children });
const text = (label, rect) => el('StaticText', label, [], rect);
const key = (d, x) => el('Key', d, [], { x, y: 500, width: 40, height: 40 });
const pinScreen = el('Application', 'Vigilo', [text('Tast pinkode'), el('Button', 'Logg ut'), ...'1234567890'.split('').map((d, i) => key(d, i * 40))]);
const tabs = [el('Other', 'Nyheter', [], { x: 20, y: 760, width: 50, height: 20 }), el('Other', 'Meldinger', [], { x: 110, y: 760, width: 50, height: 20 }), el('Other', 'Fravær', [], { x: 200, y: 760, width: 50, height: 20 })];
const title = el('Other', 'Meldinger', [], { x: 150, y: 55, width: 80, height: 20 });
const selector = (navn, open = false) => el('Cell', `${navn}, ${open ? 'Lukk' : 'Utvid'}`, [], { x: 0, y: 100, width: 375, height: 34 });
const cell = (y, { tittel, avsender, utdrag, dato, ulest = false }) => el('Cell', ulest ? 'Uleste' : `${tittel} ${dato} ${avsender} - ${utdrag}`, [text(tittel), text(avsender), text(` - ${utdrag}`), text(dato)], { x: 0, y, width: 375, height: 70 });
const MSG = {
  Vendela: [{ tittel: 'Uke 44', avsender: 'Kari Kontaktlærer', utdrag: 'God ettermiddag! Jeg legger ved ukas plan', dato: '26. okt.' }, { tittel: 'Uke 43', avsender: 'Kari Kontaktlærer', utdrag: 'God ettermiddag. Ukeplan', dato: '19. okt.', ulest: true }, { tittel: 'Uke 40', avsender: 'Kari Kontaktlærer', utdrag: 'Vedlagt er ukeplanen', dato: '28. sep.' }],
  Andrea: [{ tittel: 'Kantine uke 44', avsender: 'Ola Kantine', utdrag: 'Hei. Onsdag 28.oktober', dato: '23. okt.' }]
};
const BODY = { 'Uke 44': 'God ettermiddag! Jeg legger ved ukas plan og oppskrift. Hilsen Kari.', 'Uke 43': 'God ettermiddag. Ukeplan og oppskrift her. Hilsen Kari.', 'Uke 40': 'Vedlagt er ukeplanen, og en forenklet versjon.', 'Kantine uke 44': 'Hei. Onsdag 28.oktober vil det være salg av hjemmelaget pizza i kantinen.' };
const newsScreen = el('Application', 'Vigilo', [el('Other', 'Nyheter', [], { x: 150, y: 55, width: 80, height: 20 }), selector('Vendela Testbarn'), text('28. oktober 2026'), ...tabs]);
const listScreen = (navn, { open = false, scrolled = 0 } = {}) => el('Application', 'Vigilo', [title, selector(navn === 'Vendela' ? 'Vendela Testbarn' : 'Andrea Testbarn', open),
  ...(open ? [el('Cell', 'Andrea Testbarn', [text('Andrea T.')], { x: 0, y: 160, width: 375, height: 34 }), el('Cell', 'Vendela Testbarn', [text('Vendela T.')], { x: 0, y: 194, width: 375, height: 34 })] : []),
  ...MSG[navn].map((m, i) => cell(180 + i * 300 - scrolled, m)), el('Button', 'Opprett', [], { x: 280, y: 720, width: 40, height: 40 }), ...tabs]);
const detailScreen = m => el('Application', 'Vigilo', [el('Button', 'Tilbake', [], { x: 20, y: 60, width: 40, height: 20 }), el('Other', 'Meldinger', [], { x: 150, y: 55, width: 80, height: 20 }), text(`Tittel: ${m.tittel}`), text(m.avsender), text(BODY[m.tittel]), text(`${m.dato} 2026 - 08:00`), el('TextView', 'Unngå sensitiv informasjon'), el('Button', 'Send')]);

test('tree helpers and screen pieces', () => {
  assert.equal(flatten(pinScreen).find(n => n.type === 'Key' && n.label === '3').x, 100);
  assert.deepEqual(textsOf(el('Cell', '', [text('A'), text('A'), text('B')])), ['A', 'B']);
  assert.equal(screenKind(flatten(pinScreen)), 'pin');
  assert.equal(screenKind(flatten(listScreen('Vendela'))), 'liste');
  assert.equal(screenKind(flatten(el('Application', 'V', [el('SecureTextField', '')]))), 'innlogging');
  const nodes = flatten(listScreen('Vendela', { open: true }));
  assert.match(childSelector(nodes).label, /Lukk$/);
  assert.equal(childOption(nodes, 'Andrea').label, 'Andrea Testbarn');
  assert.equal(childOption(nodes, 'Viljar'), null);
  assert.equal(messagesTab(nodes).y, 770);
  assert.equal(backButton(flatten(detailScreen(MSG.Vendela[0]))).label, 'Tilbake');
});

test('message cells and details are parsed; ids follow child + title + sender + date', () => {
  const m = extractMessages(listScreen('Vendela'), 'Vendela');
  assert.equal(m.length, 3, 'barnevelgeren er ikke en melding');
  assert.deepEqual([m[0].tittel, m[0].avsender, m[0].dato, m[0].utdrag, m[0].ulest, m[1].ulest], ['Uke 44', 'Kari Kontaktlærer', '26. okt.', 'God ettermiddag! Jeg legger ved ukas plan', false, true]);
  assert.equal(m[0].id.length, 16);
  assert.notEqual(parseMessageCell(flatten(listScreen('Vendela')).find(n => n.type === 'Cell' && /Uke 44/.test(n.label)), 'Andrea').id, m[0].id, 'samme melding på to barn er to meldinger');
  assert.equal(parseMessageCell(flatten(listScreen('Vendela')).find(n => n.type === 'Cell' && /Uke 44/.test(n.label)), 'Vendela').id, m[0].id, 'stabil id');
  const d = parseMessageDetail(detailScreen(MSG.Vendela[0]));
  assert.deepEqual(d, { tittel: 'Uke 44', tidspunkt: '26. okt. 2026 - 08:00', innhold: BODY['Uke 44'] });
});

test('sms text and settings validation', () => {
  const sms = vigiloSms([{ barn: 'Vendela', tittel: 'Uke 44', avsender: 'Kari Kontaktlærer', innhold: 'God ettermiddag! Jeg legger ved ukas plan.' }, { barn: 'Andrea', tittel: 'Kantine', utdrag: 'Hei.' }], 'https://huset.test');
  assert.equal(sms, 'Vigilo: 2 nye meldinger fra skolen.\n• Vendela: Uke 44 (Kari Kontaktlærer) – God ettermiddag! Jeg legger ved ukas plan.\n• Andrea: Kantine – Hei.\nhttps://huset.test/vigilo');
  assert.match(vigiloSms([{ barn: 'A', tittel: 'x' }]), /1 ny melding/);
  assert.match(vigiloSms(Array.from({ length: 8 }, (_, i) => ({ barn: 'A', tittel: `m${i}` }))), /… og 2 til\./);
  const s = parseSettings({ aktiv: true, klokkeslett: '16:00', mottakere: ['Ole Andre', 'Naboen', 'Ingvild'], barn: ['Andrea', ' Vendela '] });
  assert.deepEqual([s.aktiv, s.klokkeslett, s.mottakere, s.barn], [true, '16:00', ['Ole Andre', 'Ingvild'], ['Andrea', 'Vendela']]);
  assert.throws(() => parseSettings({ klokkeslett: '25:00' }), /klokkeslett/);
  assert.throws(() => parseSettings({ barn: [] }), /barn/);
});

/** Telefonen på liksom: en tilstandsmaskin som svarer på tapp etter hvor det trykkes. */
function fakePhone({ start = 'pin', pinOk = true, openFails = [] } = {}) {
  const log = []; let state = start, child = 'Vendela', pinTyped = '', open = false, detail = null, scrolled = 0;
  const screen = () => state === 'pin' ? pinScreen : state === 'news' ? newsScreen : detail ? detailScreen(detail) : listScreen(child, { open, scrolled });
  const remote = {
    serial: fn => fn(), unlock: async () => { log.push('unlock'); }, home: async () => { log.push('home'); }, launch: async b => { log.push(`launch ${b}`); },
    swipe: async () => { scrolled += 300; log.push('swipe'); }, source: async () => screen(),
    tap: async (x, y) => {
      log.push(`tap ${x},${y}`);
      const nodes = flatten(screen());
      const hit = nodes.filter(n => n.type !== 'Application' && Math.abs(n.x - x) <= (n.node.rect.width / 2) && Math.abs(n.y - y) <= (n.node.rect.height / 2)).sort((a, b) => b.depth - a.depth)[0];
      if (!hit) return;
      if (state === 'pin') { if (hit.type === 'Key') { pinTyped += hit.label; if (pinTyped.length === 4) { if (pinOk) state = 'news'; pinTyped = ''; } } return; }
      if (hit.label === 'Meldinger' && hit.y > 300) { state = 'list'; return; }
      if (detail) { if (hit.label === 'Tilbake') detail = null; return; }
      if (/, (Utvid|Lukk)$/.test(hit.label)) { open = !open; return; }
      if (open && hit.type === 'Cell') { child = /^Andrea/.test(hit.label) ? 'Andrea' : 'Vendela'; open = false; scrolled = 0; return; }
      if (hit.type === 'Cell') { const m = MSG[child].find(mm => mm.tittel === textsOf(hit.node)[0]); if (m && !openFails.includes(m.tittel)) detail = m; }
    }
  };
  return { remote, log };
}
function world({ phone = fakePhone(), env = { IPHONE_REMOTE_URL: 'https://gw.test', IPHONE_REMOTE_USER: 'u', IPHONE_REMOTE_PASSWORD: 'p', VIGILO_PIN: '2580' }, phones = { 'Ole Andre': '+4711111111' } } = {}) {
  const store = new Map(), sent = [];
  const v = createVigilo({ env, remote: phone.remote, sleep: async () => {}, now: () => new Date('2026-11-05T14:31:00Z'),
    messaging: { channels: () => ({ sms: true }), sendSms: async (to, t) => sent.push({ to, t }) },
    residents: { all: async () => Object.fromEntries(Object.entries(phones).map(([n, telefon]) => [n, { telefon }])) },
    read: async ns => store.get(ns), update: async (ns, fn) => { const x = fn(structuredClone(store.get(ns) ?? null)); store.set(ns, x); return x; }, origin: () => 'https://huset.test' });
  return { v, store, sent, ...phone };
}

test('a full run: pin, Meldinger tab, both children, each new message opened and read, scroll for the lower ones, notify, log', async () => {
  const w = world();
  await w.v.saveSettings({ aktiv: true, mottakere: ['Ole Andre', 'Ingvild'], barn: ['Vendela', 'Andrea'] });
  const run = await w.v.run({ source: 'manuell' });
  assert.equal(run.status, 'ok', run.feil);
  assert.ok(w.log.includes(`launch ${VIGILO_BUNDLE}`)); assert.equal(w.log.at(-1), 'home');
  assert.equal(run.nye, 4); assert.equal(run.antall, 4);
  const msgs = await w.v.messages();
  assert.deepEqual(msgs.map(m => [m.barn, m.tittel, m.apnet]), [['Vendela', 'Uke 44', true], ['Vendela', 'Uke 43', true], ['Vendela', 'Uke 40', true], ['Andrea', 'Kantine uke 44', true]]);
  assert.equal(msgs[2].innhold, BODY['Uke 40'], 'cellen nederst ble rullet fram og åpnet');
  assert.equal(msgs[0].tidspunkt, '26. okt. 2026 - 08:00');
  assert.ok(w.log.includes('swipe'), 'rullet for den nederste');
  assert.deepEqual(run.varsler.map(x => [x.navn, x.status]), [['Ole Andre', 'sendt'], ['Ingvild', 'ikke sendt']]);
  assert.match(w.sent[0].t, /^Vigilo: 4 nye meldinger fra skolen\.\n• Vendela: Uke 44 \(Kari Kontaktlærer\) – God ettermiddag! Jeg legger ved ukas plan og oppskrift/);
  assert.ok(run.steg.some(s => /Gikk til «Meldinger»/.test(s.tekst)) && run.steg.some(s => /Vendela: 3 meldinger i listen, 3 nye/.test(s.tekst)));
  assert.ok(run.skjermer.some(s => s.navn === 'Vendela: Uke 44'), 'detaljskjermen logges');
  const again = await w.v.run({ source: 'manuell' });
  assert.deepEqual([again.nye, again.varsler.length, w.sent.length], [0, 0, 1], 'ingenting nytt andre gang');
});

test('a message that would not open is kept with its excerpt and opened next time; honest failures; daily tick', async () => {
  const p = fakePhone({ openFails: ['Uke 43'] });
  const w = world({ phone: p });
  await w.v.saveSettings({ aktiv: true, barn: ['Vendela'] });
  const r1 = await w.v.run();
  const u43 = (await w.v.messages()).find(m => m.tittel === 'Uke 43');
  assert.equal(u43.apnet, undefined); assert.equal(u43.utdrag, 'God ettermiddag. Ukeplan'); assert.equal(r1.nye, 3);
  assert.ok(r1.steg.some(s => /Fikk ikke åpnet «Uke 43»/.test(s.tekst)));
  const w2 = world({ phone: fakePhone({ start: 'news' }) });
  const noPin = world({ phone: fakePhone(), env: { IPHONE_REMOTE_URL: 'https://gw.test', IPHONE_REMOTE_USER: 'u', IPHONE_REMOTE_PASSWORD: 'p' } });
  const r = await noPin.v.run(); assert.equal(r.status, 'feil'); assert.match(r.feil, /VIGILO_PIN/); assert.equal(noPin.log.at(-1), 'home');
  assert.match((await world({ phone: fakePhone({ pinOk: false }) }).v.run()).feil, /ikke godtatt/);
  assert.match((await world({ phone: { remote: { ...fakePhone().remote, source: async () => el('Application', 'V', [el('SecureTextField', '')]) }, log: [] } }).v.run()).feil, /innloggingsskjermen/);
  await assert.rejects(world({ env: {} }).v.run(), /iphone-remote/);
  assert.equal(await w2.v.tick(), null, 'ikke aktiv');
  await w2.v.saveSettings({ aktiv: true, klokkeslett: '16:00', barn: ['Andrea'] });
  assert.equal(await w2.v.tick(), null, 'før klokkeslettet (15:31 norsk tid)');
  await w2.v.saveSettings({ aktiv: true, klokkeslett: '15:00', barn: ['Andrea'] });
  const t = await w2.v.tick(); assert.equal(t.status, 'ok', t.feil); assert.equal(t.kilde, 'daglig'); assert.equal(t.nye, 1);
  assert.equal(await w2.v.tick(), null, 'bare én gang per dag');
  assert.equal((await w2.v.settings()).sistKjort, '2026-11-05');
});
