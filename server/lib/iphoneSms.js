import { readRpcResponse } from './mcpClient.js';

/**
 * SMS fra iPhonen («Mini sin iPhone») via mobile-mcp (iphone-remote /mcp),
 * som styrer Meldinger-appen slik en person ville gjort (sms:-adresser
 * går ikke; iphone-remote og mobile-mcp åpner bare http/https):
 *  Meldinger → «Ny melding» → skriv nummeret i «Til:» → skriv teksten i
 *  «Melding» → trykk Send → sjekk at Send-knappen er borte (sendt).
 * Knapper og felt finnes etter navn (lest av telefonen, iOS 16 på norsk).
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

const MESSAGES_APP = 'com.apple.MobileSMS';
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
const str = (el, k) => (typeof el?.[k] === 'string' ? el[k].trim() : '');
/** Første element som passer, med midtpunkt å trykke på. */
function findElement(elements, match) {
  const e = (Array.isArray(elements) ? elements : []).find(match);
  const c = e?.coordinates;
  if (!e || !c || ![c.x, c.y, c.width, c.height].every(Number.isFinite)) return null;
  return { ...e, x: Math.round(c.x + c.width / 2), y: Math.round(c.y + c.height / 2) };
}
/** Send-knappen i Meldinger (identifier «sendButton», etikett «Send»). */
export const findSendButton = els => findElement(els, el => ['identifier', 'name', 'label'].some(k => SEND_LABEL.test(str(el, k))));
/** «Ny melding» øverst til høyre i samtalelisten. */
export const findComposeButton = els => findElement(els, el => str(el, 'identifier') === 'composeButton' || /^ny melding$|^new message$|^compose$/i.test(str(el, 'label')));
/** Tilbake-knappen øverst når Meldinger åpner i en samtale. */
export const findBackButton = els => findElement(els, el => el?.type === 'Button' && el.coordinates?.y < 130 && /tilbake|back/i.test(`${str(el, 'identifier')} ${str(el, 'label')}`));
/** Mottakerfeltet «Til:» i en ny melding. */
export const findRecipientField = els => findElement(els, el => /TextField|TextView/.test(el?.type) && /^(til|to):?$/i.test(str(el, 'label')));
/** Meldingsfeltet (identifier «messageBodyField», etikett «Melding»). */
export const findBodyField = els => findElement(els, el => str(el, 'identifier') === 'messageBodyField' || (/TextField|TextView/.test(el?.type) && /^(melding|tekstmelding|imessage|message|text message)$/i.test(str(el, 'label'))));
/** «Avbryt» øverst i en ny melding (et gammelt utkast som står åpent). */
export const findCancelButton = els => findElement(els, el => el?.type === 'Button' && /^(avbryt|cancel)$/i.test(str(el, 'label')));
/** «Slett utkast» hvis Meldinger spør hva som skal skje med et utkast med tekst. */
export const findDiscardDraft = els => findElement(els, el => el?.type === 'Button' && /^(slett utkast|forkast|delete draft|discard)$/i.test(str(el, 'label')));
/** Meldinger som ikke gikk fram («Feil ved sending» ved meldingen). */
export const countFailed = els => (Array.isArray(els) ? els : []).filter(el => /^(feil ved sending|not delivered|ikke levert)$/i.test(str(el, 'label')) && el?.type === 'Button').length;

const validNumber = to => { if (!/^\+\d{8,15}$/.test(to)) throw new Error('Ugyldig telefonnummer'); return to; };

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

  const tap = (id, el) => tool('mobile_click_on_screen_at_coordinates', { device: id, x: el.x, y: el.y });
  const type = (id, value) => tool('mobile_type_keys', { device: id, text: value, submit: false });
  /** Leser skjermen til `find` treffer (animasjoner tar litt tid), ellers null. */
  async function waitFor(id, find, tries = 6) {
    for (let i = 0; i < tries; i++) {
      await sleep(i ? 700 : 1000);
      const el = find(await elements(id));
      if (el) return el;
    }
    return null;
  }

  /**
   * Kommer til samtalelisten og gir «Ny melding». Meldinger åpner der den sist
   * var: i en samtale (Tilbake), i et gammelt utkast (Avbryt), eller med
   * spørsmål om utkastet (Slett utkast).
   */
  async function conversationList(id) {
    for (let i = 0; i < 8; i++) {
      await sleep(i ? 700 : 1000);
      const els = await elements(id);
      const compose = findComposeButton(els);
      if (compose) return compose;
      const way = findDiscardDraft(els) || (findRecipientField(els) && findCancelButton(els)) || findBackButton(els);
      if (way) await tap(id, way);
    }
    return null;
  }

  // step(tekst) gir en steg-for-steg-logg (brukes av «Send SMS med iPhone» i Huset).
  async function sendNow(to, message, step) {
    validNumber(to);
    const id = await phone(); step('Fant telefonen via MCP');
    await remotePost('/api/unlock', {}).then(() => step('Låste opp telefonen'), () => step('Kunne ikke låse opp (fortsetter)'));
    try {
      await tool('mobile_launch_app', { device: id, packageName: MESSAGES_APP });
      const compose = await conversationList(id);
      if (!compose) throw new Error('Fant ikke «Ny melding» i Meldinger');
      step('Åpnet Meldinger');

      await tap(id, compose);
      const recipient = await waitFor(id, findRecipientField);
      if (!recipient) throw new Error('Fant ikke «Til:»-feltet i ny melding');
      await tap(id, recipient);
      await type(id, to);
      // Retur låser mottakeren; før det dekker forslagslisten meldingsfeltet.
      await tool('mobile_press_button', { device: id, button: 'ENTER' });
      step(`Skrev mottaker ${to}`);

      const body = await waitFor(id, findBodyField);
      if (!body) throw new Error('Fant ikke meldingsfeltet');
      await tap(id, body);
      await type(id, message.slice(0, 1000)); step('Skrev meldingen');

      const before = await elements(id);
      const button = findSendButton(before) || await waitFor(id, findSendButton);
      if (!button) throw new Error('Fant ikke Send-knappen i Meldinger');
      await tap(id, button); step('Trykket Send');
      await sleep(3000);
      const after = await elements(id);
      // Send-knappen forsvinner når tekstfeltet er tomt, altså når meldingen er sendt.
      if (findSendButton(after)) throw new Error('Meldingen ser ikke ut til å være sendt');
      if (countFailed(after) > countFailed(before)) throw new Error('Telefonen sendte, men meldingen ble ikke levert («Feil ved sending»)');
      step('Bekreftet: meldingen er sendt');
    } finally {
      await tool('mobile_press_button', { device: id, button: 'HOME' }).then(() => step('Tilbake til hjem-skjermen'), () => {});
    }
  }

  /** Sjekker koblingen uten å sende noe: innlogging, MCP, telefon og at skjermen kan leses. */
  async function checkNow(step) {
    await login(); step('Innlogging hos iphone-remote OK');
    device = null;
    const id = await phone(); step(`MCP svarer, telefon tilkoblet (${id.slice(0, 8)}…)`);
    const els = await elements(id); step(`Leste skjermen: ${els.length} elementer`);
    return { device: id, elements: els.length };
  }

  return {
    configured: () => iphoneSmsConfigured(env),
    send(to, text, { onStep = () => {} } = {}) {
      if (!iphoneSmsConfigured(env)) return Promise.reject(new Error('SMS via iPhonen er ikke satt opp'));
      const job = queue.catch(() => {}).then(() => sendNow(to, text, onStep));
      queue = job;
      return job;
    },
    check({ onStep = () => {} } = {}) {
      if (!iphoneSmsConfigured(env)) return Promise.reject(new Error('SMS via iPhonen er ikke satt opp'));
      const job = queue.catch(() => {}).then(() => checkNow(onStep));
      queue = job;
      return job;
    }
  };
}

export const iphoneSms = createIphoneSms();
