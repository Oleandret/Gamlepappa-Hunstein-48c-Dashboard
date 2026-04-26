import { Router } from 'express';
import { cfg, isDemoMode } from '../config.js';

export const systemRoutes = Router();

systemRoutes.get('/info', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    app: 'Gamlepappa Smarthus',
    house: cfg('HOME_PLACE') || 'Hunstein 48c',
    user: cfg('USER_NAME') || 'Ole',
    demo: isDemoMode(),
    homeyConfigured: Boolean(cfg('HOMEY_PAT')),
    version: '1.2.0',
    serverTime: new Date().toISOString()
  });
});
