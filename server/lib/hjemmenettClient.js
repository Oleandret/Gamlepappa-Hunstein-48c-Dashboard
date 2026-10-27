import { readRpcResponse } from './mcpClient.js';
import { cachedReader } from './readCache.js';

/**
 * Leser «Enhetene mine» fra hjemmenett-monitorens MCP (list_devices) med
 * lese-nøkkelen. Nøkkelen og rådataene blir på serveren; nettleseren får bare
 * den normaliserte listen under. Kun lesing — ingen andre verktøy kalles.
 */
export const CATEGORIES = ['mobile', 'computer', 'tv', 'speaker', 'camera', 'smart', 'network', 'other'];
const TYPE_TO_CATEGORY = {
  'Mobiler og nettbrett': 'mobile', Datamaskiner: 'computer', 'TV og strømming': 'tv', Høyttalere: 'speaker',
  Kameraer: 'camera', Smarthus: 'smart', Nettverk: 'network', Annet: 'other'
};

export function hjemmenettConfigured() { return Boolean(process.env.HJEMMENETT_MCP_URL && process.env.HJEMMENETT_MCP_TOKEN); }

function endpoint() {
  const url = new URL(process.env.HJEMMENETT_MCP_URL);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Hjemmenett-MCP krever HTTPS uten credentials i URL');
  return url.href;
}

const text = (s, max = 120) => typeof s === 'string' && s.trim() ? s.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : null;
const mac = s => typeof s === 'string' && /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(s) ? s.toLowerCase() : null;
const ip = s => typeof s === 'string' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d{1,3}\.\d{1,3}$/.test(s) ? s : null;

/** «1,3 GB» → byte, for sortering på datamengde. */
export function parseDataLabel(label) {
  const m = typeof label === 'string' && label.trim().match(/^([\d\s.,]+)\s*(B|kB|KB|MB|GB|TB)$/);
  if (!m) return null;
  const n = Number(m[1].replace(/\s/g, '').replace(',', '.'));
  const mult = { B: 1, kB: 1e3, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 }[m[2]];
  return Number.isFinite(n) ? Math.round(n * mult) : null;
}

export function normalizeDevices(raw) {
  if (!raw || !Array.isArray(raw.devices) || raw.devices.length > 2048) throw new Error('Ugyldig enhetsliste fra hjemmenett');
  const seen = new Set();
  const devices = [];
  for (const d of raw.devices) {
    const id = mac(d?.mac);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    devices.push({
      id,
      name: text(d.name) || 'Ukjent enhet',
      category: TYPE_TO_CATEGORY[d.type] || 'other',
      room: text(d.room, 80),
      owner: text(d.owner, 80),
      online: d.online === true,
      status: text(d.status, 60),
      ip: ip(d.ip),
      dataLabel: text(d.data_last_24h, 20),
      dataBytes: parseDataLabel(d.data_last_24h)
    });
  }
  return devices;
}

let nextId = 1;
/** Kaller ett lese-verktøy på hjemmenett-MCP-en og returnerer det parsede JSON-svaret. */
async function callTool(name, args = {}) {
  const id = nextId++;
  const response = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${process.env.HJEMMENETT_MCP_TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
    signal: AbortSignal.timeout(15000),
    redirect: 'error'
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Hjemmenett-MCP HTTP ${response.status}`); }
  const result = await readRpcResponse(response, id);
  const payload = result?.content?.find(c => c.type === 'text')?.text;
  if (result?.isError || !payload) throw new Error(`Hjemmenett-MCP svarte ikke på ${name}`);
  return JSON.parse(payload);
}

async function callListDevices() {
  return { devices: normalizeDevices(await callTool('list_devices')), fetchedAt: new Date().toISOString() };
}

const reader = cachedReader(callListDevices, 30_000);

export async function readHjemmenettDevices() {
  if (process.env.DEMO_MODE === 'true') return { connected: false, reason: 'demo-isolation', devices: [] };
  if (!hjemmenettConfigured()) return { connected: false, reason: 'not-configured', devices: [] };
  try { return { connected: true, ...(await reader()) }; }
  catch { return { connected: false, reason: 'unavailable', devices: [] }; }
}

/**
 * Observatoriet (/api/network/v1/snapshot) bygget fra list_devices når ingen
 * lokal snapshot-fil er satt opp. Monitoren gir bare «på nett» (sett siste 15
 * minutter) og en lesbar «sist sett»-tekst, ikke tidsstempler per enhet, så
 * last_seen er null og «nylig» betyr 15 minutter. Eier tas ikke med:
 * observatoriet viser tekniske observasjoner, ikke hvem som er hjemme.
 */
export const HJEMMENETT_RECENT_MINUTES = 15;
export function snapshotFromDevices(devices, fetchedAt) {
  const anyOnline = devices.some(d => d.online);
  return {
    schema_version: 1, snapshot_id: null, source: 'hjemmenett-monitor', recent_minutes: HJEMMENETT_RECENT_MINUTES,
    observed_at: fetchedAt, received_at: fetchedAt,
    // Minst én enhet sett siste 15 min betyr at innsamleren hjemme har rapportert i det tidsrommet.
    collector: { status: anyOnline ? 'ok' : 'unknown', last_seen: anyOnline ? fetchedAt : null },
    devices: devices.map(d => ({ id: d.id, label: d.name, last_seen: null, seen_text: d.status, status: d.online ? 'observed' : 'stale',
      source: 'hjemmenett', ip: d.ip, mac: d.id, manufacturer: null, category: d.category, room: d.room, dataLabel: d.dataLabel, dataBytes: d.dataBytes })),
    links: [], events: [], history: [], presence: []
  };
}

export async function readHjemmenettSnapshot() {
  const r = await readHjemmenettDevices();
  if (!r.connected) return { connected: false, reason: r.reason, snapshot: null };
  return { connected: true, snapshot: snapshotFromDevices(r.devices, r.fetchedAt) };
}

// ─── Mer innsikt til observatoriet ──────────────────────────────────────
// Bare lese-verktøy, bufret i 5 minutter så dashboardet ikke belaster monitoren.
const list = (v, max) => (Array.isArray(v) ? v : []).slice(0, max);
const LEVELS = new Set(['ok', 'tips', 'advarsel']);

export function normalizeOverview(health, top, fresh) {
  return {
    findings: list(health?.findings, 20).map(f => ({ level: LEVELS.has(f?.level) ? f.level : 'tips', title: text(f?.title, 120) || 'Funn', text: text(f?.text, 600), devices: list(f?.devices, 30).map(d => text(String(d), 80)).filter(Boolean) })),
    topData: list(top?.devices, 15).filter(d => mac(d?.mac)).map(d => ({ id: mac(d.mac), name: text(d.name) || 'Ukjent enhet', room: text(d.room, 80), amount: text(d.amount, 20), bytes: Number.isFinite(d.bytes) ? d.bytes : null })),
    newDevices: list(fresh?.devices, 50).filter(d => mac(d?.mac)).map(d => ({ id: mac(d.mac), ip: ip(d.ip), lastSeen: text(d.last_seen, 40) })),
    periodHours: Number.isInteger(health?.period_hours) ? health.period_hours : 24
  };
}

const overviewReader = cachedReader(async () => {
  const [health, top, fresh] = await Promise.all([callTool('network_health', { hours: 24 }), callTool('top_data_users', { hours: 24 }), callTool('new_devices')]);
  return { ...normalizeOverview(health, top, fresh), fetchedAt: new Date().toISOString() };
}, 300_000);

export async function readHjemmenettOverview() {
  if (process.env.DEMO_MODE === 'true') return { connected: false, reason: 'demo-isolation' };
  if (!hjemmenettConfigured()) return { connected: false, reason: 'not-configured' };
  try { return { connected: true, ...(await overviewReader()) }; }
  catch { return { connected: false, reason: 'unavailable' }; }
}

/**
 * Hva én enhet har brukt: mest brukte tjenester (7 døgn) og data per time
 * (siste døgn). Enkeltoppslag med tidspunkt (recent_lookups) tas bevisst ikke
 * med; det ville vært en tidslinje over hva noen gjør.
 */
export function normalizeActivity(raw) {
  if (!raw?.found) return { found: false };
  const services = list(raw.top_services_7_days, 15).map(s => ({ service: text(s?.service, 80), category: text(s?.category, 40), lookups: Number.isFinite(s?.lookups) ? s.lookups : null })).filter(s => s.service);
  return {
    found: true, services,
    background: list(raw.background_7_days, 10).map(s => ({ service: text(s?.service, 80), lookups: Number.isFinite(s?.lookups) ? s.lookups : null })).filter(s => s.service),
    data24h: raw.data_last_24h ? { downloaded: text(raw.data_last_24h.downloaded, 20), sent: text(raw.data_last_24h.sent, 20), noise: text(raw.data_last_24h.noise, 20) } : null,
    hourly: list(raw.hourly_data_last_24h, 24).map(h => ({ hour: text(h?.hour, 10), data: text(h?.data, 20), bytes: parseDataLabel(h?.data) })).filter(h => h.hour)
  };
}

const activityCache = new Map();
export async function readHjemmenettActivity(deviceMac) {
  const id = mac(deviceMac);
  if (!id) return { connected: false, reason: 'invalid' };
  if (process.env.DEMO_MODE === 'true') return { connected: false, reason: 'demo-isolation' };
  if (!hjemmenettConfigured()) return { connected: false, reason: 'not-configured' };
  const hit = activityCache.get(id);
  if (hit && Date.now() - hit.at < 120_000) return hit.value;
  try {
    const value = { connected: true, ...normalizeActivity(await callTool('device_activity', { device: id })), fetchedAt: new Date().toISOString() };
    activityCache.set(id, { at: Date.now(), value });
    if (activityCache.size > 200) activityCache.delete(activityCache.keys().next().value);
    return value;
  } catch { return { connected: false, reason: 'unavailable' }; }
}
