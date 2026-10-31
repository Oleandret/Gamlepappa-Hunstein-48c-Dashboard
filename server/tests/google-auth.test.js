import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import express from 'express';
import { generateKeyPair, SignJWT } from 'jose';
import { createGoogleAuth, googleConfig, verifyGoogleIdentity, OWNER_EMAIL, googleAuth } from '../lib/googleAuth.js';
import { accessControl } from '../lib/auth.js';
const MIRROR = 'https://mirror.example';
const cfg = { origin: 'https://dashboard.example', origins: ['https://dashboard.example', MIRROR], clientId: 'fixture-client', clientSecret: 'fixture-secret', redirectUri: 'https://dashboard.example/auth/google/callback' };
const keys = await generateKeyPair('RS256');
const claims = { iss: 'https://accounts.google.com', aud: cfg.clientId, sub: 'fixture-owner', email: OWNER_EMAIL, email_verified: true, nonce: 'fixture-nonce', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+300 };
const sign = payload => new SignJWT(payload).setProtectedHeader({ alg: 'RS256' }).sign(keys.privateKey);

test('Google login is off by default and requires a canonical HTTPS origin and credentials', () => {
  assert.equal(googleConfig({}), null);
  const env = { GOOGLE_LOGIN_ENABLED: 'true', GOOGLE_CLIENT_ID: 'fixture', GOOGLE_CLIENT_SECRET: 'fixture', AUTH_PUBLIC_ORIGIN: cfg.origin };
  assert.equal(googleConfig(env).redirectUri, cfg.redirectUri);
  for (const origin of ['http://dashboard.example', 'https://dashboard.example/', 'https://dashboard.example/path', 'https://user:pass@dashboard.example']) assert.equal(googleConfig({ ...env, AUTH_PUBLIC_ORIGIN: origin }), null);
  assert.equal(googleConfig({ ...env, GOOGLE_CLIENT_SECRET: '' }), null);
  // Vercel-speilet er tillatt som standard; ugyldige ekstra-opprinnelser ignoreres
  assert.deepEqual(googleConfig(env).origins, [cfg.origin, 'https://gamlepappa-hunstein-48c-dashboard.vercel.app']);
  assert.deepEqual(googleConfig({ ...env, AUTH_EXTRA_ORIGINS: 'https://speil.example, http://usikker.example, https://x.example/sti' }).origins, [cfg.origin, 'https://speil.example']);
  assert.deepEqual(googleConfig({ ...env, AUTH_EXTRA_ORIGINS: '' }).origins, [cfg.origin]);
});
test('only verified owner identity with valid signature, issuer, audience, nonce and lifetime is accepted', async () => {
  assert.deepEqual(await verifyGoogleIdentity(await sign(claims), cfg, claims.nonce, keys.publicKey), { sub: claims.sub, email: OWNER_EMAIL });
  for (const patch of [{ email: 'other@gmail.com' }, { email_verified: false }, { email_verified: 'true' }, { aud: 'other-client' }, { iss: 'https://evil.example' }, { nonce: 'wrong' }, { exp: 1 }, { iat: 1 }, { azp: 'other-client' }, { aud: [cfg.clientId, 'other-client'] }, { sub: '' }]) {
    await assert.rejects(verifyGoogleIdentity(await sign({ ...claims, ...patch }), cfg, claims.nonce, keys.publicKey));
  }
  const wrongKeys = await generateKeyPair('RS256');
  await assert.rejects(verifyGoogleIdentity(await sign(claims), cfg, claims.nonce, wrongKeys.publicKey));
});
async function harness(t, overrides = {}) {
  let clock = Date.now(), exchanges = [];
  const auth = createGoogleAuth({ config: () => cfg, now: () => clock, verify: (token, config, nonce) => verifyGoogleIdentity(token, config, nonce, keys.publicKey), fetchImpl: async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    exchanges.push(options);
    return { ok: true, json: async () => ({ id_token: await sign({ ...claims, nonce: activeNonce }) }) };
  }, ...overrides });
  let activeNonce;
  const app = express(); app.use('/auth', auth.router);
  app.get('/session', (req, res) => { const s = auth.session(req); res.status(s ? 200 : 401).json(s ? { csrfToken: s.csrfToken } : {}); });
  app.post('/write', (req, res) => { const s = auth.session(req); res.status(s && auth.csrfValid(req, s) ? 200 : 403).end(); });
  app.post('/logout', (req, res) => { const s = auth.session(req); if (!s || !auth.csrfValid(req, s)) return res.status(403).end(); auth.logout(req, res); });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => { server.close(r); server.closeAllConnections(); }));
  const request = (path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { ...options, redirect: 'manual' });
  async function start(query = '') {
    const response = await request(`/auth/google${query}`);
    const url = new URL(response.headers.get('location'));
    activeNonce = url.searchParams.get('nonce');
    return { url, cookie: response.headers.get('set-cookie').split(';')[0], response };
  }
  const finish = a => request(`/auth/google/callback?state=${a.url.searchParams.get('state')}&code=fixture-code`, { headers: { cookie: a.cookie } });
  return { request, start, finish, exchanges, advance: ms => { clock += ms; } };
}
test('browser-bound one-time code flow uses PKCE, restricted scopes and secure revocable sessions', async t => {
  const h = await harness(t), a = await h.start();
  assert.equal(a.url.searchParams.get('scope'), 'openid email');
  assert.equal(a.url.searchParams.get('redirect_uri'), cfg.redirectUri);
  assert.equal(a.url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(a.url.searchParams.has('client_secret'), false);
  const response = await h.finish(a); assert.equal(response.headers.get('location'), '/');
  const rawCookie = response.headers.getSetCookie().find(v => v.startsWith('__Host-dashboard-session='));
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(rawCookie.includes(attribute));
  assert.ok(!rawCookie.includes('Domain='));
  assert.equal(createHash('sha256').update(h.exchanges[0].body.get('code_verifier')).digest('base64url'), a.url.searchParams.get('code_challenge'));
  const cookie = rawCookie.split(';')[0];
  const session = await (await h.request('/session', { headers: { cookie } })).json();
  assert.equal((await h.request('/write', { method: 'POST', headers: { cookie } })).status, 403);
  const headers = { cookie, origin: cfg.origin, 'x-csrf-token': session.csrfToken };
  assert.equal((await h.request('/write', { method: 'POST', headers: { ...headers, origin: 'https://evil.example' } })).status, 403);
  assert.equal((await h.request('/write', { method: 'POST', headers })).status, 200);
  assert.equal((await h.finish(a)).headers.get('location'), '/?login=failed');
  assert.equal(h.exchanges.length, 1);
  assert.equal((await h.request('/logout', { method: 'POST', headers })).status, 200);
  assert.equal((await h.request('/session', { headers: { cookie } })).status, 401);
});
test('wrong browser binding and expired attempts are denied before token exchange', async t => {
  const h = await harness(t); const a = await h.start();
  assert.equal((await h.finish({ ...a, cookie: '__Host-dashboard-login=wrong' })).headers.get('location'), '/?login=failed');
  const b = await h.start(); h.advance(600001);
  assert.equal((await h.finish(b)).headers.get('location'), '/?login=failed'); assert.equal(h.exchanges.length, 0);
});
test('session expires and token exchange failures do not grant access', async t => {
  const h = await harness(t); const response = await h.finish(await h.start());
  const cookie = response.headers.getSetCookie().find(v => v.startsWith('__Host-dashboard-session=')).split(';')[0];
  h.advance(7 * 86400000 + 1);
  assert.equal((await h.request('/session', { headers: { cookie } })).status, 401);
  const failed = await harness(t, { fetchImpl: async () => { throw new Error('fixture failure'); } });
  assert.equal((await failed.finish(await failed.start())).headers.get('location'), '/?login=failed');
});
test('API middleware enforces cookie CSRF and explicit invalid bearer cannot fall back to a cookie', () => {
  const oldSession = googleAuth.session, oldCsrf = googleAuth.csrfValid;
  const oldDemo = process.env.DEMO_MODE; process.env.DEMO_MODE = 'false';
  googleAuth.session = () => ({ role: 'admin', csrfToken: 'fixture' }); googleAuth.csrfValid = () => false;
  function invoke(headers, method) {
    let status = 200, allowed = false;
    accessControl({ headers, method, ip: 'fixture', path: '/config/test' }, { status(n) { status = n; return this; }, json() {} }, () => { allowed = true; });
    return { status, allowed };
  }
  try {
    assert.deepEqual(invoke({}, 'POST'), { status: 403, allowed: false });
    assert.deepEqual(invoke({}, 'GET'), { status: 200, allowed: true });
    assert.deepEqual(invoke({ authorization: 'Bearer invalid' }, 'GET'), { status: 401, allowed: false });
  } finally { googleAuth.session = oldSession; googleAuth.csrfValid = oldCsrf; if (oldDemo === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = oldDemo; }
});

test('all authenticated bearer roles may log out without gaining write permissions', () => {
  const old = process.env.AUTH_TOKENS_JSON, demo = process.env.DEMO_MODE;
  process.env.AUTH_TOKENS_JSON = JSON.stringify({viewer: 'fixture-viewer-long-enough-for-test'});
  process.env.DEMO_MODE = 'false';
  try {
    let allowed = false;
    accessControl({headers: {authorization: 'Bearer fixture-viewer-long-enough-for-test'}, method: 'POST', path: '/logout', ip: 'logout-fixture'}, {status() { assert.fail('viewer should be able to log out'); }}, () => { allowed = true; });
    assert.equal(allowed, true);
  } finally {
    if (old === undefined) delete process.env.AUTH_TOKENS_JSON; else process.env.AUTH_TOKENS_JSON = old;
    if (demo === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = demo;
  }
});

test('innlogging fra et tillatt speil fullføres og låses til speilets opprinnelse', async t => {
  const h = await harness(t);
  const evil = await h.start(`?origin=${encodeURIComponent('https://evil.example')}`);
  assert.equal(evil.url.searchParams.get('redirect_uri'), cfg.redirectUri);
  const a = await h.start(`?origin=${encodeURIComponent(MIRROR)}`);
  assert.equal(a.url.searchParams.get('redirect_uri'), `${MIRROR}/auth/google/callback`);
  const response = await h.finish(a);
  assert.equal(response.headers.get('location'), '/');
  assert.equal(h.exchanges[0].body.get('redirect_uri'), `${MIRROR}/auth/google/callback`);
  const cookie = response.headers.getSetCookie().find(v => v.startsWith('__Host-dashboard-session=')).split(';')[0];
  const session = await (await h.request('/session', { headers: { cookie } })).json();
  const write = origin => h.request('/write', { method: 'POST', headers: { cookie, origin, 'x-csrf-token': session.csrfToken } });
  assert.equal((await write(MIRROR)).status, 200);
  assert.equal((await write(cfg.origin)).status, 403);
});

test('residents with their Google e-mail registered log in as themselves and only reach Trivsel', async t => {
  const { resolveUser } = await import('../lib/googleAuth.js');
  const byEmail = async e => (e === 'ylva@gmail.com' ? 'Ylva' : null);
  assert.deepEqual(await resolveUser(OWNER_EMAIL, { byEmail }), { role: 'admin' });
  assert.deepEqual(await resolveUser('ylva@gmail.com', { byEmail }), { role: 'beboer', navn: 'Ylva' });
  assert.equal(await resolveUser('other@gmail.com', { byEmail }), null);
  assert.equal(await resolveUser('x@gmail.com', { byEmail: async () => { throw new Error('db'); } }), null);
  // Verifisering med egen tillatelsesliste: en beboer slipper gjennom, en ukjent ikke.
  const allowed = async e => Boolean(await resolveUser(e, { byEmail }));
  assert.equal((await verifyGoogleIdentity(await sign({ ...claims, email: 'ylva@gmail.com' }), cfg, claims.nonce, keys.publicKey, allowed)).email, 'ylva@gmail.com');
  await assert.rejects(verifyGoogleIdentity(await sign({ ...claims, email: 'other@gmail.com' }), cfg, claims.nonce, keys.publicKey, allowed));
  // Hele flyten: Google-økta får rolle beboer og navn.
  let email = 'ylva@gmail.com';
  const auth = createGoogleAuth({ config: () => cfg, resolve: e => resolveUser(e, { byEmail }), verify: (token, config, nonce, _k, ok) => verifyGoogleIdentity(token, config, nonce, keys.publicKey, ok),
    fetchImpl: async () => ({ ok: true, json: async () => ({ id_token: await sign({ ...claims, email, nonce: activeNonce }) }) }) });
  let activeNonce;
  const app = express(); app.use('/auth', auth.router);
  app.get('/session', (req, res) => { const s = auth.session(req); res.status(s ? 200 : 401).json(s ? { role: s.role, navn: s.navn } : {}); });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => { server.close(r); server.closeAllConnections(); }));
  const request = (path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { ...options, redirect: 'manual' });
  async function login() {
    const response = await request('/auth/google'); const url = new URL(response.headers.get('location')); activeNonce = url.searchParams.get('nonce');
    assert.equal(url.searchParams.has('login_hint'), false, 'beboere velger egen konto');
    const cb = await request(`/auth/google/callback?state=${url.searchParams.get('state')}&code=fixture-code`, { headers: { cookie: response.headers.get('set-cookie').split(';')[0] } });
    const raw = cb.headers.getSetCookie()?.find(v => v.startsWith('__Host-dashboard-session=')) || '';
    return { location: cb.headers.get('location'), cookie: raw.split(';')[0] };
  }
  const ylva = await login();
  assert.equal(ylva.location, '/');
  assert.deepEqual(await (await request('/session', { headers: { cookie: ylva.cookie } })).json(), { role: 'beboer', navn: 'Ylva' });
  email = 'other@gmail.com';
  assert.equal((await login()).location, '/?login=failed');
  email = OWNER_EMAIL;
  assert.deepEqual(await (await request('/session', { headers: { cookie: (await login()).cookie } })).json(), { role: 'admin' });

  // Tilgangskontrollen: Google-beboer får Trivsel, ikke resten, og må ha CSRF for å skrive.
  const oldSession = googleAuth.session, oldCsrf = googleAuth.csrfValid, oldDemo = process.env.DEMO_MODE; process.env.DEMO_MODE = 'false';
  googleAuth.session = () => ({ role: 'beboer', navn: 'Ylva', email: 'ylva@gmail.com', csrfToken: 'fixture' }); googleAuth.csrfValid = (req, s) => req.headers['x-csrf-token'] === s.csrfToken;
  function invoke(path, method, headers = {}) {
    let status = 200, user = null;
    accessControl({ headers: { cookie: '__Host-dashboard-session=x', ...headers }, method, ip: 'fixture-' + path + method, path }, { status(n) { status = n; return this; }, json() {} }, function () { user = this.user; }.bind({ get user() { return null; } }));
    return status;
  }
  try {
    const req = { headers: { cookie: '__Host-dashboard-session=x' }, method: 'GET', ip: 'g1', path: '/huset' };
    let allowed = false; accessControl(req, { status() { return this; }, json() {} }, () => { allowed = true; });
    assert.equal(allowed, true); assert.deepEqual([req.user.role, req.user.method, req.user.navn], ['beboer', 'google', 'Ylva']);
    assert.equal(invoke('/heating/settings', 'GET'), 403);
    assert.equal(invoke('/huset/admin', 'GET'), 403);
    assert.equal(invoke('/huset/gjoremal', 'POST'), 403, 'uten CSRF');
    assert.equal(invoke('/huset/gjoremal', 'POST', { 'x-csrf-token': 'fixture' }), 200);
  } finally { googleAuth.session = oldSession; googleAuth.csrfValid = oldCsrf; if (oldDemo === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = oldDemo; }
});
