import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getNamespace, updateNamespace } from '../lib/configStore.js';

// Avvik for bedre livskvalitet: små ting beboerne gjør feil i huset, registrert
// så det blir bedre å bo her. Lagres i config-storen, men ikke via /api/config,
// så hver endring er én atomisk operasjon og ikke en overskriving av hele lista.
export const RESIDENTS = ['Ole Andre', 'Ingvild', 'Ylva', 'Vetle', 'Andrea', 'Vendela', 'Viljar'];
export const CATEGORIES = ['Kjøkken', 'Rydding', 'Bad', 'Lys og strøm', 'Dører og vinduer', 'Klesvask', 'Støy', 'Annet'];
const NS = '_avvik';
const MAX_ITEMS = 2000;
const MAX_TEXT = 500;

const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

export function parseAvvik(body, now = new Date()) {
  const person = text(body?.person);
  const registrertAv = text(body?.registrertAv);
  const beskrivelse = text(body?.beskrivelse);
  const kategori = text(body?.kategori) || 'Annet';
  if (!RESIDENTS.includes(person)) throw new Error('Velg hvem avviket gjelder');
  if (!RESIDENTS.includes(registrertAv)) throw new Error('Velg hvem som registrerer');
  if (!CATEGORIES.includes(kategori)) throw new Error('Ukjent kategori');
  if (!beskrivelse) throw new Error('Skriv hva som skjedde');
  if (beskrivelse.length > MAX_TEXT) throw new Error(`Beskrivelsen kan være maks ${MAX_TEXT} tegn`);
  return { id: randomUUID(), person, registrertAv, kategori, beskrivelse, opprettet: now.toISOString(), status: 'apen', lost: null };
}

export function createAvvikRoutes({ read = () => getNamespace(NS), update = fn => updateNamespace(NS, fn), clock = () => new Date() } = {}) {
  const r = Router();
  const payload = items => ({ items: list(items), residents: RESIDENTS, categories: CATEGORIES });

  r.get('/', async (_req, res) => {
    try { res.json(payload(await read())); }
    catch { res.status(503).json({ error: 'Avvikene kunne ikke leses' }); }
  });

  r.post('/', async (req, res) => {
    let item;
    try { item = parseAvvik(req.body, clock()); }
    catch (err) { return res.status(400).json({ error: err.message }); }
    try {
      const items = await update(prev => {
        if (list(prev).length >= MAX_ITEMS) throw new Error('full');
        return [item, ...list(prev)];
      });
      res.status(201).json({ item, ...payload(items) });
    } catch { res.status(503).json({ error: 'Avviket kunne ikke lagres' }); }
  });

  r.patch('/:id', async (req, res) => {
    const status = req.body?.status;
    if (!['apen', 'lost'].includes(status)) return res.status(400).json({ error: 'Ugyldig status' });
    let found = false;
    try {
      const items = await update(prev => list(prev).map(a => {
        if (a.id !== req.params.id) return a;
        found = true;
        return { ...a, status, lost: status === 'lost' ? clock().toISOString() : null };
      }));
      if (!found) return res.status(404).json({ error: 'Avviket finnes ikke' });
      res.json(payload(items));
    } catch { res.status(503).json({ error: 'Avviket kunne ikke oppdateres' }); }
  });

  r.delete('/:id', async (req, res) => {
    let found = false;
    try {
      const items = await update(prev => list(prev).filter(a => {
        if (a.id === req.params.id) { found = true; return false; }
        return true;
      }));
      if (!found) return res.status(404).json({ error: 'Avviket finnes ikke' });
      res.json(payload(items));
    } catch { res.status(503).json({ error: 'Avviket kunne ikke slettes' }); }
  });

  return r;
}
export const avvikRoutes = createAvvikRoutes();
