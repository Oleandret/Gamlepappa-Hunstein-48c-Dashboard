import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getNamespace, updateNamespace } from '../lib/configStore.js';
import { RESIDENTS, CATEGORIES } from './avvik.js';

// Huset: felles husregler og gjøremål per beboer (også gjentakende), i samme
// system som avvikene. Hver endring er én atomisk operasjon i config-storen.
export const RECURRENCE = ['ingen', 'daglig', 'ukentlig', 'annenhver-uke', 'maanedlig'];
const RULE_STATUS = ['gjeldende', 'forslag'];
const MAX_ITEMS = 1000, MAX_HISTORY = 200, MAX_TEXT = 500;
const list = v => Array.isArray(v) ? v : [];
const text = v => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
const bad = message => Object.assign(new Error(message), { status: 400 });
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
export const osloToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

function addDays(date, days) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function addMonth(date) {
  const [y, m, d] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
}
// Next due date after completing: step from the current due date until it is after today.
export function nextDue(frist, gjentakelse, today) {
  const step = { daglig: d => addDays(d, 1), ukentlig: d => addDays(d, 7), 'annenhver-uke': d => addDays(d, 14), maanedlig: addMonth }[gjentakelse];
  if (!step) return null;
  let next = step(frist);
  for (let i = 0; next <= today && i < 1000; i++) next = step(next);
  return next;
}

export function parseRule(body, now = new Date()) {
  const tekst = text(body?.tekst), av = text(body?.av), kategori = text(body?.kategori) || 'Annet';
  const status = body?.status === 'forslag' ? 'forslag' : 'gjeldende';
  if (!tekst) throw bad('Skriv husregelen');
  if (tekst.length > MAX_TEXT) throw bad(`Husregelen kan være maks ${MAX_TEXT} tegn`);
  if (!RESIDENTS.includes(av)) throw bad('Velg hvem som legger inn regelen');
  if (!CATEGORIES.includes(kategori)) throw bad('Ukjent kategori');
  return { id: randomUUID(), tekst, kategori, status, av, opprettet: now.toISOString() };
}

export function parseTask(body, now = new Date()) {
  const tittel = text(body?.tittel), ansvarlig = text(body?.ansvarlig), av = text(body?.av), notat = text(body?.notat);
  const kategori = text(body?.kategori) || 'Annet', gjentakelse = text(body?.gjentakelse) || 'ingen';
  const frist = text(body?.frist) || osloToday(now);
  if (!tittel) throw bad('Skriv hva som skal gjøres');
  if (tittel.length > 200) throw bad('Gjøremålet kan være maks 200 tegn');
  if (notat.length > MAX_TEXT) throw bad(`Notatet kan være maks ${MAX_TEXT} tegn`);
  if (!RESIDENTS.includes(ansvarlig)) throw bad('Velg hvem som er ansvarlig');
  if (!RESIDENTS.includes(av)) throw bad('Velg hvem som legger inn gjøremålet');
  if (!CATEGORIES.includes(kategori)) throw bad('Ukjent kategori');
  if (!RECURRENCE.includes(gjentakelse)) throw bad('Ukjent gjentakelse');
  if (!isDate(frist)) throw bad('Ugyldig frist');
  return { id: randomUUID(), tittel, ansvarlig, kategori, gjentakelse, frist, notat, av, opprettet: now.toISOString(), status: 'aktiv', fullfort: [] };
}

// Store helpers shared with the avvik route (a suggestion can become a proposed rule).
export const rulesStore = { read: () => getNamespace('_husregler'), update: fn => updateNamespace('_husregler', fn) };
export const tasksStore = { read: () => getNamespace('_gjoremal'), update: fn => updateNamespace('_gjoremal', fn) };

export function createHusetRoutes({ rules = rulesStore, tasks = tasksStore, clock = () => new Date() } = {}) {
  const r = Router();
  const handle = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (e) { res.status([400, 404].includes(e.status) ? e.status : 503).json({ error: [400, 404].includes(e.status) ? e.message : 'Kunne ikke lagre. Prøv igjen.' }); }
  };
  const meta = { residents: RESIDENTS, categories: CATEGORIES, recurrence: RECURRENCE };
  const notFound = () => Object.assign(new Error('Finnes ikke'), { status: 404 });
  function edit(store, id, fn) {
    let found = false;
    return store.update(prev => list(prev).map(x => { if (x.id !== id) return x; found = true; return fn(x); })).then(items => { if (!found) throw notFound(); return items; });
  }
  function remove(store, id) {
    let found = false;
    return store.update(prev => list(prev).filter(x => { if (x.id === id) { found = true; return false; } return true; })).then(items => { if (!found) throw notFound(); return items; });
  }
  const add = (store, item) => store.update(prev => { if (list(prev).length >= MAX_ITEMS) throw bad('Listen er full'); return [item, ...list(prev)]; });

  r.get('/', handle(async (_req, res) => {
    const [rl, tl] = await Promise.all([rules.read(), tasks.read()]);
    res.json({ ...meta, today: osloToday(clock()), rules: list(rl), tasks: list(tl) });
  }));

  r.post('/regler', handle(async (req, res) => res.status(201).json({ rules: await add(rules, parseRule(req.body, clock())) })));
  r.patch('/regler/:id', handle(async (req, res) => {
    const patch = {};
    if (req.body?.status !== undefined) { if (!RULE_STATUS.includes(req.body.status)) throw bad('Ugyldig status'); patch.status = req.body.status; }
    if (req.body?.tekst !== undefined) { const t = text(req.body.tekst); if (!t || t.length > MAX_TEXT) throw bad('Ugyldig tekst'); patch.tekst = t; }
    res.json({ rules: await edit(rules, req.params.id, x => ({ ...x, ...patch })) });
  }));
  r.delete('/regler/:id', handle(async (req, res) => res.json({ rules: await remove(rules, req.params.id) })));

  r.post('/gjoremal', handle(async (req, res) => res.status(201).json({ tasks: await add(tasks, parseTask(req.body, clock())) })));
  r.post('/gjoremal/:id/fullfor', handle(async (req, res) => {
    const av = text(req.body?.av);
    if (!RESIDENTS.includes(av)) throw bad('Velg hvem som gjorde det');
    const now = clock(), today = osloToday(now);
    res.json({ tasks: await edit(tasks, req.params.id, t => {
      if (t.status !== 'aktiv') throw bad('Gjøremålet er allerede ferdig');
      const fullfort = [{ dato: today, frist: t.frist, av, at: now.toISOString() }, ...list(t.fullfort)].slice(0, MAX_HISTORY);
      const next = nextDue(t.frist, t.gjentakelse, today);
      return next ? { ...t, frist: next, fullfort } : { ...t, status: 'ferdig', fullfort };
    }) });
  }));
  r.patch('/gjoremal/:id', handle(async (req, res) => {
    const patch = {};
    if (req.body?.ansvarlig !== undefined) { if (!RESIDENTS.includes(req.body.ansvarlig)) throw bad('Ukjent beboer'); patch.ansvarlig = req.body.ansvarlig; }
    if (req.body?.frist !== undefined) { if (!isDate(req.body.frist)) throw bad('Ugyldig frist'); patch.frist = req.body.frist; }
    if (req.body?.status !== undefined) { if (!['aktiv', 'ferdig'].includes(req.body.status)) throw bad('Ugyldig status'); patch.status = req.body.status; }
    res.json({ tasks: await edit(tasks, req.params.id, x => ({ ...x, ...patch })) });
  }));
  r.delete('/gjoremal/:id', handle(async (req, res) => res.json({ tasks: await remove(tasks, req.params.id) })));
  return r;
}
export const husetRoutes = createHusetRoutes();
