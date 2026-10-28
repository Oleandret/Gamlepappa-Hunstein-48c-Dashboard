import { readRpcResponse } from './mcpClient.js';

/**
 * SMS fra iPhonen («Mini sin iPhone») via iphone-remote:
 *  1. iphone-remote åpner Meldinger med mottaker og tekst ferdig utfylt
 *     (sms:-adresse via /api/url; mobile-mcp tillater bare http/https).
 *  2. mobile-mcp (iphone-remote /mcp) finner Send-knappen etter navn og
 *     trykker på den, og sjekker at den er borte etterpå (meldingen er sendt).
 * Én melding om gangen: telefonen tåler én styrende part.
 *
 * Miljø: IPHONE_REMOTE_URL/USER/PASSWORD (samme som Iphone-fanen) og
 * IPHONE_MCP_TOKEN (MCP_CLIENT_TOKEN i iphone-remote). IPHONE_MCP_URL er
 * valgfri (standard IPHONE_REMOTE_URL + /mcp).
 */
export function iphoneSmsConfigured(env = process.env) {
  try { return Boolean(env.IPHONE_MCP_TOKEN && env.IPHONE_REMOTE_USER && env.IPHONE_REMOTE_PASSWORD && new URL(env.IPHONE_REMOTE_URL).protocol === 'https:'); }
  catch { return false; }
}

const SEND_LABEL = /^(send|sendbutton)$/i;
/**
 * mobile_list_elements_on_screen svarer «Found these elements on screen: [ … ]»
 * med {type, label, name, value, identifier, coordinates:{x,y,width,height}}.
 */
export function parseElements(text) {
  const start = typeof text === 'string' ? text.indexOf('[') : -1;
  if (start < 0) return [];
  try { const v = JSON.parse(text.slice(start)); return Array.isArray(v) ? v : []; } catch { return []; }
}
/** Send-knappen i Meldinger (identifier «sendButton», etikett «Send»), med midtpunkt å trykke på. */
export function findSendButton(elements) {
  const e = (Array.isArray(elements) ? elements : []).find(el =>
    ['identifier', 'name', 'label'].some(k => typeof el?.[k] === 'string' && SEND_LABEL.test(el[k].trim())));
  const c = e?.coordinates;
  if (!e || !c || ![c.x, c.y, c.width, c.height].every(Number.isFinite)) return null;
  return { ...e, x: Math.round(c.x + c.width / 2), y: Math.round(c.y + c.height / 2) };
}

/** sms:-adresse med mottaker og ferdig utfylt tekst. */
export function smsUrl(to, text) {
  if (!/^\+\d{8,15}$/.test(to)) throw new Error('Ugyldig telefonnummer');
  return `sms:${to}&body=${encodeURIComponent(text)}`;
}

export function createIphoneSms({ env = process.env, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let cookie = null, device = null, queue = Promise.resolve(), nextId = 1;
  const remote = () => env.IPHONE_REMOTE_URL.replace(/\/+$/, '');

  async function login() {
    const r = await fetchImpl(`${remote()}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ username: env.IPHONE_REMOTE_USER, password: env.IPHONE_REMOTE_PASSWORD }) });
    await r.body?.cancel();
    const set = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean);
    if (!r.ok || !set.length) throw new Error('Innlogging hos iphone-remote feilet');
    cookie = set.map(c => c.split(';')[0]).join('; ');
  }
  async function remotePost(path, body) {
    if (!cookie) await login();
    const send = () => fetchImpl(`${remote()}${path}`, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(20000),
      headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
    let r = await send();
    if (r.status === 401) { await r.body?.cancel(); await login(); r = await send(); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `iphone-remote svarte ${r.status} på ${path}`);
    return j;
  }

  async function tool(name, args = {}) {
    const id = nextId++;
    const r = await fetchImpl(env.IPHONE_MCP_URL || `${remote()}/mcp`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${env.IPHONE_MCP_TOKEN}`, 'mcp-protocol-version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) });
    if (!r.ok) { await r.body?.cancel(); throw new Error(`Telefonens MCP svarte HTTP ${r.status}`); }
    const result = await readRpcResponse(r, id);
    const text = result?.content?.find(c => c.type === 'text')?.text ?? '';
    if (result?.isError) throw new Error(`Telefonens MCP: ${text.slice(0, 200) || name + ' feilet'}`);
    return text;
  }
  const json = text => { try { return JSON.parse(text); } catch { return null; } };

  async function phone() {
    if (device) return device;
    const d = json(await tool('mobile_list_available_devices'))?.devices?.find(x => x.platform === 'ios' && x.state === 'online');
    if (!d) throw new Error('Fant ingen tilkoblet iPhone');
    return (device = d.id);
  }
  const elements = async id => parseElements(await tool('mobile_list_elements_on_screen', { device: id, format: 'json' }));

  async function sendNow(to, text) {
    const url = smsUrl(to, text.slice(0, 1000));
    const id = await phone();
    await remotePost('/api/unlock', {}).catch(() => {});
    await remotePost('/api/url', { url });
    let button = null;
    for (let i = 0; i < 8 && !button; i++) { await sleep(i ? 1000 : 1500); button = findSendButton(await elements(id)); }
    if (!button) throw new Error('Fant ikke Send-knappen i Meldinger');
    await tool('mobile_click_on_screen_at_coordinates', { device: id, x: button.x, y: button.y });
    await sleep(1500);
    // Send-knappen forsvinner når tekstfeltet er tomt, altså når meldingen er sendt.
    if (findSendButton(await elements(id))) throw new Error('Meldingen ser ikke ut til å være sendt');
    await tool('mobile_press_button', { device: id, button: 'HOME' }).catch(() => {});
  }

  return {
    configured: () => iphoneSmsConfigured(env),
    send(to, text) {
      if (!iphoneSmsConfigured(env)) return Promise.reject(new Error('SMS via iPhonen er ikke satt opp'));
      const job = queue.catch(() => {}).then(() => sendNow(to, text));
      queue = job;
      return job;
    }
  };
}

export const iphoneSms = createIphoneSms();
