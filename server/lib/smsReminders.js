// Planlagte SMS-påminnelser fra Trivsel: faste påminnelser (daglig, ukentlig, månedlig eller én gang)
// til én eller flere beboere, og påminnelse om gjøremål på en valgt dag før fristen, med purring
// hver dag mens gjøremålet er forfalt. Sendes fra iPhonen (messaging.sendSms); hver utsending
// logges i samme logg som de daglige påminnelsene, uten telefonnummer.
import { randomUUID } from 'node:crypto';
import { getNamespace, updateNamespace } from './configStore.js';
import { messaging as defaultMessaging } from './messaging.js';
import { residents as defaultResidents } from './residents.js';
import { RESIDENTS } from '../routes/avvik.js';
import { osloToday, osloClock, addDays, isoWeekday, daysInMonth, isDate, isClock, dayLabel } from './osloTime.js';

export const REMINDER_RECURRENCE = ['daglig', 'ukentlig', 'maanedlig', 'en-gang'];
export const WEEKDAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
export const MAX_DAYS_BEFORE = 14;
const NS = '_smsPaaminnelser', TASKS = '_gjoremal', LOG = '_paaminnelseLogg';
const MAX_ITEMS = 500, MAX_TEXT = 500;
const list = v => Array.isArray(v) ? v : [];
const text = v => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
const bad = message => Object.assign(new Error(message), { status: 400 });
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max ? v : (typeof v === 'string' && /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max ? Number(v) : null);

/** En planlagt påminnelse fra skjemaet; feil gir 400 med norsk tekst. */
export function parseReminder(body, now = new Date()) {
  const tekst = text(body?.tekst), av = text(body?.av), gjentakelse = text(body?.gjentakelse) || 'ukentlig';
  const mottakere = [...new Set((Array.isArray(body?.mottakere) ? body.mottakere : [body?.mottaker]).map(text).filter(Boolean))];
  if (!tekst) throw bad('Skriv hva det skal minnes om');
  if (tekst.length > MAX_TEXT) throw bad(`Påminnelsen kan være maks ${MAX_TEXT} tegn`);
  if (!mottakere.length) throw bad('Velg hvem som skal få påminnelsen');
  if (mottakere.some(n => !RESIDENTS.includes(n))) throw bad('Ukjent beboer');
  if (!RESIDENTS.includes(av)) throw bad('Velg hvem som legger inn påminnelsen');
  if (!REMINDER_RECURRENCE.includes(gjentakelse)) throw bad('Ukjent gjentakelse');
  const klokkeslett = body?.klokkeslett ?? '08:00';
  if (!isClock(klokkeslett)) throw bad('Ugyldig klokkeslett');
  const ukedag = gjentakelse === 'ukentlig' ? int(body?.ukedag, 1, 7) : null;
  const dag = gjentakelse === 'maanedlig' ? int(body?.dag, 1, 31) : null;
  const dato = gjentakelse === 'en-gang' ? body?.dato : null;
  if (gjentakelse === 'ukentlig' && !ukedag) throw bad('Velg ukedag');
  if (gjentakelse === 'maanedlig' && !dag) throw bad('Velg dag i måneden (1–31)');
  if (gjentakelse === 'en-gang' && (!isDate(dato) || dato < osloToday(now))) throw bad('Velg en dato fra i dag og framover');
  return { id: randomUUID(), tekst, mottakere, gjentakelse, ukedag, dag, dato, klokkeslett, aktiv: body?.aktiv !== false, av, opprettet: now.toISOString(), sistSendt: null, siste: null };
}

/** Påminnelse på et gjøremål: hvor mange dager før fristen, klokkeslett, og purring hver dag når forfalt. null = ingen. */
export function parseTaskReminder(v) {
  if (v === null || v === undefined || v === false || (typeof v === 'object' && v.sms === false)) return null;
  if (typeof v !== 'object') throw bad('Ugyldig påminnelse');
  const dagerFor = int(v.dagerFor ?? 0, 0, MAX_DAYS_BEFORE), klokkeslett = v.klokkeslett ?? '08:00';
  if (dagerFor === null) throw bad(`Påminnelsen kan komme 0–${MAX_DAYS_BEFORE} dager før fristen`);
  if (!isClock(klokkeslett)) throw bad('Ugyldig klokkeslett for påminnelsen');
  return { dagerFor, klokkeslett, purring: v.purring === true };
}

/** Skal påminnelsen gå denne datoen? Månedsdager utover månedens lengde faller på siste dag. */
export function dueOn(r, date) {
  if (r.gjentakelse === 'daglig') return true;
  if (r.gjentakelse === 'ukentlig') return isoWeekday(date) === r.ukedag;
  if (r.gjentakelse === 'maanedlig') { const d = Number(date.slice(8)); return d === r.dag || (r.dag > daysInMonth(date) && d === daysInMonth(date)); }
  if (r.gjentakelse === 'en-gang') return date === r.dato;
  return false;
}
/** Neste dato påminnelsen går (i dag hvis klokkeslettet ikke er passert og den ikke er sendt i dag), ellers null. */
export function nextOccurrence(r, today, clock = '00:00') {
  if (!r.aktiv) return null;
  if (dueOn(r, today) && clock < r.klokkeslett && r.sistSendt !== today) return today;
  for (let d = addDays(today, 1), i = 0; i < 400; d = addDays(d, 1), i++) if (dueOn(r, d)) return d;
  return null;
}
const firstName = navn => navn.split(' ')[0];
export const reminderSms = (r, navn, origin = '') => [`Hei ${firstName(navn)}! Påminnelse fra Trivsel: ${r.tekst}`, origin ? `${origin}/huset` : ''].filter(Boolean).join('\n');

/** Dagen påminnelsen om et gjøremål går. */
export const taskReminderDate = t => t.paaminnelse ? addDays(t.frist, -t.paaminnelse.dagerFor) : null;
/**
 * Skal gjøremålet minnes om nå? På påminnelsesdagen (eller senere, fram til fristen, hvis den ble
 * forsømt), og med purring hver dag etter fristen. Én gang per dag.
 */
export function taskReminderDue(t, today, clock) {
  const p = t.paaminnelse;
  if (!p || t.status !== 'aktiv' || t.sistPaaminnet === today || clock < p.klokkeslett) return false;
  const date = taskReminderDate(t);
  if (today >= date && today <= t.frist) return !t.sistPaaminnet || t.sistPaaminnet < date;
  return p.purring && t.frist < today;
}
export function taskReminderSms(t, today, origin = '') {
  const when = t.frist === today ? 'i dag' : t.frist === addDays(today, 1) ? 'i morgen' : t.frist < today ? `var ${dayLabel(t.frist)} – det er ikke gjort ennå` : dayLabel(t.frist);
  return [`Hei ${firstName(t.ansvarlig)}! ${t.frist < today ? 'Purring' : 'Påminnelse'} fra Trivsel: ${t.tittel} – frist ${when}.`, t.notat || '', origin ? `Merk som gjort: ${origin}/huset` : ''].filter(Boolean).join('\n');
}

export const reminderStore = { read: () => getNamespace(NS), update: fn => updateNamespace(NS, fn) };

export function createSmsReminders({ messaging = defaultMessaging, residents = defaultResidents, store = reminderStore, tasks = { read: () => getNamespace(TASKS), update: fn => updateNamespace(TASKS, fn) }, log = entries => updateNamespace(LOG, prev => [...[...entries].reverse(), ...list(prev)].slice(0, 300)), now = () => new Date(), origin = () => process.env.AUTH_PUBLIC_ORIGIN || '' } = {}) {
  const at = () => now().toISOString();
  async function sendTo(navn, tekst, meta) {
    const entry = { at: at(), navn, kanal: 'sms', ...meta };
    if (!messaging.channels().sms) return { ...entry, status: 'ikke sendt', feil: 'SMS er ikke satt opp på serveren' };
    const telefon = (await residents.all())[navn]?.telefon;
    if (!telefon) return { ...entry, status: 'ikke sendt', feil: `Mangler mobilnummer for ${navn}` };
    try { await messaging.sendSms(telefon, tekst); return { ...entry, status: 'sendt' }; }
    catch (e) { return { ...entry, status: 'feilet', feil: String(e.message || 'Ukjent feil').slice(0, 200) }; }
  }
  const summary = entries => ({ at: at(), status: entries.every(e => e.status === 'sendt') ? 'sendt' : entries.some(e => e.status === 'sendt') ? 'delvis' : 'feilet', feil: entries.filter(e => e.feil).map(e => `${e.navn}: ${e.feil}`).join(' · ') || null });

  // Merkes som sendt før telefonen jobber, så et omstartet eller tregt tikk aldri sender dobbelt.
  // En manuell utsending («Send nå») teller ikke som dagens planlagte.
  async function sendReminder(r, source) {
    const today = osloToday(now()), planned = source !== 'manuell';
    await store.update(prev => list(prev).map(x => x.id === r.id ? { ...x, sistSendt: planned ? today : x.sistSendt, siste: { at: at(), status: 'sender', feil: null }, aktiv: planned && x.gjentakelse === 'en-gang' ? false : x.aktiv } : x));
    const entries = [];
    for (const navn of r.mottakere) entries.push(await sendTo(navn, reminderSms(r, navn, origin()), { kilde: source, emne: r.tekst.slice(0, 80) }));
    await store.update(prev => list(prev).map(x => x.id === r.id ? { ...x, siste: summary(entries) } : x));
    await log(entries);
    return entries;
  }
  async function sendTask(t, source) {
    const today = osloToday(now());
    await tasks.update(prev => list(prev).map(x => x.id === t.id ? { ...x, sistPaaminnet: today } : x));
    const entry = await sendTo(t.ansvarlig, taskReminderSms(t, today, origin()), { kilde: source, emne: t.tittel.slice(0, 80) });
    await tasks.update(prev => list(prev).map(x => x.id === t.id ? { ...x, sistePaaminnelse: summary([entry]) } : x));
    await log([entry]);
    return [entry];
  }

  // Kalles hvert minutt: alt som skulle gått i dag og ikke er sendt, sendes nå (også etter nedetid).
  async function tick() {
    const t = now(), today = osloToday(t), clock = osloClock(t), sent = [];
    for (const r of list(await store.read())) if (r.aktiv && dueOn(r, today) && clock >= r.klokkeslett && r.sistSendt !== today) sent.push(...await sendReminder(r, 'planlagt'));
    for (const task of list(await tasks.read())) if (taskReminderDue(task, today, clock)) sent.push(...await sendTask(task, 'gjoremal'));
    return sent;
  }
  async function sendNow(id) {
    const r = list(await store.read()).find(x => x.id === id);
    if (!r) throw Object.assign(new Error('Påminnelsen finnes ikke'), { status: 404 });
    return sendReminder(r, 'manuell');
  }
  async function sendTaskNow(id) {
    const t = list(await tasks.read()).find(x => x.id === id);
    if (!t) throw Object.assign(new Error('Gjøremålet finnes ikke'), { status: 404 });
    return sendTask(t, 'manuell');
  }
  return { tick, sendNow, sendTaskNow };
}
export const smsReminders = createSmsReminders();
