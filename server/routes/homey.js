import {createInventoryReader} from '../lib/inventoryReader.js';
import { recordAction } from '../lib/audit.js';
import { capValue } from '../lib/validation.js';
import { Router } from 'express';
import { homeyClient, motionHistory } from '../lib/homeyClient.js';
import { isDemoMode } from '../config.js';
import { buildInventory } from '../lib/inventory.js';
import {
  MOCK_DEVICES,
  MOCK_ZONES,
  MOCK_FLOWS,
  mockEnergyReport,
  MOCK_ACTIVITY
} from '../lib/mockData.js';

export const homeyRoutes = Router();

const safe = (handler, fallback) => {
  const snapshots = new Map();
  return async (req, res) => {
    const key = req.originalUrl;
    if (isDemoMode()) return res.json({ ...(await fallback(req)), _quality: 'demo', _updatedAt: null });
    try {
      const data = await handler(req);
      const updatedAt = new Date().toISOString();
      snapshots.set(key, { data, updatedAt });
      if (snapshots.size > 50) snapshots.delete(snapshots.keys().next().value);
      res.json({ ...data, _quality: 'live', _updatedAt: updatedAt });
    } catch (err) {
      const previous = snapshots.get(key);
      const recent = previous && Date.now() - Date.parse(previous.updatedAt) < 5 * 60_000;
      res.status(recent ? 200 : 503).json({ ...(recent ? previous.data : {}),
        _quality: recent ? 'stale' : 'unavailable', _updatedAt: previous?.updatedAt || null,
        error: 'Homey-data er ikke tilgjengelige', _error: sanitizeMessage(err.message) });
    }
  };
};

function sanitizeMessage(s) {
  if (typeof s !== 'string') return 'unknown';
  return s.replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer ***')
          .replace(/\b[A-Za-z0-9_\-]{32,}\b/g, '***')
          .slice(0, 200);
}

homeyRoutes.get('/motion-history',async(_req,res)=>{try{const state=await motionHistory.read();const zones=await homeyClient.listZones().catch(()=>({}));res.json({startedAt:state.startedAt,retentionDays:7,limit:2000,events:state.events.slice().reverse().map(e=>({...e,room:zones[e.zone]?.name||'Ukjent rom'}))});}catch{res.status(503).json({error:'Bevegelseslogg utilgjengelig'});}});

// ── Reads ────────────────────────────────────────────────────────────────

homeyRoutes.get('/zones', safe(
  async () => ({ zones: await homeyClient.listZones() }),
  async () => ({ zones: MOCK_ZONES })
));

homeyRoutes.get('/devices', safe(
  async () => ({ devices: await homeyClient.listDevices() }),
  async () => ({ devices: MOCK_DEVICES })
));

// Explicit local snapshot import, never a Tesla request or a Homey command.
homeyRoutes.post('/tesla/:id/refresh', async (req,res) => {
  try {
    const result=await homeyClient.updateTeslaSnapshot(req.params.id);
    res.json(result);
  } catch(error) { res.status(error.status===409?409:503).json({error:'Ingen lagrede Tesla-data tilgjengelig fra Homey. Prøv senere.'}); }
});

homeyRoutes.get('/flows', safe(
  async () => ({ flows: await homeyClient.listFlows() }),
  async () => ({ flows: MOCK_FLOWS })
));

homeyRoutes.get('/energy', safe(
  async () => ({ report: await homeyClient.getEnergyReport('today') }),
  async () => ({ report: mockEnergyReport() })
));

homeyRoutes.get('/activity', safe(
  async () => ({ activity: [] }),
  async () => ({ activity: MOCK_ACTIVITY })
));

/** Inventory: total opptelling av alle devices/zones/flows + capability-statistikk
 *  Pass ?full=true for å inkludere raw devices/zones/flows (større respons). */
const inventoryRead=createInventoryReader(homeyClient);
homeyRoutes.get('/inventory',async(req,res)=>{
 if(isDemoMode()){const data=buildInventory({devices:MOCK_DEVICES,zones:MOCK_ZONES,flows:MOCK_FLOWS});return res.json({...data,_quality:'demo',_updatedAt:null});}
 try{const result=await inventoryRead(req.query.full==='true');res.status(result.status).json(result.body);}catch{res.status(503).json({error:'Kartlegging kunne ikke bygges',_quality:'unavailable'});}
});

homeyRoutes.get('/security', safe(
  async () => {
    const devices = await homeyClient.listDevices();
    const list = Object.values(devices).filter(d => ['sensor', 'lock', 'camera'].includes(d.class));
    return { devices: list, armed: null, healthScore: computeHealthScore(list) };
  },
  async () => {
    const list = Object.values(MOCK_DEVICES).filter(d => ['sensor', 'lock', 'camera'].includes(d.class));
    return { devices: list, armed: true, healthScore: computeHealthScore(list) };
  }
));

function computeHealthScore(devices) {
  if (!devices.length) return 0;
  const offline = devices.filter(d => d.available === false).length;
  const lowBattery = devices.filter(d => (d.capabilitiesObj?.alarm_battery?.value ?? d.capabilities?.alarm_battery) === true).length;
  const score = 100 - (offline * 8) - (lowBattery * 4);
  return Math.max(0, Math.min(100, score));
}

// ── Writes ───────────────────────────────────────────────────────────────

const MAX_ID_LEN = 64;
const VALID_ID = /^[a-zA-Z0-9_\-:.]{1,64}$/;

function validateIds(...ids) {
  for (const id of ids) {
    if (typeof id !== 'string' || !VALID_ID.test(id) || id.length > MAX_ID_LEN) {
      return false;
    }
  }
  return true;
}

function isValidCapabilityValue(v) {
  if (v === null) return false;
  const t = typeof v;
  if (t === 'boolean' || t === 'string') return true;
  if (t === 'number') return Number.isFinite(v);
  return false;
}

function commandError(res, err) {
  if (err.status === 400) return res.status(400).json({ error: err.message, code: 'INVALID_CAPABILITY' });
  if (err.status === 429) return res.status(429).json({ error: 'Kommandokøen er full. Vent før du prøver igjen.', code: 'QUEUE_FULL' });
  return res.status(502).json({ error: 'Resultatet fra Homey er ukjent. Kontroller enheten før du prøver igjen.', code: 'RESULT_UNKNOWN' });
}

async function recordResult(kind, detail, status, actor) {
  try { await recordAction(kind, detail, status, actor); }
  catch {
    // Homey has already accepted the command. Never turn a logging failure into
    // a failed command response that invites repeating a physical action.
    console.warn('[homey] accepted command could not be recorded');
    return 'Kommando mottatt, men resultatet kunne ikke lagres i aktivitetsloggen';
  }
}

homeyRoutes.post('/devices/:id/capability/:cap', async (req, res) => {
  const { id, cap } = req.params;
  const { value } = req.body || {};

  if (!validateIds(id, cap)) {
    return res.status(400).json({ error: 'invalid device or capability id' });
  }
  if (!isValidCapabilityValue(value)) {
    return res.status(400).json({ error: 'capability value must be boolean, string, or finite number' });
  }
  // String values can't be longer than ~256 chars (covers RGB hex / scenes)
  if (typeof value === 'string' && value.length > 256) {
    return res.status(400).json({ error: 'string value too long' });
  }

  try {
    if (isDemoMode()) {
      const dev = MOCK_DEVICES[id];
      if (dev) {
        dev.capabilities[cap] = value;
        if (dev.capabilitiesObj?.[cap]) dev.capabilitiesObj[cap].value = value;
      }
      return res.json({ ok: true, mocked: true });
    }
    const auditId = await recordAction('device_command', {deviceId:id, capability:cap, value}, 'pending', req.user?.role || 'unknown');
    await homeyClient.setCapability(id, cap, value);
    const fresh = await homeyClient.refreshDevices().catch(() => null);
    const confirmed = fresh ? capValue(fresh[id],cap) === value : false;
    const warning = await recordResult('device_result', {commandId:auditId,deviceId:id,capability:cap,value}, confirmed?'confirmed':'unconfirmed', req.user?.role || 'unknown');
    res.json({ ok: true, confirmed, commandId: auditId, ...(warning ? {warning} : {}) });
  } catch (err) {
    console.warn('[homey] setCapability failed:', sanitizeMessage(err.message));
    commandError(res, err);
  }
});

homeyRoutes.post('/flows/:id/run', async (req, res) => {
  const { id } = req.params;
  if (!validateIds(id)) {
    return res.status(400).json({ error: 'invalid flow id' });
  }
  try {
    if (isDemoMode()) return res.json({ ok: true, mocked: true });
    await recordAction('flow_request', {flowId:id}, 'pending', req.user?.role || 'unknown');
    await homeyClient.runFlow(id);
    const warning = await recordResult('flow_result', {flowId:id}, 'accepted', req.user?.role || 'unknown');
    res.json({ ok:true, confirmed:false, ...(warning ? {warning} : {}) });
  } catch (err) {
    console.warn('[homey] runFlow failed:', sanitizeMessage(err.message));
    commandError(res, err);
  }
});
