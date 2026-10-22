import { Router } from 'express';
import { getAll, getNamespace, setNamespace, deleteNamespace } from '../lib/configStore.js';

export const configRoutes = Router();

// Tillat-listede namespace-nøkler. Forhindrer at klienten kan lagre vilkårlige
// keys og fylle opp lagringa.
const ALLOWED_NS = new Set([
  'flowOrganization',
  'floorPlanDrafts',
  'pinConfig',          // HouseView pins på framsiden
  'frontImageConfig',   // bilde-størrelse
  'frontSensors',       // sensor-widget-rad
  'flowFavorites',      // stjernede flows
  'links',              // lenker-fanen
  'floorPlanPins',      // pins på plantegninger
  'floorPlanFlows',     // favoritt-flows per plantegning
  'house3dRooms',       // kobling rom i 3D-modellen ↔ Homey-soner
  'house3dDoors',       // kobling dører i 3D-modellen ↔ dør-/portsensorer
  'house3dEdits',       // flyttet/snudd/fjernet inventar, lyspunkter og BIM-elementer i 3D-modellen
  'flowsSidebarFlows',  // brukervalgte flows i høyre-sidebar (kommer senere)
  'frontSpecials',      // hvilke spesial-kort (Tesla/Tibber/Støvsuger) som vises på Oversikt
  'scenes',
  'aiModels'            // hvilken OpenAI-modell som brukes for chat og suggestion-engine
]);

function valid(ns) { return ALLOWED_NS.has(ns); }

// Hent ALL config (én round-trip på app-start)
configRoutes.get('/', async (_req, res, next) => {
  try {
    const all = await getAll();
    res.json(Object.fromEntries(Object.entries(all).filter(([key])=>valid(key))));
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
    if (req.body.value === null || typeof req.body.value !== 'object' || JSON.stringify(req.body.value).length > 64000) return res.status(400).json({error:'Ugyldig konfigurasjon'});
    if (req.params.ns === 'scenes') return res.status(400).json({error:'Bruk stemningseditoren'});
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
