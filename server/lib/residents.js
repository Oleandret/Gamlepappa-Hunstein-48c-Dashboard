// Beboerne i huset: kontaktinfo (e-post/telefon) som eieren legger inn, og egen
// innlogging med e-post eller telefon + passord. En beboer kan bare lage passord
// for en adresse eieren allerede har registrert på dem, og må bekrefte med en
// engangskode (e-post/SMS) eller en invitasjonslenke fra eieren.
// Beboere får bare tilgang til Huset (avvik, gjøremål, husregler).
import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { getNamespace, updateNamespace } from './configStore.js';
import { messaging as defaultMessaging } from './messaging.js';
import { RESIDENTS } from '../routes/avvik.js';

const scrypt = promisify(scryptCb);
const NS = '_beboere', SESSIONS = '_beboerSesjoner';
const COOKIE = '__Host-huset-session';
const SESSION_TTL = 30 * 86400000, CODE_TTL = 15 * 60000, INVITE_TTL = 7 * 86400000;
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
const sha = v => createHash('sha256').update(v).digest('base64url');
const token = () => randomBytes(32).toString('base64url');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export function normalizeEmail(v) {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(e) ? e : null;
}
export function normalizePhone(v) {
  let p = typeof v === 'string' ? v.replace(/[\s().-]/g, '') : '';
  if (/^00\d+$/.test(p)) p = `+${p.slice(2)}`;
  if (/^\d{8}$/.test(p)) p = `+47${p}`;
  return /^\+\d{8,15}$/.test(p) ? p : null;
}
export async function hashPassword(password, salt = randomBytes(16).toString('base64url')) {
  return { salt, hash: (await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })).toString('base64url') };
}
async function passwordMatches(password, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  const { hash } = await hashPassword(password, stored.salt);
  return timingSafeEqual(Buffer.from(hash), Buffer.from(stored.hash));
}
export function validPassword(p) {
  if (typeof p !== 'string' || p.length < 10) throw fail('Passordet må ha minst 10 tegn');
  if (p.length > 200) throw fail('Passordet er for langt');
  return p;
}
// Public view: never the password hash, invite token or codes.
export const publicResident = (navn, r = {}) => ({ navn, epost: r.epost || '', telefon: r.telefon || '', epostVarsel: r.epostVarsel === true, smsVarsel: r.smsVarsel === true, harPassord: Boolean(r.passord), invitasjonAktiv: Boolean(r.invitasjon && r.invitasjon.expires > Date.now()) });

export function createResidents({ store = { read: () => getNamespace(NS), update: fn => updateNamespace(NS, fn) }, sessionStore = { read: () => getNamespace(SESSIONS), update: fn => updateNamespace(SESSIONS, fn) }, messaging = defaultMessaging, now = Date.now, publicOrigin = () => process.env.AUTH_PUBLIC_ORIGIN || '' } = {}) {
  const codes = new Map(), attempts = new Map();
  let sessions = null;
  const all = async () => ({ ...(await store.read() || {}) });

  async function findByIdentifier(raw) {
    const email = normalizeEmail(raw), phone = email ? null : normalizePhone(raw);
    if (!email && !phone) return null;
    const list = await all();
    const navn = RESIDENTS.find(n => email ? list[n]?.epost === email : list[n]?.telefon === phone);
    return navn ? { navn, record: list[navn], kanal: email ? 'epost' : 'sms', adresse: email || phone } : null;
  }
  function limit(key, max, windowMs) {
    const t = now();
    for (const [k, v] of attempts) if (v.until < t) attempts.delete(k);
    const a = attempts.get(key) || { n: 0, until: t + windowMs };
    if (++a.n > max) throw fail('For mange forsøk. Vent litt og prøv igjen.', 429);
    attempts.set(key, a);
  }

  async function loadSessions() {
    if (!sessions) sessions = new Map(Object.entries(await sessionStore.read() || {}));
    for (const [k, s] of sessions) if (s.expires <= now()) sessions.delete(k);
    return sessions;
  }
  const persistSessions = () => sessionStore.update(() => Object.fromEntries(sessions));
  async function startSession(res, navn) {
    await loadSessions();
    const id = token();
    sessions.set(sha(id), { navn, csrfToken: token(), expires: now() + SESSION_TTL });
    await persistSessions();
    res.cookie(COOKIE, id, { ...cookieOptions, maxAge: SESSION_TTL });
  }
  const cookieValue = req => { const v = (req.headers.cookie || '').split(';').map(s => s.trim()).filter(s => s.startsWith(`${COOKIE}=`)); return v.length === 1 ? v[0].slice(COOKIE.length + 1) : ''; };
  async function session(req) {
    const id = cookieValue(req);
    if (!id) return null;
    const s = (await loadSessions()).get(sha(id));
    return s && RESIDENTS.includes(s.navn) ? s : null;
  }
  async function endSessions(navn, keep = null) {
    await loadSessions();
    for (const [k, s] of sessions) if (s.navn === navn && k !== keep) sessions.delete(k);
    await persistSessions();
  }
  async function setPassword(navn, password) {
    const passord = await hashPassword(validPassword(password));
    await store.update(prev => ({ ...(prev || {}), [navn]: { ...(prev?.[navn] || {}), passord, passordSatt: new Date(now()).toISOString(), invitasjon: null } }));
    await endSessions(navn);
  }

  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const handle = fn => async (req, res) => {
    try { limit(`ip:${req.ip}`, 40, 15 * 60000); await fn(req, res); }
    catch (e) { res.status([400, 401, 404, 429].includes(e.status) ? e.status : 503).json({ error: [400, 401, 404, 429].includes(e.status) ? e.message : 'Noe gikk galt. Prøv igjen.' }); }
  };

  router.post('/logginn', handle(async (req, res) => {
    const id = String(req.body?.identifikator || '').slice(0, 200);
    limit(`konto:${normalizeEmail(id) || normalizePhone(id) || id}`, 8, 15 * 60000);
    const found = await findByIdentifier(id);
    const ok = found ? typeof req.body?.passord === 'string' && await passwordMatches(req.body.passord, found.record?.passord) : (await hashPassword('x'.repeat(10), 'utjevner'), false); // same cost either way
    if (!ok) throw fail('Feil e-post/telefon eller passord', 401);
    await startSession(res, found.navn);
    res.json({ ok: true, navn: found.navn });
  }));

  // Same answer whether or not the address is registered, so nobody can probe who lives here.
  router.post('/kode', handle(async (req, res) => {
    const id = String(req.body?.identifikator || '').slice(0, 200);
    limit(`kode:${id}`, 3, 15 * 60000);
    const found = await findByIdentifier(id);
    const channels = messaging.channels();
    if (found && channels[found.kanal]) {
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      codes.set(found.adresse, { navn: found.navn, hash: sha(code), expires: now() + CODE_TTL, tries: 0 });
      const text = `Koden din for Huset (Hunstein 48c) er ${code}. Den gjelder i 15 minutter.`;
      try { found.kanal === 'epost' ? await messaging.sendEmail(found.adresse, 'Kode for innlogging i Huset', text) : await messaging.sendSms(found.adresse, text); }
      catch { console.warn('[beboer] kode kunne ikke sendes'); }
    }
    res.json({ ok: true, melding: 'Hvis adressen er registrert på en beboer, er en kode sendt. Spør Ole Andre om en invitasjonslenke hvis ingenting kommer.' });
  }));

  router.post('/passord', handle(async (req, res) => {
    const email = normalizeEmail(req.body?.identifikator), adresse = email || normalizePhone(req.body?.identifikator);
    const c = adresse && codes.get(adresse);
    if (!c || c.expires <= now() || ++c.tries > 5 || sha(String(req.body?.kode || '').trim()) !== c.hash) throw fail('Koden er feil eller utløpt', 401);
    validPassword(req.body?.passord);
    codes.delete(adresse);
    await setPassword(c.navn, req.body.passord);
    await startSession(res, c.navn);
    res.json({ ok: true, navn: c.navn });
  }));

  async function inviteFor(raw) {
    const h = typeof raw === 'string' && raw.length < 100 ? sha(raw) : null;
    const list = await all();
    const navn = h && RESIDENTS.find(n => list[n]?.invitasjon?.hash === h && list[n].invitasjon.expires > now());
    if (!navn) throw fail('Invitasjonen er ugyldig eller utløpt', 404);
    return navn;
  }
  router.post('/invitasjon/sjekk', handle(async (req, res) => res.json({ navn: await inviteFor(req.body?.token) })));
  router.post('/invitasjon', handle(async (req, res) => {
    const navn = await inviteFor(req.body?.token);
    await setPassword(navn, req.body?.passord);
    await startSession(res, navn);
    res.json({ ok: true, navn });
  }));

  async function logout(req, res) {
    const id = cookieValue(req);
    if (id) { await loadSessions(); sessions.delete(sha(id)); await persistSessions(); }
    res.clearCookie(COOKIE, cookieOptions);
  }

  /** Beboeren som har denne e-posten registrert (brukes av Google-innloggingen), ellers null. */
  async function byEmail(raw) {
    const email = normalizeEmail(raw);
    if (!email) return null;
    const l = await all();
    return RESIDENTS.find(n => l[n]?.epost === email) || null;
  }

  // Owner tools.
  async function list() { const l = await all(); return RESIDENTS.map(n => publicResident(n, l[n])); }
  async function updateContact(navn, body) {
    if (!RESIDENTS.includes(navn)) throw fail('Ukjent beboer', 404);
    const epost = body?.epost ? normalizeEmail(body.epost) : '', telefon = body?.telefon ? normalizePhone(body.telefon) : '';
    if (epost === null) throw fail('Ugyldig e-postadresse');
    if (telefon === null) throw fail('Ugyldig telefonnummer. Bruk 8 siffer eller +landskode.');
    const l = await all();
    for (const n of RESIDENTS) if (n !== navn && ((epost && l[n]?.epost === epost) || (telefon && l[n]?.telefon === telefon))) throw fail(`Adressen er allerede registrert på ${n}`);
    await store.update(prev => ({ ...(prev || {}), [navn]: { ...(prev?.[navn] || {}), epost, telefon, epostVarsel: body?.epostVarsel === true && Boolean(epost), smsVarsel: body?.smsVarsel === true && Boolean(telefon) } }));
    return list();
  }
  async function createInvite(navn) {
    if (!RESIDENTS.includes(navn)) throw fail('Ukjent beboer', 404);
    const t = token();
    await store.update(prev => ({ ...(prev || {}), [navn]: { ...(prev?.[navn] || {}), invitasjon: { hash: sha(t), expires: now() + INVITE_TTL } } }));
    return { lenke: `${publicOrigin()}/huset?invitasjon=${t}`, utloper: new Date(now() + INVITE_TTL).toISOString() };
  }
  async function removePassword(navn) {
    if (!RESIDENTS.includes(navn)) throw fail('Ukjent beboer', 404);
    await store.update(prev => ({ ...(prev || {}), [navn]: { ...(prev?.[navn] || {}), passord: null, passordSatt: null, invitasjon: null } }));
    await endSessions(navn);
    return list();
  }
  return { router, session, logout, list, all, byEmail, updateContact, createInvite, removePassword, cookieName: COOKIE };
}
export const residents = createResidents();
