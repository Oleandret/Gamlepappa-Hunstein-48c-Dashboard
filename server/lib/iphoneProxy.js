import { Router } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';

/**
 * Iphone-fanen: iphone-remote (eget Railway-prosjekt) vises under /iphone/ på
 * dashboardets eget domene, ferdig innlogget.
 *
 *  - Serveren logger inn hos iphone-remote med IPHONE_REMOTE_USER/PASSWORD og
 *    holder øktcookien selv. Passordet og cookien når aldri nettleseren.
 *  - Nettleseren får bare en kortlivet, signert billett (HttpOnly-cookie med
 *    Path=/iphone) fra POST /api/iphone/session, som krever administrator i
 *    dashboardet. Uten gyldig billett svarer /iphone/ 401.
 *  - Siden til iphone-remote bruker absolutte stier (/api/…, /login); de
 *    skrives om til /iphone/… så de ikke treffer dashboardets eget /api.
 */
const TICKET_COOKIE = 'gp_iphone';
const TICKET_TTL_MS = 12 * 3600_000;
const SECRET = randomBytes(32);
const sign = exp => createHmac('sha256', SECRET).update(String(exp)).digest('base64url');

export function iphoneConfigured(env = process.env) {
  try { return Boolean(env.IPHONE_REMOTE_USER && env.IPHONE_REMOTE_PASSWORD && new URL(env.IPHONE_REMOTE_URL).protocol === 'https:'); }
  catch { return false; }
}

export function makeTicket(now = Date.now()) { const exp = now + TICKET_TTL_MS; return `${exp}.${sign(exp)}`; }
export function validTicket(value, now = Date.now()) {
  const [exp, sig] = String(value || '').split('.');
  if (!/^\d{13}$/.test(exp || '') || !sig || Number(exp) <= now) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}
const readCookie = (req, name) => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1);

/** Absolutte stier i iphone-remote-siden → /iphone/…, så de går via mellomtjeneren. */
export function rewriteHtml(html) {
  return html.replace(/(["'`])\/(api\/|login\b|logout\b)/g, '$1/iphone/$2');
}

// Upstream-sti fra /iphone/…; bare appen, API-et og inn/utlogging slippes gjennom.
export function upstreamPath(path) {
  if (path === '/' || path === '') return '/';
  if (/^\/api\/[a-z0-9/_-]+$/i.test(path) || path === '/login' || path === '/logout') return path;
  return null;
}

export function createIphoneProxy({ env = process.env, fetchImpl = fetch, isProd = env.NODE_ENV === 'production' } = {}) {
  let upstreamCookie = null, loggingIn = null;
  const base = () => env.IPHONE_REMOTE_URL.replace(/\/+$/, '');

  async function login() {
    if (!loggingIn) loggingIn = (async () => {
      const r = await fetchImpl(`${base()}/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: env.IPHONE_REMOTE_USER, password: env.IPHONE_REMOTE_PASSWORD }), redirect: 'manual', signal: AbortSignal.timeout(15000) });
      await r.body?.cancel();
      const cookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean);
      if (!r.ok || !cookies.length) throw new Error(`iphone-remote innlogging feilet (${r.status})`);
      upstreamCookie = cookies.map(c => c.split(';')[0]).join('; ');
    })().finally(() => { loggingIn = null; });
    return loggingIn;
  }

  async function forward(req, path, signal) {
    if (!upstreamCookie) await login();
    const send = () => fetchImpl(`${base()}${path}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`, {
      method: req.method, redirect: 'manual', signal,
      headers: { cookie: upstreamCookie, accept: req.headers.accept || '*/*', ...(req.method !== 'GET' ? { 'content-type': 'application/json' } : {}) },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body ?? {})
    });
    let r = await send();
    if (r.status === 401) { await r.body?.cancel(); upstreamCookie = null; await login(); r = await send(); }
    return r;
  }

  const sessionRoute = Router();
  // Under /api (accessControl): gir billett til administrator.
  sessionRoute.post('/session', (req, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Administrator kreves' });
    if (!iphoneConfigured(env)) return res.json({ configured: false });
    res.cookie(TICKET_COOKIE, makeTicket(), { httpOnly: true, secure: isProd, sameSite: 'strict', path: '/iphone', maxAge: TICKET_TTL_MS });
    res.json({ configured: true, path: '/iphone/' });
  });

  const proxy = Router();
  proxy.use(async (req, res) => {
    // Egne sikkerhetshoder: siden kan bare vises i dashboardet (samme opphav) og trenger innebygde skript.
    res.set({ 'X-Frame-Options': 'SAMEORIGIN', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'; form-action 'self'" });
    if (!iphoneConfigured(env)) return res.status(503).type('text').send('Iphone-fjernstyring er ikke satt opp på serveren.');
    if (!validTicket(readCookie(req, TICKET_COOKIE))) return res.status(401).type('text').send('Åpne Iphone-fanen i dashboardet på nytt.');
    const path = upstreamPath(req.path);
    if (path === null) return res.status(404).type('text').send('Ikke funnet');
    // Utlogging hos iphone-remote ville bare kastet vår økt; dashboardet styrer innloggingen.
    if (path === '/logout') return res.json({ ok: true });
    if (path === '/login') return res.json({ ok: true });
    const ctrl = new AbortController();
    res.on('close', () => ctrl.abort());
    try {
      const r = await forward(req, path, ctrl.signal);
      res.status(r.status);
      for (const h of ['content-type', 'content-length', 'cache-control']) { const v = r.headers.get(h); if (v && !(path === '/' && h === 'content-length')) res.set(h, v); }
      // no-transform: komprimering ville bufret skjermstrømmen (multipart/x-mixed-replace).
      res.set('Cache-Control', 'no-store, no-transform');
      if (path === '/') return res.send(rewriteHtml(await r.text()));
      if (!r.body) return res.end();
      Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      res.status(502).type('text').send('Fikk ikke kontakt med iphone-remote.');
    }
  });

  return { sessionRoute, proxy };
}
