// Datoer og klokkeslett i norsk tid, som tekst (YYYY-MM-DD og HH:MM), delt av gjøremål og påminnelser.
export const osloToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export const osloClock = (now = new Date()) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
export function addDays(date, days) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
/** Ukedag 1 (mandag) – 7 (søndag). */
export const isoWeekday = date => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
export function daysInMonth(date) { const [y, m] = date.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
// Rundtur gjennom toISOString: Date.parse godtar 2026-02-31 og ruller til 3. mars.
export const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
export const isClock = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const dayLabel = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('nb-NO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
