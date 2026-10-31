import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getNamespace, updateNamespace } from '../lib/configStore.js';
import { residents as defaultResidents } from '../lib/residents.js';
import { messaging as defaultMessaging } from '../lib/messaging.js';
import { isOwner } from '../lib/auth.js';
import { RESIDENTS } from './avvik.js';

// Skryt: beboerne gir hverandre skryt for trivsel, og hvert skryt gir poeng. Den som har flest
// poeng når måneden er omme, vinner premien eieren har satt. Lagres atomisk i config-storen.
export const POINTS = [[1, 'Skryt'], [2, 'Stort skryt'], [3, 'Kjempeskryt']];
const NS = '_skryt', PRIZE = '_skrytPremie';
const MAX_ITEMS = 5000, MAX_TEXT = 300, MAX_PRIZE = 200;
const list = v => Array.isArray(v) ? v : [];
const text = v => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
const bad = message => Object.assign(new Error(message), { status: 400 });
/** Måneden (YYYY-MM, norsk tid) et tidspunkt hører til. */
export const monthOf = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit' }).format(new Date(iso)).slice(0, 7);
export const previousMonth = month => { const [y, m] = month.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };

export function parseSkryt(body, now = new Date()) {
  const til = text(body?.til), fra = text(body?.fra), tekst = text(body?.tekst);
  const poeng = Number(body?.poeng ?? 1);
  if (!RESIDENTS.includes(til)) throw bad('Velg hvem som får skryt');
  if (!RESIDENTS.includes(fra)) throw bad('Velg hvem som gir skryt');
  if (til === fra) throw bad('Skryt til deg selv teller ikke – gi det til en annen');
  if (!tekst) throw bad('Skriv hva skrytet gjelder');
  if (tekst.length > MAX_TEXT) throw bad(`Skrytet kan være maks ${MAX_TEXT} tegn`);
  if (!POINTS.some(([p]) => p === poeng)) throw bad('Ugyldig antall poeng');
  return { id: randomUUID(), til, fra, tekst, poeng, opprettet: now.toISOString(), sms: body?.sendSms !== false };
}

/** Poengtavle for én måned (eller alle, month = null): [{ navn, poeng, antall }] sortert synkende, alle beboere med. */
export function leaderboard(items, month = null) {
  const rows = RESIDENTS.map(navn => ({ navn, poeng: 0, antall: 0, gitt: 0 }));
  for (const s of list(items)) {
    if (month && monthOf(s.opprettet) !== month) continue;
    const r = rows.find(x => x.navn === s.til); if (r) { r.poeng += s.poeng; r.antall += 1; }
    const g = rows.find(x => x.navn === s.fra); if (g) g.gitt += 1;
  }
  return rows.sort((a, b) => b.poeng - a.poeng || b.antall - a.antall || a.navn.localeCompare(b.navn, 'nb'));
}
/** Vinneren(e) av en måned: flest poeng; null når ingen fikk skryt. */
export function winners(items, month) {
  const rows = leaderboard(items, month).filter(r => r.poeng > 0);
  return rows.length ? rows.filter(r => r.poeng === rows[0].poeng).map(r => r.navn) : null;
}

/** SMS til den som får skryt, med stillingen denne måneden. */
export function skrytSms(item, poengNaa, origin = '') {
  return [`Hei ${item.til.split(' ')[0]}! ${item.fra} gir deg ${POINTS.find(([p]) => p === item.poeng)?.[1].toLowerCase() || 'skryt'} (${item.poeng} poeng): «${item.tekst}»`, `Du har nå ${poengNaa} poeng i Trivsel denne måneden. Fortsett sånn!`, origin ? `${origin}/skryt` : ''].filter(Boolean).join('\n');
}
export async function notifySkryt(item, poengNaa, { residents = defaultResidents, messaging = defaultMessaging, clock = () => new Date(), origin = () => process.env.AUTH_PUBLIC_ORIGIN || '' } = {}) {
  const at = () => clock().toISOString();
  if (item.sms === false) return { kanal: 'sms', status: 'valgt_bort', at: at() };
  if (!messaging.channels().sms) return { kanal: 'sms', status: 'ikke_satt_opp', at: at() };
  const telefon = (await residents.all())[item.til]?.telefon;
  if (!telefon) return { kanal: 'sms', status: 'mangler_telefon', at: at() };
  try { await messaging.sendSms(telefon, skrytSms(item, poengNaa, origin())); return { kanal: 'sms', status: 'sendt', at: at() }; }
  catch (e) { return { kanal: 'sms', status: 'feilet', feil: String(e.message || 'ukjent feil').slice(0, 200), at: at() }; }
}

export const skrytStore = { read: () => getNamespace(NS), update: fn => updateNamespace(NS, fn) };
export const prizeStore = { read: () => getNamespace(PRIZE), update: fn => updateNamespace(PRIZE, fn) };

export function createSkrytRoutes({ store = skrytStore, prize = prizeStore, clock = () => new Date(), notify = (item, poeng) => notifySkryt(item, poeng, { clock }), owner = isOwner } = {}) {
  const r = Router();
  const handle = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (e) { res.status([400, 403, 404].includes(e.status) ? e.status : 503).json({ error: [400, 403, 404].includes(e.status) ? e.message : 'Kunne ikke lagre. Prøv igjen.' }); }
  };
  async function payload(items) {
    const month = monthOf(clock().toISOString()), prev = previousMonth(month);
    const all = list(items);
    return { items: all.slice(0, 200), residents: RESIDENTS, points: POINTS, month, leaderboard: leaderboard(all, month), total: leaderboard(all),
      forrige: { month: prev, leaderboard: leaderboard(all, prev), vinnere: winners(all, prev) }, premie: (await prize.read())?.tekst || '' };
  }
  r.get('/', handle(async (_req, res) => res.json(await payload(await store.read()))));

  r.post('/', handle(async (req, res) => {
    // En innlogget beboer gir alltid skryt i eget navn.
    const item = parseSkryt(req.user?.role === 'beboer' ? { ...req.body, fra: req.user.navn } : req.body, clock());
    const varsling = { kanal: 'sms', status: item.sms ? 'sender' : 'valgt_bort', at: clock().toISOString() };
    const items = await store.update(prev => { if (list(prev).length >= MAX_ITEMS) throw bad('Listen er full'); return [{ ...item, varsel: varsling }, ...list(prev)]; });
    const poengNaa = leaderboard(items, monthOf(item.opprettet)).find(x => x.navn === item.til)?.poeng || 0;
    Promise.resolve().then(() => item.sms && notify(item, poengNaa)).then(varsel => {
      if (varsel) console.info(`[skryt] sms til ${item.til}: ${varsel.status}${varsel.feil ? ` (${varsel.feil})` : ''}`);
      return varsel && store.update(prev => list(prev).map(s => s.id === item.id ? { ...s, varsel } : s));
    }).catch(() => {});
    res.status(201).json({ item: { ...item, varsel: varsling }, ...(await payload(items)) });
  }));

  // Premien settes av eieren.
  r.put('/premie', handle(async (req, res) => {
    if (!owner(req)) throw Object.assign(new Error('Bare eieren kan sette premien'), { status: 403 });
    const tekst = text(req.body?.tekst);
    if (tekst.length > MAX_PRIZE) throw bad(`Premien kan være maks ${MAX_PRIZE} tegn`);
    await prize.update(() => ({ tekst, satt: clock().toISOString() }));
    res.json(await payload(await store.read()));
  }));

  // Den som ga skrytet (eller eieren) kan angre det.
  r.delete('/:id', handle(async (req, res) => {
    let found = null;
    const items = await store.update(prev => list(prev).filter(s => { if (s.id !== req.params.id) return true; found = s; return false; }));
    if (!found) throw Object.assign(new Error('Skrytet finnes ikke'), { status: 404 });
    if (req.user?.role === 'beboer' && found.fra !== req.user.navn) { await store.update(prev => [found, ...list(prev)]); throw Object.assign(new Error('Bare den som ga skrytet kan slette det'), { status: 403 }); }
    res.json(await payload(items));
  }));
  return r;
}
export const skrytRoutes = createSkrytRoutes();
