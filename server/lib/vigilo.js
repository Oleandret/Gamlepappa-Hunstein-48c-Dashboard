// Vigilo (skolens foreldreapp) leses daglig fra iPhonen via gatewayen (WebDriverAgent): appen åpnes,
// pinkoden tastes (VIGILO_PIN på serveren), meldingslisten leses per barn, nye meldinger lagres og
// varsles på SMS til de som er valgt. Hver kjøring logger stegene og tekstene på skjermene den så,
// så leseren kan finjusteres mot appens faktiske skjermer uten å gjette.
import { createHash } from 'node:crypto';
import { getNamespace, updateNamespace } from './configStore.js';
import { phoneRemote as defaultRemote, phoneRemoteConfigured } from './phoneRemote.js';
import { messaging as defaultMessaging } from './messaging.js';
import { residents as defaultResidents } from './residents.js';
import { RESIDENTS } from '../routes/avvik.js';
import { osloToday, osloClock, isClock } from './osloTime.js';

export const VIGILO_BUNDLE = 'parent-ios.vigilo.no';
const SETTINGS = '_vigilo', MESSAGES = '_vigiloMeldinger', LOG = '_vigiloLogg';
export const DEFAULT_SETTINGS = { aktiv: false, klokkeslett: '15:30', mottakere: ['Ole Andre'], barn: ['Andrea', 'Vendela'], sistKjort: null };
const MAX_MESSAGES = 1000, MAX_LOG = 40, MAX_SCREEN_TEXTS = 120;
const list = v => Array.isArray(v) ? v : [];
const bad = message => Object.assign(new Error(message), { status: 400 });
const short = t => String(t || '').replace(/XCUIElementType/, '');

export function vigiloConfigured(env = process.env) { return phoneRemoteConfigured(env); }

/** Treet fra /api/source som flat liste med type, tekst og midtpunkt; barn beholdes for celler. */
export function flatten(node, depth = 0, out = []) {
  if (!node || typeof node !== 'object') return out;
  const rect = node.rect || {};
  out.push({ type: short(node.type), label: String(node.label || node.name || ''), value: node.value == null ? '' : String(node.value), depth,
    x: Number(rect.x) + Number(rect.width || 0) / 2, y: Number(rect.y) + Number(rect.height || 0) / 2, node });
  for (const c of node.children || []) flatten(c, depth + 1, out);
  return out;
}
/** Alle synlige tekster under et element, i rekkefølge, uten tomme og uten dubletter rett etter hverandre. */
export function textsOf(node) {
  const out = [];
  for (const n of flatten(node)) {
    const t = (n.type === 'StaticText' || n.type === 'TextView') ? (n.label || n.value).trim() : '';
    if (t && out.at(-1) !== t) out.push(t);
  }
  return out;
}
const find = (nodes, re, types = null) => nodes.find(n => (!types || types.includes(n.type)) && re.test(n.label) && Number.isFinite(n.x)) || null;

export function screenKind(nodes) {
  if (find(nodes, /tast pinkode/i)) return 'pin';
  if (nodes.some(n => n.type === 'SecureTextField') || find(nodes, /^(logg inn|login)$/i, ['Button'])) return 'innlogging';
  if (nodes.some(n => n.type === 'Cell')) return 'liste';
  return 'ukjent';
}

/** Meldingene på en listeskjerm: hver celle blir én melding med tekstlinjene sine. */
export function extractMessages(tree, barn, children = DEFAULT_SETTINGS.barn) {
  const out = [];
  const walk = node => {
    if (short(node?.type) === 'Cell') {
      const linjer = textsOf(node);
      if (linjer.length) {
        const text = linjer.join('\n');
        const named = children.find(c => new RegExp(`\\b${c.split(' ')[0]}\\b`, 'i').test(text));
        const b = barn || named || 'Ukjent';
        out.push({ id: createHash('sha1').update(`${b}\n${text}`).digest('hex').slice(0, 16), barn: b, linjer, tekst: text });
      }
      return;
    }
    for (const c of node?.children || []) walk(c);
  };
  walk(tree);
  return out;
}

/** SMS om nye meldinger: én linje per melding, kortet ned. */
export function vigiloSms(messages, origin = '') {
  const lines = messages.slice(0, 6).map(m => `• ${m.barn}: ${m.linjer.filter(l => l.length > 2).join(' – ').slice(0, 140)}`);
  return [`Vigilo: ${messages.length} ny${messages.length === 1 ? ' melding' : 'e meldinger'} fra skolen.`, ...lines, messages.length > 6 ? `… og ${messages.length - 6} til.` : '', origin ? `${origin}/vigilo` : ''].filter(Boolean).join('\n');
}

export function parseSettings(body, prev = DEFAULT_SETTINGS) {
  const klokkeslett = body?.klokkeslett ?? prev.klokkeslett;
  if (!isClock(klokkeslett)) throw bad('Ugyldig klokkeslett');
  const mottakere = [...new Set((Array.isArray(body?.mottakere) ? body.mottakere : prev.mottakere).filter(n => RESIDENTS.includes(n)))];
  const barn = [...new Set((Array.isArray(body?.barn) ? body.barn : prev.barn).map(v => String(v).trim().replace(/\s+/g, ' ')).filter(v => v && v.length <= 40))];
  if (!barn.length) throw bad('Skriv inn minst ett barn');
  return { ...prev, aktiv: body?.aktiv === true, klokkeslett, mottakere, barn };
}

export function createVigilo({ env = process.env, remote = defaultRemote, messaging = defaultMessaging, residents = defaultResidents, read = getNamespace, update = updateNamespace, now = () => new Date(), sleep = ms => new Promise(r => setTimeout(r, ms)), origin = () => process.env.AUTH_PUBLIC_ORIGIN || '' } = {}) {
  const settings = async () => ({ ...DEFAULT_SETTINGS, ...(await read(SETTINGS) || {}) });
  const saveSettings = async body => update(SETTINGS, prev => parseSettings(body, { ...DEFAULT_SETTINGS, ...(prev || {}) }));
  const messages = async (limit = 200) => list(await read(MESSAGES)).slice(0, limit);
  const log = async (limit = 10) => list(await read(LOG)).slice(0, limit);

  // Selve lesingen på telefonen. step(tekst) logger, record(navn, tre) tar vare på tekstene på skjermen.
  async function readPhone(s, step, record) {
    const tree = async () => { const t = await remote.source(); return { tree: t, nodes: flatten(t) }; };
    const tapNode = n => remote.tap(Math.round(n.x), Math.round(n.y));
    await remote.unlock().then(() => step('Låste opp telefonen'), () => step('Kunne ikke låse opp (fortsetter)'));
    await remote.launch(VIGILO_BUNDLE); step('Åpnet Vigilo');
    await sleep(4000);
    let cur = await tree(); record('start', cur.tree);
    if (screenKind(cur.nodes) === 'pin') {
      const pin = String(env.VIGILO_PIN || '');
      if (!/^\d{4,8}$/.test(pin)) throw new Error('Vigilo ber om pinkode. Sett VIGILO_PIN (4 siffer) på serveren.');
      for (const d of pin) { const key = find(cur.nodes, new RegExp(`^${d}$`), ['Key', 'Button']); if (!key) throw new Error(`Fant ikke tasten ${d} på pin-skjermen`); await tapNode(key); await sleep(250); }
      step('Tastet pinkoden');
      await sleep(3500);
      cur = await tree(); record('etter pin', cur.tree);
      if (screenKind(cur.nodes) === 'pin') throw new Error('Pinkoden ble ikke godtatt av Vigilo');
    }
    if (screenKind(cur.nodes) === 'innlogging') throw new Error('Vigilo viser innloggingsskjermen. Logg inn i appen på telefonen én gang, så husker den det.');
    // Til meldingene, hvis det finnes en knapp/fane for det.
    const nav = find(cur.nodes, /^(meldinger|beskjeder|innboks|messages)$/i, ['Button', 'Other', 'StaticText', 'Cell', 'Tab']) || find(cur.nodes, /meldinger|beskjeder|innboks/i, ['Button', 'Tab']);
    if (nav) { await tapNode(nav); step(`Gikk til «${nav.label}»`); await sleep(2500); cur = await tree(); record('meldinger', cur.tree); }
    else step('Fant ingen «Meldinger»-fane – leser skjermen som den er');
    // Ett barn om gangen når appen har en velger med barnas navn, ellers alt på én skjerm.
    const found = [];
    const switches = s.barn.map(b => [b, find(cur.nodes, new RegExp(`^${b.split(' ')[0]}\\b`, 'i'), ['Button', 'Other', 'StaticText', 'Cell', 'Tab'])]).filter(([, n]) => n);
    if (switches.length >= 2) {
      for (const [barn, n] of switches) {
        await tapNode(n); await sleep(2500);
        const t = await tree(); record(barn, t.tree);
        const m = extractMessages(t.tree, barn, s.barn); found.push(...m); step(`${barn}: ${m.length} meldinger på skjermen`);
      }
    } else {
      const m = extractMessages(cur.tree, null, s.barn); found.push(...m); step(`${m.length} meldinger på skjermen`);
    }
    return found;
  }

  async function notify(nye, s) {
    const out = [];
    if (!nye.length || !s.mottakere.length) return out;
    const all = await residents.all().catch(() => ({}));
    for (const navn of s.mottakere) {
      const telefon = all[navn]?.telefon;
      if (!messaging.channels().sms) { out.push({ navn, status: 'ikke sendt', feil: 'SMS er ikke satt opp på serveren' }); continue; }
      if (!telefon) { out.push({ navn, status: 'ikke sendt', feil: `Mangler mobilnummer for ${navn}` }); continue; }
      try { await messaging.sendSms(telefon, vigiloSms(nye, origin())); out.push({ navn, status: 'sendt' }); }
      catch (e) { out.push({ navn, status: 'feilet', feil: String(e.message || 'Ukjent feil').slice(0, 200) }); }
    }
    return out;
  }

  /** Én lesing: på telefonen (i køen), lagre nye meldinger, varsle, logg. */
  async function run({ source = 'daglig', onStep = () => {} } = {}) {
    if (!vigiloConfigured(env)) throw Object.assign(new Error('iphone-remote er ikke satt opp (IPHONE_REMOTE_URL/USER/PASSWORD)'), { status: 503 });
    const s = await settings(), steps = [], screens = [];
    const step = t => { steps.push({ at: now().toISOString(), tekst: t }); onStep(t); };
    const record = (navn, tree) => screens.push({ navn, tekster: textsOf(tree).slice(0, MAX_SCREEN_TEXTS) });
    const entry = { at: now().toISOString(), kilde: source, status: 'ok', nye: 0, antall: 0, varsler: [], steg: steps, skjermer: screens, feil: null };
    try {
      const found = await remote.serial(async () => { try { return await readPhone(s, step, record); } finally { await remote.home().catch(() => {}); } });
      const known = new Set(list(await read(MESSAGES)).map(m => m.id));
      const nye = found.filter(m => !known.has(m.id)).map(m => ({ ...m, funnet: now().toISOString() }));
      entry.antall = found.length; entry.nye = nye.length;
      if (nye.length) await update(MESSAGES, prev => [...nye, ...list(prev)].slice(0, MAX_MESSAGES));
      step(nye.length ? `${nye.length} nye meldinger lagret` : 'Ingen nye meldinger');
      entry.varsler = await notify(nye, s);
      for (const v of entry.varsler) step(`SMS til ${v.navn}: ${v.status}${v.feil ? ` (${v.feil})` : ''}`);
    } catch (e) {
      entry.status = 'feil'; entry.feil = String(e.message || 'Ukjent feil').slice(0, 300); step(`Stoppet: ${entry.feil}`);
    }
    await update(LOG, prev => [entry, ...list(prev)].slice(0, MAX_LOG));
    return entry;
  }

  // Hvert minutt: én gang per dag, ved eller etter klokkeslettet.
  async function tick() {
    const s = await settings(), t = now(), today = osloToday(t);
    if (!s.aktiv || s.sistKjort === today || osloClock(t) < s.klokkeslett) return null;
    await update(SETTINGS, prev => ({ ...DEFAULT_SETTINGS, ...(prev || {}), sistKjort: today }));
    return run({ source: 'daglig' });
  }
  return { configured: () => vigiloConfigured(env), pinSet: () => /^\d{4,8}$/.test(String(env.VIGILO_PIN || '')), settings, saveSettings, messages, log, run, tick };
}
export const vigilo = createVigilo();
