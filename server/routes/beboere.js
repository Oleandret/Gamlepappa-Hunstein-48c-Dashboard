import { Router } from 'express';
import { isOwner } from '../lib/auth.js';
import { residents as defaultResidents } from '../lib/residents.js';
import { reminders as defaultReminders } from '../lib/reminders.js';
import { messaging as defaultMessaging } from '../lib/messaging.js';

// Beboernes kontaktinfo, innlogging og påminnelser. Personopplysninger: bare eierens egen Google-innlogging.
export function createBeboerRoutes({ residents = defaultResidents, reminders = defaultReminders, messaging = defaultMessaging, owner = isOwner } = {}) {
  const r = Router();
  r.use((req, res, next) => owner(req) ? next() : res.status(403).json({ error: 'Bare eieren kan se og endre beboernes kontaktinfo' }));
  const handle = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (e) { res.status([400, 404].includes(e.status) ? e.status : 503).json({ error: [400, 404].includes(e.status) ? e.message : 'Kunne ikke fullføre. Prøv igjen.' }); }
  };
  const overview = async () => ({ beboere: await residents.list(), kanaler: messaging.channels(), paaminnelser: await reminders.settings(), logg: await reminders.log(50) });
  r.get('/', handle(async (_req, res) => res.json(await overview())));
  r.put('/beboer/:navn', handle(async (req, res) => { await residents.updateContact(req.params.navn, req.body); res.json(await overview()); }));
  r.post('/beboer/:navn/invitasjon', handle(async (req, res) => res.json(await residents.createInvite(req.params.navn))));
  r.delete('/beboer/:navn/passord', handle(async (req, res) => { await residents.removePassword(req.params.navn); res.json(await overview()); }));
  r.put('/paaminnelser', handle(async (req, res) => { await reminders.saveSettings(req.body); res.json(await overview()); }));
  r.post('/paaminnelser/test', handle(async (req, res) => { const sendt = await reminders.run({ only: req.body?.navn, always: true, source: 'test' }); res.json({ ...(await overview()), sendt }); }));
  r.post('/paaminnelser/kjor', handle(async (_req, res) => { const sendt = await reminders.run({ source: 'manuell' }); res.json({ ...(await overview()), sendt }); }));
  return r;
}
export const beboerRoutes = createBeboerRoutes();
