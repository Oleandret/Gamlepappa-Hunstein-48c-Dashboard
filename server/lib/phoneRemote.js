// Felles klient mot iphone-remote (gatewayen på Railway) for alt som styrer iPhonen fra dashboardet:
// innlogging med øktcookie, REST-kall (/api/unlock, /api/launch, /api/tap, /api/keys, /api/source …)
// og én kø, siden telefonen bare tåler én styrende part om gangen (SMS-sending og Vigilo-lesing deler den).
export function phoneRemoteConfigured(env = process.env) {
  try { return Boolean(env.IPHONE_REMOTE_USER && env.IPHONE_REMOTE_PASSWORD && new URL(env.IPHONE_REMOTE_URL).protocol === 'https:'); }
  catch { return false; }
}

export function createPhoneRemote({ env = process.env, fetchImpl = fetch } = {}) {
  let cookie = null, queue = Promise.resolve();
  const base = () => env.IPHONE_REMOTE_URL.replace(/\/+$/, '');

  async function login() {
    const r = await fetchImpl(`${base()}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ username: env.IPHONE_REMOTE_USER, password: env.IPHONE_REMOTE_PASSWORD }) });
    await r.body?.cancel();
    const set = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean);
    if (!r.ok || !set.length) throw new Error('Innlogging hos iphone-remote feilet');
    cookie = set.map(c => c.split(';')[0]).join('; ');
  }
  async function call(method, path, body, timeout = 30000) {
    if (!cookie) await login();
    const send = () => fetchImpl(`${base()}${path}`, { method, redirect: 'manual', signal: AbortSignal.timeout(timeout),
      headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    let r = await send();
    if (r.status === 401) { await r.body?.cancel(); await login(); r = await send(); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `iphone-remote svarte ${r.status} på ${path}`);
    return j;
  }
  /** Kjør noe mot telefonen etter at alt som står i køen er ferdig (feil i det forrige stopper ikke det neste). */
  function serial(fn) { const job = queue.catch(() => {}).then(fn); queue = job; return job; }

  return {
    configured: () => phoneRemoteConfigured(env),
    login, serial,
    get: (path, timeout) => call('GET', path, undefined, timeout),
    post: (path, body = {}, timeout) => call('POST', path, body, timeout),
    unlock: () => call('POST', '/api/unlock', {}),
    home: () => call('POST', '/api/home', {}),
    launch: bundleId => call('POST', '/api/launch', { bundleId }, 60000),
    tap: (x, y) => call('POST', '/api/tap', { x, y }),
    type: text => call('POST', '/api/keys', { text }),
    swipe: (fromX, fromY, toX, toY, duration = 0.3) => call('POST', '/api/swipe', { fromX, fromY, toX, toY, duration }),
    source: () => call('GET', '/api/source', undefined, 60000)
  };
}
export const phoneRemote = createPhoneRemote();
