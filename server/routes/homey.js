import { Router } from 'express';
import { homeyClient, isConfigured } from '../lib/homeyClient.js';
import { cfg } from '../config.js';
import {
  MOCK_DEVICES,
  MOCK_ZONES,
  MOCK_FLOWS,
  mockEnergyReport,
  MOCK_ACTIVITY
} from '../lib/mockData.js';

export const homeyRoutes = Router();

const useDemo = () => {
  const v = cfg('DEMO_MODE');
  return v === true || v === 'true' || !isConfigured();
};

const safe = (handler, fallback) => async (req, res, next) => {
  try {
    if (useDemo()) return res.json(await fallback(req));
    const data = await handler(req);
    res.json(data);
  } catch (err) {
    console.warn('[homey] falling back to mock:', err.message);
    res.json({ ...(await fallback(req)), _fallback: true, _error: err.message });
  }
};

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
    return { devices: list, armed: false };
  },
  async () => {
    const list = Object.values(MOCK_DEVICES).filter(d => ['sensor', 'lock', 'camera'].includes(d.class));
    return { devices: list, armed: true, healthScore: 96 };
  }
));

homeyRoutes.post('/devices/:id/capability/:cap', async (req, res, next) => {
  try {
    const { id, cap } = req.params;
    const { value } = req.body;
    if (useDemo()) {
      const dev = MOCK_DEVICES[id];
      if (dev) {
        dev.capabilities[cap] = value;
        if (dev.capabilitiesObj[cap]) dev.capabilitiesObj[cap].value = value;
      }
      return res.json({ ok: true, mocked: true });
    }
    await homeyClient.setCapability(id, cap, value);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

homeyRoutes.post('/flows/:id/run', async (req, res, next) => {
  try {
    if (useDemo()) return res.json({ ok: true, mocked: true });
    await homeyClient.runFlow(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
