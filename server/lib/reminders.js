// Daglige påminnelser til beboerne på e-post og/eller SMS: forfalte gjøremål,
// dagens gjøremål og egne åpne avvik. Sendes bare når det er noe å si, én gang per dag.
import { getNamespace, updateNamespace } from './configStore.js';
import { messaging as defaultMessaging } from './messaging.js';
import { residents as defaultResidents } from './residents.js';
import { RESIDENTS } from '../routes/avvik.js';
import { osloToday } from '../routes/huset.js';

const SETTINGS = '_paaminnelser', LOG = '_paaminnelseLogg';
export const DEFAULT_SETTINGS = { aktiv: false, klokkeslett: '07:30', sistKjort: null };
const osloClock = now => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
const day = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('nb-NO', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

export function composeReminder(navn, { tasks = [], avvik = [], today, origin = '', always = false }) {
  const mine = tasks.filter(t => t.status === 'aktiv' && t.ansvarlig === navn);
  const overdue = mine.filter(t => t.frist < today), due = mine.filter(t => t.frist === today);
  const open = avvik.filter(a => a.status === 'apen' && a.person === navn);
  if (!always && !overdue.length && !due.length) return null;
  const lines = [`Hei ${navn.split(' ')[0]}! Påminnelse fra Huset:`];
  if (overdue.length) lines.push('', 'Forfalt:', ...overdue.map(t => `- ${t.tittel} (frist ${day(t.frist)})`));
  if (due.length) lines.push('', 'I dag:', ...due.map(t => `- ${t.tittel}`));
  if (!overdue.length && !due.length) lines.push('', 'Du har ingen gjøremål som forfaller i dag.');
  if (open.length) lines.push('', `Du har ${open.length} åpne avvik.`);
  if (origin) lines.push('', `Se og merk som gjort: ${origin}/huset`);
  const text = lines.join('\n');
  const sms = [`Huset: ${overdue.length ? `${overdue.length} forfalt` : ''}${overdue.length && due.length ? ', ' : ''}${due.length ? `${due.length} i dag` : ''}${!overdue.length && !due.length ? 'ingen gjøremål i dag' : ''}.`, ...[...overdue, ...due].slice(0, 5).map(t => `- ${t.tittel}`), origin ? `${origin}/huset` : ''].filter(Boolean).join('\n');
  return { subject: overdue.length ? `Huset: ${overdue.length} forfalt gjøremål` : 'Huset: dagens gjøremål', text, sms };
}

export function createReminders({ messaging = defaultMessaging, residents = defaultResidents, read = getNamespace, update = updateNamespace, now = () => new Date(), origin = () => process.env.AUTH_PUBLIC_ORIGIN || '' } = {}) {
  async function settings() { return { ...DEFAULT_SETTINGS, ...(await read(SETTINGS) || {}) }; }
  async function saveSettings(body) {
    const klokkeslett = typeof body?.klokkeslett === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.klokkeslett) ? body.klokkeslett : null;
    if (!klokkeslett) throw Object.assign(new Error('Ugyldig klokkeslett'), { status: 400 });
    return update(SETTINGS, prev => ({ ...DEFAULT_SETTINGS, ...(prev || {}), aktiv: body?.aktiv === true, klokkeslett }));
  }
  async function log(limit = 100) { return (await read(LOG) || []).slice(0, limit); }

  // only: one resident (test), always: send even with nothing due.
  async function run({ only = null, always = false, source = 'daglig' } = {}) {
    const [contacts, tasks, avvik] = await Promise.all([residents.all(), read('_gjoremal'), read('_avvik')]);
    const today = osloToday(now()), channels = messaging.channels(), entries = [];
    for (const navn of RESIDENTS.filter(n => !only || n === only)) {
      const c = contacts[navn] || {};
      const msg = composeReminder(navn, { tasks: tasks || [], avvik: avvik || [], today, origin: origin(), always });
      if (!msg) continue;
      const targets = [['epost', c.epostVarsel && c.epost], ['sms', c.smsVarsel && c.telefon]].filter(([, to]) => to);
      if (only && !targets.length) entries.push({ at: now().toISOString(), navn, kanal: '-', status: 'ikke sendt', feil: 'Ingen e-post/SMS er slått på for denne beboeren', kilde: source });
      for (const [kanal, to] of targets) {
        const entry = { at: now().toISOString(), navn, kanal, kilde: source };
        if (!channels[kanal]) { entries.push({ ...entry, status: 'ikke sendt', feil: kanal === 'epost' ? 'E-post er ikke satt opp på serveren' : 'SMS er ikke satt opp på serveren' }); continue; }
        try { kanal === 'epost' ? await messaging.sendEmail(to, msg.subject, msg.text) : await messaging.sendSms(to, msg.sms); entries.push({ ...entry, status: 'sendt' }); }
        catch (e) { entries.push({ ...entry, status: 'feilet', feil: String(e.message || 'Ukjent feil').slice(0, 200) }); }
      }
    }
    if (entries.length) await update(LOG, prev => [...[...entries].reverse(), ...(prev || [])].slice(0, 300));
    return entries;
  }

  // Called every minute: runs once per Oslo date, at or after the chosen time.
  async function tick() {
    const s = await settings(), t = now(), today = osloToday(t);
    if (!s.aktiv || s.sistKjort === today || osloClock(t) < s.klokkeslett) return null;
    await update(SETTINGS, prev => ({ ...DEFAULT_SETTINGS, ...(prev || {}), sistKjort: today }));
    return run();
  }
  return { settings, saveSettings, log, run, tick };
}
export const reminders = createReminders();

let timer;
export function startReminderWorker() {
  if (timer) return;
  const loop = () => { reminders.tick().catch(() => console.warn('[paaminnelser] kjøring feilet')).finally(() => { timer = setTimeout(loop, 60_000); timer.unref(); }); };
  timer = setTimeout(loop, 30_000); timer.unref();
}
export function stopReminderWorker() { clearTimeout(timer); timer = null; }
