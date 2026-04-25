import { Router } from 'express';
import { isConfigured } from '../lib/homeyClient.js';
import { cfg } from '../config.js';

export const systemRoutes = Router();

systemRoutes.get('/info', (_req, res) => {
  const demo = cfg('DEMO_MODE') === true || cfg('DEMO_MODE') === 'true' || !isConfigured();
  res.json({
    app: 'NEXORA',
    house: cfg('HOME_PLACE') || 'Hunstein 48c',
    user: cfg('USER_NAME') || 'Ole',
    demo,
    homeyConfigured: isConfigured(),
    version: '1.0.0',
    serverTime: new Date().toISOString()
  });
});
