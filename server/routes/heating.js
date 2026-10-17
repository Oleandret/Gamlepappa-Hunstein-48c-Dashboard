import { Router } from 'express';
import { createMyUplinkReader } from '../lib/myuplinkReader.js';

// Deliberately disabled: no credential lookup or grant until separately approved.
export function createHeatingRoutes(read = createMyUplinkReader()) {
  const router = Router();
  router.get('/', async (_req, res, next) => {
    try { res.json({ ...await read(), model: 'NIBE F1255-12 R EM', executionEnabled: false, oauthReady: false }); }
    catch { next(Object.assign(new Error('Varmedata er utilgjengelig'), { status: 503 })); }
  });
  router.all('*', (_req, res) => res.status(405).set('Allow', 'GET, HEAD').json({ error: 'Varmestyring støtter bare lesing' }));
  return router;
}
export const heatingRoutes = createHeatingRoutes();
