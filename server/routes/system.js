import { Router } from 'express';
import { cfg, isDemoMode } from '../config.js';

export const systemRoutes = Router();

systemRoutes.get('/info', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    app: 'NEXORA',
    house: cfg('HOME_PLACE') || 'Hunstein 48c',
    user: cfg('USER_NAME') || 'Ole',
    demo: isDemoMode(),
    homeyConfigured: Boolean(cfg('HOMEY_PAT')),
    version: '1.1.0',
    serverTime: new Date().toISOString()
  });
});
