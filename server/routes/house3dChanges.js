import { Router } from 'express';
import { createHouse3dChanges } from '../lib/house3dChanges.js';

/**
 * /api/house3d/changes — endringsønsker for 3D-modellen.
 * GET: alle innloggede (og modellnøkkelen). POST/DELETE: admin.
 * PATCH (status, notat, PR-lenke): admin og modellnøkkelen (HOUSE3D_CHANGES_TOKEN).
 */
export function createHouse3dChangeRoutes({ store = createHouse3dChanges() } = {}) {
  const r = Router();
  const fail = (res, err) => res.status(err.status || 500).json({ error: err.status ? err.message : 'Ønsket kunne ikke lagres' });
  r.get('/', async (_req, res) => { try { res.json({ items: await store.list() }); } catch (e) { fail(res, e); } });
  r.post('/', async (req, res) => {
    try { res.status(201).json(await store.add({ target: req.body?.target, text: req.body?.text, by: req.user?.email })); } catch (e) { fail(res, e); }
  });
  r.patch('/:id', async (req, res) => { try { res.json(await store.patch(req.params.id, req.body || {})); } catch (e) { fail(res, e); } });
  r.delete('/:id', async (req, res) => { try { await store.remove(req.params.id); res.json({ ok: true }); } catch (e) { fail(res, e); } });
  return r;
}

export const house3dChangeRoutes = createHouse3dChangeRoutes();
