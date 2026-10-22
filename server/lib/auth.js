import { timingSafeEqual, createHash } from 'node:crypto';
import { googleAuth, OWNER_EMAIL } from './googleAuth.js';
import { residents } from './residents.js';
const digest = value => createHash('sha256').update(value).digest();
export function authConfigured(configured = process.env.AUTH_TOKENS_JSON) {
  try { const tokens = JSON.parse(configured); return tokens && !Array.isArray(tokens) && Object.entries(tokens).some(([role,value]) => ['viewer','operator','admin'].includes(role) && typeof value === 'string' && value.length >= 24); }
  catch { return false; }
}
export function authenticate(header, configured) {
  if (!authConfigured(configured)) return null;
  let tokens;
  try { tokens = JSON.parse(configured); } catch { return null; }
  const token = /^Bearer (.+)$/.exec(header || '')?.[1];
  if (!token || token.length > 512) return null;
  for (const [role, expected] of Object.entries(tokens)) {
    if (['viewer','operator','admin'].includes(role) && typeof expected === 'string' && expected.length >= 24 && timingSafeEqual(digest(token), digest(expected))) return role;
  }
  return null;
}
const attempts = new Map();
// Residents (own login) may only use Huset: avvik, gjøremål and husregler. Never contacts, heating or devices.
const RESIDENT_PATHS = /^\/(session|logout|avvik(\/.*)?|huset|huset\/(regler|gjoremal)(\/.*)?)$/;
export function accessControl(req, res, next, { residentSession = req => residents.session(req) } = {}) {
  // Explicit demo is isolated from real Homey/MCP/AI and needs no permanent credential.
  const demo = process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production';
  const session = !demo && req.headers.authorization === undefined ? googleAuth.session(req) : null;
  const role = demo ? 'admin' : session?.role || authenticate(req.headers.authorization, process.env.AUTH_TOKENS_JSON);
  // Egen, smal nøkkel som bare kan lese rombilder (brukes når 3D-modellen skal oppdateres etter bildene).
  // Gir kun GET på /room-photos — ingen enheter, kontakter, varme eller styring.
  if (!role && !demo && photoReader(req)) {
    if (!rateLimited(req, res)) return;
    req.user = { role: 'photo-reader', method: 'bearer' };
    return next();
  }
  // Egen, smal nøkkel for å lage ny 3D-modell: lese endringsønskene og merke dem som gjort.
  // Gir kun GET på /house3d/changes og PATCH på ett ønske — ingenting annet.
  if (!role && !demo && changesWorker(req)) {
    if (!rateLimited(req, res)) return;
    req.user = { role: 'model-worker', method: 'bearer' };
    return next();
  }
  if (!role && !demo && req.headers.authorization === undefined && (req.headers.cookie || '').includes(residents.cookieName)) {
    return residentSession(req).then(resident => {
      if (!resident) return res.status(401).json({ error: 'Innlogging kreves', code: 'AUTH_REQUIRED' });
      if (!RESIDENT_PATHS.test(req.path)) return res.status(403).json({ error: 'Beboerinnlogging gir bare tilgang til Huset' });
      if (!['GET','HEAD'].includes(req.method) && !(typeof req.headers['x-csrf-token'] === 'string' && req.headers['x-csrf-token'] === resident.csrfToken)) return res.status(403).json({ error: 'Last siden på nytt og prøv igjen', code: 'CSRF_REQUIRED' });
      if (!rateLimited(req, res)) return;
      req.user = { role: 'beboer', method: 'beboer', navn: resident.navn, csrfToken: resident.csrfToken };
      next();
    }, () => res.status(503).json({ error: 'Innloggingen kunne ikke kontrolleres' }));
  }
  if (!role) return res.status(401).json({ error: 'Innlogging kreves', code: 'AUTH_REQUIRED' });
  if (session && !['GET','HEAD'].includes(req.method) && !googleAuth.csrfValid(req, session)) return res.status(403).json({ error: 'Last siden på nytt og prøv igjen', code: 'CSRF_REQUIRED' });
  if (!rateLimited(req, res)) return;
  if (!['GET','HEAD'].includes(req.method) && !(req.method === 'POST' && req.path === '/logout')) {
    const required = /^\/(homey|chat)\//.test(req.path) || /^\/(avvik|huset)(\/|$)/.test(req.path) && !/^\/huset\/admin(\/|$)/.test(req.path) || /^\/experience\/scenes\/[^/]+\/(run|undo)$/.test(req.path) ? 'operator' : 'admin';
    if (role === 'viewer' || (required === 'admin' && role !== 'admin')) return res.status(403).json({error:'Mangler rettighet'});
  }
  req.user = { role, method: session ? 'google' : demo ? 'demo' : 'bearer', ...(session ? { csrfToken: session.csrfToken, email: session.email } : {}) };
  next();
}
const PHOTO_READ_PATHS = /^\/room-photos\/(index|rooms\/[a-zA-Z0-9_-]{1,64}|images\/[a-zA-Z0-9_-]{1,64})$/;
export function photoReader(req, configured = process.env.ROOM_PHOTO_READ_TOKEN) {
  if (typeof configured !== 'string' || configured.length < 32) return false;
  if (!['GET', 'HEAD'].includes(req.method) || !PHOTO_READ_PATHS.test(req.path)) return false;
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
  return Boolean(token && token.length <= 512 && timingSafeEqual(digest(token), digest(configured)));
}
const CHANGES_READ_PATH = /^\/house3d\/changes$/;
const CHANGES_PATCH_PATH = /^\/house3d\/changes\/[a-zA-Z0-9-]{1,64}$/;
export function changesWorker(req, configured = process.env.HOUSE3D_CHANGES_TOKEN) {
  if (typeof configured !== 'string' || configured.length < 32) return false;
  const allowed = (['GET', 'HEAD'].includes(req.method) && CHANGES_READ_PATH.test(req.path)) || (req.method === 'PATCH' && CHANGES_PATCH_PATH.test(req.path));
  if (!allowed) return false;
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
  return Boolean(token && token.length <= 512 && timingSafeEqual(digest(token), digest(configured)));
}
function rateLimited(req, res) {
  const now = Date.now();
  for (const [key,v] of attempts) if (now - v.ts > 60_000) attempts.delete(key);
  const key = req.ip;
  const limit = req.path.startsWith('/chat') ? 12 : 180;
  const bucketKey = key + (req.path.startsWith('/chat') ? ':chat' : ':api');
  const bucket = attempts.get(bucketKey) || { ts: now, count: 0 };
  if (attempts.size > 10000 || ++bucket.count > limit) { res.status(429).json({error:'For mange forespørsler'}); return false; }
  attempts.set(bucketKey,bucket);
  return true;
}
// Contacts, reminders and heat pump control: only the owner's own Google login (or isolated demo).
export function isOwner(req) {
  return (req.user?.method === 'google' && req.user.email === OWNER_EMAIL) || req.user?.method === 'demo';
}

