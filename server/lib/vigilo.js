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

// Slik Vigilo (foreldreappen) ser ut, lest 2026-10-31: øverst en barnevelger («<barnets navn>, Utvid»
// → utvidet viser «…, Lukk» og de andre barna som celler), så meldingscellene med tekstene tittel, avsender,
// « - utdrag» og dato (uleste celler heter «Uleste»), nederst fanene Nyheter/Meldinger/Fravær. En åpnet melding
// har «Tilbake» øverst, «Tittel: …», avsender, hele teksten og «28. okt. 2026 - 15:58».
const DATE_RE = /^\d{1,2}\.\s*[a-zæøå]+\.?(\s+\d{4})?$/i;
const DATETIME_RE = /^\d{1,2}\.\s*[a-zæøå]+\.?\s+\d{4}\s*-\s*\d{2}:\d{2}$/i;
const CHROME = /^(unngå sensitiv informasjon|send|legg til vedlegg|tilbake|meldinger|opprett)$/i;
const firstName = navn => String(navn || '').split(' ')[0];
export const isChildCell = n => n.type === 'Cell' && /, (Utvid|Lukk)$/.test(n.label);
export const childSelector = nodes => nodes.find(isChildCell) || null;
export const childOption = (nodes, barn) => nodes.find(n => n.type === 'Cell' && !/, (Utvid|Lukk)$/.test(n.label) && new RegExp(`^${firstName(barn)}\\b`, 'i').test(n.label)) || null;
export const backButton = nodes => find(nodes, /^(tilbake|back)$/i, ['Button']);
export const messagesTab = nodes => nodes.filter(n => /^meldinger$/i.test(n.label) && ['Other', 'Button', 'Tab'].includes(n.type) && n.y > 300).sort((a, b) => b.y - a.y)[0] || null;
/** På meldingslisten: barnevelgeren øverst og «Meldinger» som tittel (velgeren finnes også under Nyheter og Fravær). */
export const onMessageList = nodes => Boolean(childSelector(nodes)) && nodes.some(n => /^meldinger$/i.test(n.label) && n.y < 120);
const hasMessageCells = nodes => nodes.some(n => n.type === 'Cell' && !isChildCell(n));

/** Én meldingscelle fra listen: tittel, avsender, utdrag og dato; id fra barn + tittel + avsender + dato. */
export function parseMessageCell(cell, barn) {
  const texts = textsOf(cell.node || cell);
  if (!texts.length) return null;
  const dato = texts.find(t => DATE_RE.test(t)) || '';
  const rest = texts.filter(t => t !== dato);
  const tittel = rest[0] || '', avsender = rest[1] || '';
  const utdrag = rest.slice(2).map(t => t.replace(/^\s*-\s*/, '')).join(' ').trim();
  const b = barn || 'Ukjent';
  return { id: createHash('sha1').update(`${b}\n${tittel}\n${avsender}\n${dato}`).digest('hex').slice(0, 16), barn: b, tittel, avsender, dato, utdrag, ulest: /^uleste?$/i.test(cell.label || ''), x: cell.x, y: cell.y };
}
/** Meldingene på listeskjermen (barnevelgeren er ikke en melding). */
export function extractMessages(tree, barn) {
  return flatten(tree).filter(n => n.type === 'Cell' && !isChildCell(n) && Number.isFinite(n.y)).map(c => parseMessageCell(c, barn)).filter(m => m && m.tittel);
}
/** En åpnet melding: hele teksten (den lengste teksten som ikke er tittel/avsender/dato/appens egne ord) og tidspunktet. */
export function parseMessageDetail(tree) {
  const texts = textsOf(tree);
  const tittel = (texts.find(t => /^tittel:/i.test(t)) || '').replace(/^tittel:\s*/i, '');
  const tidspunkt = texts.find(t => DATETIME_RE.test(t)) || '';
  const body = texts.filter(t => t !== tidspunkt && !/^tittel:/i.test(t) && !CHROME.test(t) && !DATE_RE.test(t)).sort((a, b) => b.length - a.length);
  return { tittel, tidspunkt, innhold: (body[0] || '').trim() };
}

/** SMS om nye meldinger: én linje per melding, kortet ned. */
export function vigiloSms(messages, origin = '') {
  const lines = messages.slice(0, 6).map(m => `• ${m.barn}: ${m.tittel}${m.avsender ? ` (${m.avsender})` : ''}${m.innhold || m.utdrag ? ` – ${(m.innhold || m.utdrag).replace(/\s+/g, ' ').slice(0, 120)}` : ''}`);
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
  // known: id-er som alt er lest, så bare nye meldinger åpnes.
  const MAX_OPEN = 8;
  async function readPhone(s, step, record, known) {
    const tree = async () => { const t = await remote.source(); return { tree: t, nodes: flatten(t) }; };
    const tapNode = n => remote.tap(Math.round(n.x), Math.round(n.y));
    await remote.unlock().then(() => step('Låste opp telefonen'), () => step('Kunne ikke låse opp (fortsetter)'));
    await remote.launch(VIGILO_BUNDLE); step('Åpnet Vigilo');
    await sleep(4000);
    let cur = await tree(); record('start', cur.tree);
    // Fram til meldingslisten: pinkode, lukk en åpen melding (Tilbake), og fanen «Meldinger» om nødvendig.
    for (let i = 0; i < 6 && !onMessageList(cur.nodes); i++) {
      const kind = screenKind(cur.nodes);
      if (kind === 'pin') {
        const pin = String(env.VIGILO_PIN || '');
        if (!/^\d{4,8}$/.test(pin)) throw new Error('Vigilo ber om pinkode. Sett VIGILO_PIN (4 siffer) på serveren.');
        for (const d of pin) { const key = find(cur.nodes, new RegExp(`^${d}$`), ['Key', 'Button']); if (!key) throw new Error(`Fant ikke tasten ${d} på pin-skjermen`); await tapNode(key); await sleep(250); }
        step('Tastet pinkoden'); await sleep(3500);
        cur = await tree(); record('etter pin', cur.tree);
        if (screenKind(cur.nodes) === 'pin') throw new Error('Pinkoden ble ikke godtatt av Vigilo');
        continue;
      }
      if (kind === 'innlogging') throw new Error('Vigilo viser innloggingsskjermen. Logg inn i appen på telefonen én gang, så husker den det.');
      const back = backButton(cur.nodes), tab = messagesTab(cur.nodes);
      if (back && !childSelector(cur.nodes)) { await tapNode(back); step('Lukket en åpen melding'); }
      else if (tab) { await tapNode(tab); step('Gikk til «Meldinger»'); }
      else throw new Error('Fant ikke meldingslisten i Vigilo (ingen barnevelger, «Tilbake» eller «Meldinger»-fane)');
      await sleep(2500); cur = await tree(); record('på vei til meldinger', cur.tree);
    }
    if (!onMessageList(cur.nodes)) throw new Error('Fant ikke meldingslisten i Vigilo');
    // Listen laster litt etter at skjermen vises.
    for (let i = 0; i < 4 && !hasMessageCells(cur.nodes); i++) { await sleep(2000); cur = await tree(); }
    const found = [];
    for (const barn of s.barn) {
      // Velg barnet i velgeren øverst, hvis det ikke alt er valgt.
      let sel = childSelector(cur.nodes);
      if (!new RegExp(`^${firstName(barn)}\\b`, 'i').test(sel.label)) {
        await tapNode(sel); await sleep(2000); cur = await tree();
        const opt = childOption(cur.nodes, barn);
        if (!opt) { step(`Fant ikke ${barn} i barnevelgeren – hopper over`); const close = childSelector(cur.nodes); if (close) { await tapNode(close); await sleep(1500); cur = await tree(); } continue; }
        await tapNode(opt); await sleep(2500); cur = await tree();
        for (let i = 0; i < 6 && !hasMessageCells(cur.nodes); i++) { await sleep(2000); cur = await tree(); }   // listen laster
        sel = childSelector(cur.nodes);
        if (!sel || !new RegExp(`^${firstName(barn)}\\b`, 'i').test(sel.label)) { step(`Klarte ikke å bytte til ${barn}`); continue; }
      }
      record(barn, cur.tree);
      const list = extractMessages(cur.tree, barn);
      const fresh = list.filter(m => !known.has(m.id) || !known.get(m.id).apnet);
      step(`${barn}: ${list.length} meldinger i listen, ${fresh.length} nye`);
      // Åpne hver ny melding, les hele teksten, og gå tilbake til listen.
      let opened = 0;
      for (const m of fresh) {
        if (opened >= MAX_OPEN) { step(`Åpner maks ${MAX_OPEN} per kjøring; resten neste gang`); break; }
        let here = extractMessages(cur.tree, barn).find(x => x.id === m.id);
        // Celler nederst (bak fanelinjen) eller utenfor skjermen: rull listen opp til cellen er godt synlig.
        for (let i = 0; i < 4 && here && here.y > 620; i++) { await remote.swipe(188, 560, 188, 200, 0.4); await sleep(1500); cur = await tree(); here = extractMessages(cur.tree, barn).find(x => x.id === m.id); }
        if (!here || here.y > 700 || here.y < 150) { step(`«${m.tittel}» er ikke synlig i listen – tas neste gang`); continue; }
        await remote.tap(Math.round(here.x), Math.round(here.y)); await sleep(2500);
        let d = await tree();
        if (backButton(d.nodes) && !childSelector(d.nodes)) {
          const detail = parseMessageDetail(d.tree);
          record(`${barn}: ${m.tittel}`, d.tree);
          Object.assign(m, { innhold: detail.innhold, tidspunkt: detail.tidspunkt, apnet: true });
          opened++;
          await tapNode(backButton(d.nodes)); await sleep(2000); cur = await tree();
          if (!childSelector(cur.nodes)) { const b = backButton(cur.nodes); if (b) { await tapNode(b); await sleep(2000); cur = await tree(); } }
          if (!childSelector(cur.nodes)) throw new Error(`Kom ikke tilbake til listen etter «${m.tittel}»`);
        } else { step(`Fikk ikke åpnet «${m.tittel}»`); cur = d; }
      }
      found.push(...list.map(({ x, y, ...m }) => m));
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
      const known = new Map(list(await read(MESSAGES)).map(m => [m.id, m]));
      const found = await remote.serial(async () => { try { return await readPhone(s, step, record, known); } finally { await remote.home().catch(() => {}); } });
      const nye = found.filter(m => !known.has(m.id)).map(m => ({ ...m, funnet: now().toISOString() }));
      // Meldinger som ikke lot seg åpne sist, men ble åpnet nå: fyll inn innholdet.
      const fylt = found.filter(m => known.has(m.id) && !known.get(m.id).apnet && m.apnet);
      entry.antall = found.length; entry.nye = nye.length;
      if (nye.length || fylt.length) await update(MESSAGES, prev => [...nye, ...list(prev).map(p => { const f = fylt.find(x => x.id === p.id); return f ? { ...p, ...f, funnet: p.funnet } : p; })].slice(0, MAX_MESSAGES));
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
