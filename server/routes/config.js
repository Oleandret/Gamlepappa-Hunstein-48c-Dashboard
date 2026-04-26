import { Router } from 'express';
import { getAll, getNamespace, setNamespace, deleteNamespace } from '../lib/configStore.js';

export const configRoutes = Router();

// Tillat-listede namespace-nøkler. Forhindrer at klienten kan lagre vilkårlige
// keys og fylle opp lagringa.
const ALLOWED_NS = new Set([
  'pinConfig',          // HouseView pins på framsiden
  'frontImageConfig',   // bilde-størrelse
  'frontSensors',       // sensor-widget-rad
  'flowFavorites',      // stjernede flows
  'links',              // lenker-fanen
  'floorPlanPins',      // pins på plantegninger
  'flowsSidebarFlows'   // brukervalgte flows i høyre-sidebar (kommer senere)
]);

function valid(ns) { return ALLOWED_NS.has(ns); }

// Hent ALL config (én round-trip på app-start)
configRoutes.get('/', async (_req, res, next) => {
  try {
    const all = await getAll();
    res.json(all);
  } catch (err) { next(err); }
});

// Hent ett namespace
configRoutes.get('/:ns', async (req, res, next) => {
  try {
    if (!valid(req.params.ns)) return res.status(400).json({ error: 'unknown namespace' });
    const value = await getNamespace(req.params.ns);
    res.json({ value: value ?? null });
  } catch (err) { next(err); }
});

// Lagre ett namespace
configRoutes.put('/:ns', async (req, res, next) => {
  try {
    if (!valid(req.params.ns)) return res.status(400).json({ error: 'unknown namespace' });
    if (!('value' in (req.body || {}))) return res.status(400).json({ error: 'missing body.value' });
    const saved = await setNamespace(req.params.ns, req.body.value);
    res.json({ value: saved });
  } catch (err) { next(err); }
});

// Slett ett namespace (reset til default)
configRoutes.delete('/:ns', async (req, res, next) => {
  try {
    if (!valid(req.params.ns)) return res.status(400).json({ error: 'unknown namespace' });
    await deleteNamespace(req.params.ns);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
