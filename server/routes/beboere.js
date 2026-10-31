import { Router } from 'express';
import { isOwner } from '../lib/auth.js';
import { residents as defaultResidents } from '../lib/residents.js';
import { reminders as defaultReminders } from '../lib/reminders.js';
import { messaging as defaultMessaging } from '../lib/messaging.js';
import { iphoneSms as defaultIphoneSms } from '../lib/iphoneSms.js';
import { normalizePhone } from '../lib/residents.js';
import { vigilo as defaultVigilo } from '../lib/vigilo.js';

// Beboernes kontaktinfo, innlogging og påminnelser. Personopplysninger: bare eierens egen Google-innlogging.
export function createBeboerRoutes({ residents = defaultResidents, reminders = defaultReminders, messaging = defaultMessaging, owner = isOwner, iphoneSms = defaultIphoneSms, vigilo = defaultVigilo } = {}) {
  const r = Router();
  r.use((req, res, next) => owner(req) ? next() : res.status(403).json({ error: 'Bare eieren kan se og endre beboernes kontaktinfo' }));
  const handle = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (e) { res.status([400, 404].includes(e.status) ? e.status : 503).json({ error: [400, 404].includes(e.status) ? e.message : 'Kunne ikke fullføre. Prøv igjen.' }); }
  };
  const overview = async () => ({ beboere: await residents.list(), kanaler: messaging.channels(), paaminnelser: await reminders.settings(), logg: await reminders.log(50) });
  r.get('/', handle(async (_req, res) => res.json(await overview())));

  // «Send SMS med iPhone»: test koblingen (sender ingenting) og send én SMS, med steg-logg.
  const smsRun = fn => async (req, res) => {
    const steps = [], step = t => steps.push({ at: new Date().toISOString(), tekst: t });
    if (!iphoneSms.configured()) return res.json({ ok: false, configured: false, steps, error: 'SMS via iPhonen er ikke satt opp' });
    try { const result = await fn(req, step); res.json({ ok: true, configured: true, steps, ...(result || {}) }); }
    catch (e) { res.json({ ok: false, configured: true, steps, error: String(e.message || 'Ukjent feil').slice(0, 300) }); }
  };
  r.post('/sms/test', smsRun((_req, step) => iphoneSms.check({ onStep: step })));
  r.post('/sms/send', async (req, res, next) => {
    const to = normalizePhone(String(req.body?.til || '')), text = typeof req.body?.tekst === 'string' ? req.body.tekst.trim() : '';
    if (!to) return res.status(400).json({ error: 'Ugyldig telefonnummer. Bruk 8 siffer eller +landskode.' });
    if (!text || text.length > 1000) return res.status(400).json({ error: 'Skriv en melding (maks 1000 tegn)' });
    return smsRun((_r, step) => iphoneSms.send(to, text, { onStep: step }).then(() => ({ til: to })))(req, res, next);
  });
  r.put('/beboer/:navn', handle(async (req, res) => { await residents.updateContact(req.params.navn, req.body); res.json(await overview()); }));
  r.post('/beboer/:navn/invitasjon', handle(async (req, res) => res.json(await residents.createInvite(req.params.navn))));
  r.delete('/beboer/:navn/passord', handle(async (req, res) => { await residents.removePassword(req.params.navn); res.json(await overview()); }));
  r.put('/paaminnelser', handle(async (req, res) => { await reminders.saveSettings(req.body); res.json(await overview()); }));
  r.post('/paaminnelser/test', handle(async (req, res) => { const sendt = await reminders.run({ only: req.body?.navn, always: true, source: 'test' }); res.json({ ...(await overview()), sendt }); }));
  r.post('/paaminnelser/kjor', handle(async (_req, res) => { const sendt = await reminders.run({ source: 'manuell' }); res.json({ ...(await overview()), sendt }); }));

  // Vigilo: innstillinger, meldingene som er lest, kjøringsloggen, og «Les nå».
  const vigiloView = async () => ({ configured: vigilo.configured(), pinSet: vigilo.pinSet(), innstillinger: await vigilo.settings(), meldinger: await vigilo.messages(), logg: await vigilo.log(), kanaler: messaging.channels(), beboere: await residents.list() });
  r.get('/vigilo', handle(async (_req, res) => res.json(await vigiloView())));
  r.put('/vigilo', handle(async (req, res) => { await vigilo.saveSettings(req.body); res.json(await vigiloView()); }));
  r.post('/vigilo/les', handle(async (_req, res) => { const kjoring = await vigilo.run({ source: 'manuell' }); res.json({ ...(await vigiloView()), kjoring }); }));
  return r;
}
export const beboerRoutes = createBeboerRoutes();
