import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getNamespace, updateNamespace } from '../lib/configStore.js';
import { residents as defaultResidents } from '../lib/residents.js';
import { messaging as defaultMessaging } from '../lib/messaging.js';
import { tilfeldigVits } from '../lib/vitser.js';

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
  // Et avvik må alltid ha med noe positivt om personen, så det ikke bare blir kritikk.
  const positivt = text(body?.positivt);
  if (!positivt) throw new Error('Skriv også noe positivt om hva personen har gjort');
  if (positivt.length > MAX_TEXT) throw new Error(`Det positive kan være maks ${MAX_TEXT} tegn`);
  const forslag = text(body?.forslag);
  if (forslag.length > MAX_TEXT) throw new Error(`Forslaget kan være maks ${MAX_TEXT} tegn`);
  const regelId = typeof body?.regelId === 'string' && /^[\w-]{1,100}$/.test(body.regelId) ? body.regelId : null;
  // SMS til den avviket gjelder er standard; den som registrerer kan ta det bort eller skrive om teksten.
  const sms = body?.sendSms !== false;
  const smsTekst = typeof body?.smsTekst === 'string' ? body.smsTekst.trim().slice(0, MAX_SMS) : '';
  return { id: randomUUID(), person, registrertAv, kategori, beskrivelse, positivt, forslag, regelId, opprettet: now.toISOString(), status: 'apen', lost: null, sms, smsTekst: smsTekst || null };
}

const MAX_SMS = 1000;
/** Standardteksten i SMS-en til den avviket gjelder; beskrivelsen og forslaget følger etter. */
export const avvikSmsIntro = person => `Hei ${person}, Gamlepappa har registrert ett avvik idag som går på trivsel i huset. Og håper du kan fikse:`;
/**
 * SMS-teksten: egen tekst hvis den som registrerte skrev om, ellers standardteksten. Til slutt en
 * tilfeldig liten vits, så det ikke blir vondt å få et avvik, og så lenken til avvikene.
 */
export function avvikSms(item, origin = '', { vits = tilfeldigVits() } = {}) {
  const tekst = item.smsTekst || [`${avvikSmsIntro(item.person)} ${item.beskrivelse}`, item.positivt ? `Og noe bra du har gjort: ${item.positivt}` : '', item.forslag ? `Forslag: ${item.forslag}` : '', `Registrert av ${item.registrertAv}.`].filter(Boolean).join('\n');
  return [tekst, vits ? `\nDagens vits: ${vits}` : '', origin ? `${origin}/avvik` : ''].filter(Boolean).join('\n');
}

/**
 * SMS til den avviket gjelder, hvis SMS er valgt på avviket og personen har telefon.
 * Returnerer varselstatusen som lagres på avviket.
 */
export async function notifyAvvik(item, { residents = defaultResidents, messaging = defaultMessaging, clock = () => new Date(), origin = () => process.env.AUTH_PUBLIC_ORIGIN || '' } = {}) {
  const at = () => clock().toISOString();
  if (item.sms === false) return { kanal: 'sms', status: 'valgt_bort', at: at() };
  if (!messaging.channels().sms) return { kanal: 'sms', status: 'ikke_satt_opp', at: at() };
  const b = (await residents.list()).find(r => r.navn === item.person);
  if (!b?.telefon) return { kanal: 'sms', status: 'mangler_telefon', at: at() };
  try { await messaging.sendSms(b.telefon, avvikSms(item, origin())); return { kanal: 'sms', status: 'sendt', at: at() }; }
  catch (e) { return { kanal: 'sms', status: 'feilet', feil: String(e.message || 'ukjent feil').slice(0, 200), at: at() }; }
}

// A suggestion can be proposed as a new house rule; it lands as 'forslag' until someone approves it.
const proposeToRules = rule => updateNamespace('_husregler', prev => [rule, ...list(prev)].slice(0, 1000));

export function createAvvikRoutes({ read = () => getNamespace(NS), update = fn => updateNamespace(NS, fn), proposeRule = proposeToRules, clock = () => new Date(), notify = item => notifyAvvik(item, { clock }) } = {}) {
  const r = Router();
  const payload = items => ({ items: list(items), residents: RESIDENTS, categories: CATEGORIES });

  r.get('/', async (_req, res) => {
    try { res.json(payload(await read())); }
    catch { res.status(503).json({ error: 'Avvikene kunne ikke leses' }); }
  });

  r.post('/', async (req, res) => {
    let item;
    // En innlogget beboer registrerer alltid i eget navn, uansett hva klienten sender.
    const body = req.user?.role === 'beboer' ? { ...req.body, registrertAv: req.user.navn } : req.body;
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
      // SMS sendes i bakgrunnen (telefonen bruker noen sekunder); resultatet lagres på avviket.
      const varsling = { kanal: 'sms', status: item.sms ? 'sender' : 'valgt_bort', at: clock().toISOString() };
      const saved = await update(prev => list(prev).map(a => a.id === item.id ? { ...a, varsel: varsling } : a)).catch(() => items);
      Promise.resolve().then(() => item.sms && notify(item)).then(varsel => {
        // Status og navn i loggen, aldri telefonnummer eller meldingstekst.
        if (varsel) console.info(`[avvik] sms til ${item.person}: ${varsel.status}${varsel.feil ? ` (${varsel.feil})` : ''}`);
        return varsel && update(prev => list(prev).map(a => a.id === item.id ? { ...a, varsel } : a));
      }).catch(() => {});
      res.status(201).json({ item: { ...item, varsel: varsling }, rule, ...payload(saved) });
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
