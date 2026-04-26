import { Router } from 'express';
import { homeyClient } from '../lib/homeyClient.js';
import { isDemoMode } from '../config.js';
import {
  MOCK_DEVICES,
  MOCK_ZONES,
  MOCK_FLOWS,
  mockEnergyReport,
  MOCK_ACTIVITY
} from '../lib/mockData.js';

export const homeyRoutes = Router();

const safe = (handler, fallback) => async (req, res) => {
  try {
    if (isDemoMode()) return res.json(await fallback(req));
    const data = await handler(req);
    res.json(data);
  } catch (err) {
    console.warn('[homey] falling back to mock:', sanitizeMessage(err.message));
    res.json({
      ...(await fallback(req)),
      _fallback: true,
      _error: sanitizeMessage(err.message)
    });
  }
};

function sanitizeMessage(s) {
  if (typeof s !== 'string') return 'unknown';
  return s.replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer ***')
          .replace(/\b[A-Za-z0-9_\-]{32,}\b/g, '***')
          .slice(0, 200);
}

// ── Reads ────────────────────────────────────────────────────────────────

homeyRoutes.get('/zones', safe(
  async () => ({ zones: await homeyClient.listZones() }),
  async () => ({ zones: MOCK_ZONES })
));

homeyRoutes.get('/devices', safe(
  async () => ({ devices: await homeyClient.listDevices() }),
  async () => ({ devices: MOCK_DEVICES })
));

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

homeyRoutes.get('/security', safe(
  async () => {
    const devices = await homeyClient.listDevices();
    const list = Object.values(devices).filter(d => ['sensor', 'lock', 'camera'].includes(d.class));
    return { devices: list, armed: false, healthScore: computeHealthScore(list) };
  },
  async () => {
    const list = Object.values(MOCK_DEVICES).filter(d => ['sensor', 'lock', 'camera'].includes(d.class));
    return { devices: list, armed: true, healthScore: computeHealthScore(list) };
  }
));

function computeHealthScore(devices) {
  if (!devices.length) return 0;
  const offline = devices.filter(d => d.available === false).length;
  const lowBattery = devices.filter(d => d.capabilities?.alarm_battery === true).length;
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
    await homeyClient.setCapability(id, cap, value);
    res.json({ ok: true });
  } catch (err) {
    console.warn('[homey] setCapability failed:', sanitizeMessage(err.message));
    res.status(502).json({ error: 'homey unreachable' });
  }
});

homeyRoutes.post('/flows/:id/run', async (req, res) => {
  const { id } = req.params;
  if (!validateIds(id)) {
    return res.status(400).json({ error: 'invalid flow id' });
  }
  try {
    if (isDemoMode()) return res.json({ ok: true, mocked: true });
    await homeyClient.runFlow(id);
    res.json({ ok: true });
  } catch (err) {
    console.warn('[homey] runFlow failed:', sanitizeMessage(err.message));
    res.status(502).json({ error: 'homey unreachable' });
  }
});
