import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Router } from 'express';

export const OWNER_EMAIL = 'oleandretorjussen@gmail.com';
const SESSION_COOKIE = '__Host-dashboard-session';
const LOGIN_COOKIE = '__Host-dashboard-login';
const LOGIN_TTL = 10 * 60_000;
const SESSION_TTL = 7 * 24 * 60 * 60_000;
const random = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('base64url');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
// Frontend-speilet på Vercel videresender /auth og /api hit, så innloggingen kan fullføres der.
const VERCEL_ORIGIN = 'https://gamlepappa-hunstein-48c-dashboard.vercel.app';
const canonicalHttps = value => { try { const u = new URL(value); return u.protocol === 'https:' && u.origin === value ? value : null; } catch { return null; } };
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
function cookie(req, name) {
  const values = (req.headers.cookie || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : '';
}
export function googleConfig(env = process.env) {
  if (env.GOOGLE_LOGIN_ENABLED !== 'true' || env.DEMO_MODE === 'true') return null;
  try {
    const origin = new URL(env.AUTH_PUBLIC_ORIGIN);
    if (origin.protocol !== 'https:' || origin.origin !== env.AUTH_PUBLIC_ORIGIN || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
    const extra = (env.AUTH_EXTRA_ORIGINS ?? VERCEL_ORIGIN).split(',').map(v => canonicalHttps(v.trim())).filter(Boolean);
    const origins = [...new Set([origin.origin, ...extra])];
    return { origin: origin.origin, origins, clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: `${origin.origin}/auth/google/callback` };
  } catch { return null; }
}
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyGoogleIdentity(token, config, nonce, keys = googleKeys) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: config.clientId,
    algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'nonce', 'email', 'email_verified'], maxTokenAge: '10m',
  });
  if (!equal(payload.nonce, nonce) || payload.email !== OWNER_EMAIL || payload.email_verified !== true || typeof payload.sub !== 'string' || !payload.sub || (payload.azp && payload.azp !== config.clientId) || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId)) throw new Error('Identity rejected');
  return { sub: payload.sub, email: payload.email };
}

// One process/replica: restart revokes all sessions. No refresh or provider access tokens are stored.
export function createGoogleAuth({ config = () => googleConfig(), fetchImpl = fetch, verify = verifyGoogleIdentity, now = Date.now } = {}) {
  const logins = new Map(), sessions = new Map(), limits = new Map();
  const prune = map => { for (const [key, value] of map) if (value.expires <= now()) map.delete(key); };
  const router = Router();
  router.use((_req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); next(); });
  router.get('/config', (_req, res) => res.json({ googleEnabled: Boolean(config()) }));
  router.get('/google', (req, res) => {
    const cfg = config();
    if (!cfg) return res.status(404).json({ error: 'Google-innlogging er ikke aktivert' });
    prune(logins); prune(limits); prune(sessions);
    const limit = limits.get(req.ip) || { expires: now() + 60_000, count: 0 };
    if (limits.size >= 10_000 || ++limit.count > 10 || logins.size >= 1000 || sessions.size >= 1000) return res.status(429).json({ error: 'Prøv igjen senere' });
    limits.set(req.ip, limit);
    const state = random(), binding = random(), nonce = random(), verifier = random();
    const origin = (cfg.origins || []).includes(req.query.origin) ? req.query.origin : cfg.origin;
    const redirectUri = `${origin}/auth/google/callback`;
    logins.set(hash(state), { binding: hash(binding), nonce, verifier, origin, redirectUri, expires: now() + LOGIN_TTL });
    res.cookie(LOGIN_COOKIE, binding, { ...cookieOptions, maxAge: LOGIN_TTL });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email', state, nonce, code_challenge: hash(verifier), code_challenge_method: 'S256', login_hint: OWNER_EMAIL, prompt: 'select_account' });
    res.redirect(url.href);
  });
  router.get('/google/callback', async (req, res) => {
    const cfg = config();
    res.clearCookie(LOGIN_COOKIE, cookieOptions);
    try {
      if (!cfg || typeof req.query.state !== 'string' || req.query.state.length > 128) throw new Error('Invalid login');
      const key = hash(req.query.state), attempt = logins.get(key);
      logins.delete(key); // Single use, including failed exchanges.
      if (!attempt || attempt.expires <= now() || !equal(attempt.binding, hash(cookie(req, LOGIN_COOKIE))) || typeof req.query.code !== 'string' || req.query.code.length > 4096 || req.query.error) throw new Error('Invalid login');
      const response = await fetchImpl('https://oauth2.googleapis.com/token', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code: req.query.code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: attempt.redirectUri, code_verifier: attempt.verifier }),
      });
      if (!response.ok) throw new Error('Exchange failed');
      const tokens = await response.json();
      const identity = await verify(tokens.id_token, cfg, attempt.nonce);
      prune(sessions);
      if (sessions.size >= 1000) throw new Error('Session limit');
      sessions.delete(hash(cookie(req, SESSION_COOKIE)));
      const id = random();
      sessions.set(hash(id), { ...identity, origin: attempt.origin, role: 'admin', csrfToken: random(), expires: now() + SESSION_TTL });
      res.cookie(SESSION_COOKIE, id, { ...cookieOptions, maxAge: SESSION_TTL });
      return res.redirect('/');
    } catch {
      // Never log authorization codes, ID tokens, or provider error bodies.
      return res.redirect('/?login=failed');
    }
  });
  function session(req) {
    if (!config()) return null;
    prune(sessions);
    return sessions.get(hash(cookie(req, SESSION_COOKIE))) || null;
  }
  function csrfValid(req, value) {
    const cfg = config();
    return Boolean(cfg) && req.headers.origin === (value.origin || cfg.origin) && equal(req.headers['x-csrf-token'], value.csrfToken);
  }
  function logout(req, res) {
    sessions.delete(hash(cookie(req, SESSION_COOKIE)));
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.set('Cache-Control', 'no-store').json({ ok: true });
  }
  return { router, session, csrfValid, logout };
}
export const googleAuth = createGoogleAuth();
