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
  const forslag = text(body?.forslag);
  if (forslag.length > MAX_TEXT) throw new Error(`Forslaget kan være maks ${MAX_TEXT} tegn`);
  const regelId = typeof body?.regelId === 'string' && /^[\w-]{1,100}$/.test(body.regelId) ? body.regelId : null;
  return { id: randomUUID(), person, registrertAv, kategori, beskrivelse, forslag, regelId, opprettet: now.toISOString(), status: 'apen', lost: null };
}

// A suggestion can be proposed as a new house rule; it lands as 'forslag' until someone approves it.
const proposeToRules = rule => updateNamespace('_husregler', prev => [rule, ...list(prev)].slice(0, 1000));

export function createAvvikRoutes({ read = () => getNamespace(NS), update = fn => updateNamespace(NS, fn), proposeRule = proposeToRules, clock = () => new Date() } = {}) {
  const r = Router();
  const payload = items => ({ items: list(items), residents: RESIDENTS, categories: CATEGORIES });

  r.get('/', async (_req, res) => {
    try { res.json(payload(await read())); }
    catch { res.status(503).json({ error: 'Avvikene kunne ikke leses' }); }
  });

  r.post('/', async (req, res) => {
    let item;
    // En innlogget beboer registrerer alltid i eget navn, uansett hva klienten sender.
    const body = req.user?.method === 'beboer' ? { ...req.body, registrertAv: req.user.navn } : req.body;
    try { item = parseAvvik(body, clock()); }
    catch (err) { return res.status(400).json({ error: err.message }); }
    try {
      const items = await update(prev => {
        if (list(prev).length >= MAX_ITEMS) throw new Error('full');
        return [item, ...list(prev)];
      });
      let rule = null;
      if (req.body?.foreslaRegel === true && item.forslag) {
        rule = { id: randomUUID(), tekst: item.forslag, kategori: item.kategori, status: 'forslag', av: item.registrertAv, opprettet: item.opprettet, fraAvvik: item.id };
        await proposeRule(rule).catch(() => { rule = null; });
      }
      res.status(201).json({ item, rule, ...payload(items) });
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
